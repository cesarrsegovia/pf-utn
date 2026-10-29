import type { Transaction } from "sequelize";
import {
  incluyeCastracion, incluyeChipeo, tipoIncluido, type EstadoOperativo, type EstadoTurno, type TipoProcedimiento,
} from "@/lib/constantes";
import {
  Animal, HistorialClinico, Operativo, OperativoVeterinario, Procedimiento, sequelize, Turno, Veterinario,
} from "@/lib/db";
import { ProhibidoError, ReglaNegocioError, ValidacionError } from "@/lib/errores";
import { ETIQUETAS_ESTADO_OPERATIVO, ETIQUETAS_ESTADO_TURNO, ETIQUETAS_TIPO_PROCEDIMIENTO } from "@/lib/etiquetas";
import type { DatosProcedimiento } from "@/schemas/procedimientos";
import { nuloSiVacio } from "./comun";
import { descontarPorProcedimiento } from "./insumos";
import { anularRecordatorios } from "./notificaciones";
import { listarTurnosAtendibles, type TurnoDto } from "./turnos";

/** Resultado del registro de un procedimiento (F7). */
export interface ProcedimientoDto {
  id: number;
  turno_id: number;
  tipo: TipoProcedimiento;
  /** Fecha y hora del registro en ISO 8601. */
  fecha: string;
  numero_chip_colocado: string | null;
  /** Descripción guardada en el historial clínico. */
  descripcion: string;
}

/** Turnos que el veterinario en sesión puede atender, o el motivo por el que no puede. */
export interface TurnosParaAtender {
  habilitado: boolean;
  motivo: string | null;
  turnos: TurnoDto[];
}

/**
 * Integrante del personal vinculado al usuario en sesión, habilitado para registrar
 * procedimientos: activo, de tipo veterinario y con matrícula (spec §4). Si no, 403.
 */
async function exigirVeterinarioHabilitado(usuarioId: number, transaction?: Transaction): Promise<Veterinario> {
  const veterinario = await Veterinario.findOne({ where: { usuario_id: usuarioId }, transaction });
  if (!veterinario) {
    throw new ProhibidoError(
      "Su usuario no está vinculado a ningún integrante del personal: pida al administrador que lo vincule",
    );
  }
  if (!veterinario.activo) {
    throw new ProhibidoError("Su registro de personal está inactivo");
  }
  if (veterinario.tipo !== "veterinario" || !veterinario.matricula) {
    throw new ProhibidoError("Solo un veterinario con matrícula puede registrar procedimientos");
  }
  return veterinario;
}

/** El chip no puede existir en ningún animal ni haber sido colocado en otro procedimiento. */
async function exigirChipLibre(chip: string, transaction: Transaction): Promise<void> {
  const [enAnimales, enProcedimientos] = await Promise.all([
    Animal.count({ where: { numero_chip: chip }, transaction }),
    Procedimiento.count({ where: { numero_chip_colocado: chip }, transaction }),
  ]);
  if (enAnimales + enProcedimientos > 0) {
    throw new ValidacionError("Revise los datos ingresados", {
      numero_chip_colocado: `El chip ${chip} ya está registrado`,
    });
  }
}

/**
 * Descripción del historial clínico: tipo, veterinario, chip, insumos y observaciones.
 * Se exporta para que el seed de demostración redacte el historial igual que F7.
 */
export function redactarDescripcion(
  tipo: TipoProcedimiento,
  veterinario: Veterinario,
  chip: string | null,
  insumos: string[],
  observaciones: string | null,
): string {
  const partes = [
    `Procedimiento: ${ETIQUETAS_TIPO_PROCEDIMIENTO[tipo]}.`,
    `Veterinario/a: ${veterinario.apellido}, ${veterinario.nombre} (Mat. ${veterinario.matricula}).`,
  ];
  if (chip) partes.push(`Chip colocado: ${chip}.`);
  partes.push(insumos.length > 0 ? `Insumos: ${insumos.join("; ")}.` : "Sin insumos registrados.");
  if (observaciones) partes.push(`Observaciones: ${observaciones}`);
  return partes.join(" ");
}

/**
 * Registra un procedimiento (F7) en una única transacción. Orden de bloqueo fijo:
 * operativo (compartido) → turno → animal → insumos por id ascendente. Cualquier error
 * revierte todo: stock, turno, animal, recordatorio e historial quedan como estaban.
 */
export async function registrarProcedimiento(datos: DatosProcedimiento, usuarioId: number): Promise<ProcedimientoDto> {
  return sequelize.transaction(async (transaction) => {
    // 1) Veterinario en sesión: vinculado, activo, de tipo veterinario y con matrícula.
    const veterinario = await exigirVeterinarioHabilitado(usuarioId, transaction);

    // 2) Turno y operativo. Primero se lee el operativo del turno (sin bloqueo) para respetar
    //    el orden operativo → turno; FOR SHARE impide finalizarlo mientras se registra.
    const referencia = await Turno.findByPk(datos.turno_id, { attributes: ["id", "operativo_id"], transaction });
    if (!referencia) {
      throw new ValidacionError("Revise los datos ingresados", { turno_id: "El turno no existe" });
    }
    const operativo = (await Operativo.findByPk(referencia.operativo_id, { transaction, lock: transaction.LOCK.SHARE }))!;
    const turno = (await Turno.findByPk(datos.turno_id, { transaction, lock: transaction.LOCK.UPDATE }))!;
    if (turno.estado !== "confirmado") {
      throw new ReglaNegocioError(
        `El turno debe estar confirmado (está ${ETIQUETAS_ESTADO_TURNO[turno.estado as EstadoTurno].toLowerCase()})`,
      );
    }
    if (operativo.estado !== "en_curso") {
      throw new ReglaNegocioError(
        `El operativo debe estar en curso (está ${ETIQUETAS_ESTADO_OPERATIVO[operativo.estado as EstadoOperativo].toLowerCase()})`,
      );
    }
    const asignado = await OperativoVeterinario.count({
      where: { operativo_id: operativo.id, veterinario_id: veterinario.id },
      transaction,
    });
    if (asignado === 0) {
      throw new ProhibidoError("No está asignado a este operativo: no puede registrar el procedimiento");
    }

    // 3) Tipo realizado incluido en lo solicitado; el animal no puede repetir lo ya hecho.
    if (!tipoIncluido(datos.tipo, turno.tipo_solicitado)) {
      throw new ReglaNegocioError(
        `El procedimiento debe estar incluido en lo solicitado (${ETIQUETAS_TIPO_PROCEDIMIENTO[turno.tipo_solicitado]})`,
      );
    }
    const animal = (await Animal.findByPk(turno.animal_id, { transaction, lock: transaction.LOCK.UPDATE }))!;
    if (incluyeCastracion(datos.tipo) && animal.castrado) {
      throw new ReglaNegocioError("El animal ya está castrado");
    }

    // 4) Chip: solo si incluye chipeo; único en animales y procedimientos.
    const chip = incluyeChipeo(datos.tipo) ? datos.numero_chip_colocado : null;
    if (chip !== null) {
      if (animal.numero_chip) {
        throw new ReglaNegocioError("El animal ya tiene chip colocado");
      }
      await exigirChipLibre(chip, transaction);
    }

    // 5) Procedimiento.
    const observaciones = nuloSiVacio(datos.observaciones);
    const procedimiento = await Procedimiento.create(
      { tipo: datos.tipo, observaciones, numero_chip_colocado: chip, turno_id: turno.id, veterinario_id: veterinario.id },
      { transaction },
    );

    // 6) Insumos: stock, uso y egreso (lanza "Stock insuficiente de …" si no alcanza).
    const insumos = await descontarPorProcedimiento(datos.insumos, procedimiento.id, usuarioId, transaction);

    // 7) Animal: castrado y/o chip.
    await animal.update(
      { ...(incluyeCastracion(datos.tipo) ? { castrado: true } : {}), ...(chip ? { numero_chip: chip } : {}) },
      { transaction },
    );

    // 8) Turno completado y recordatorio anulado.
    await turno.update({ estado: "completado" }, { transaction });
    await anularRecordatorios([turno.id], transaction);

    // 9) Historial clínico (último paso: si falla, se revierte todo lo anterior).
    const descripcion = redactarDescripcion(datos.tipo, veterinario, chip, insumos, observaciones);
    await HistorialClinico.create({ descripcion, procedimiento_id: procedimiento.id }, { transaction });

    return {
      id: procedimiento.id,
      turno_id: turno.id,
      tipo: procedimiento.tipo,
      fecha: procedimiento.fecha.toISOString(),
      numero_chip_colocado: chip,
      descripcion,
    };
  });
}

/**
 * Turnos que el veterinario en sesión puede atender ahora. Si su usuario no está
 * habilitado, devuelve el motivo para mostrarlo en pantalla en lugar de un error.
 */
export async function turnosParaAtender(usuarioId: number): Promise<TurnosParaAtender> {
  try {
    const veterinario = await exigirVeterinarioHabilitado(usuarioId);
    return { habilitado: true, motivo: null, turnos: await listarTurnosAtendibles(veterinario.id) };
  } catch (error) {
    if (error instanceof ProhibidoError) {
      return { habilitado: false, motivo: error.message, turnos: [] };
    }
    throw error;
  }
}
