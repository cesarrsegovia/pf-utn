import { Op, type Includeable, type Transaction } from "sequelize";
import {
  ESTADOS_TURNO_ACTIVOS, ESTADOS_TURNO_CON_CUPO, esTurnoActivo, incluyeCastracion, incluyeChipeo,
  type EstadoOperativo, type EstadoTurno, type TipoProcedimiento,
} from "@/lib/constantes";
import { condicionBusqueda } from "@/lib/busqueda";
import { Animal, Operativo, sequelize, Turno, Vecino } from "@/lib/db";
import { ReglaNegocioError, ValidacionError } from "@/lib/errores";
import { ETIQUETAS_ESTADO_OPERATIVO, ETIQUETAS_ESTADO_TURNO, nombreAnimal } from "@/lib/etiquetas";
import { horaCorta, hoyLocal, instanteLocal } from "@/lib/fechas";
import type { ResultadoPaginado } from "@/schemas/comun";
import type {
  DatosCancelarTurno, DatosReprogramarTurno, DatosSolicitarTurno, ParametrosListadoTurnos,
} from "@/schemas/turnos";
import { buscarPorId, exigirReferencia, paginacion } from "./comun";
import { anularRecordatorios, cargarTurnoNotificable, notificar, programarRecordatorio } from "./notificaciones";

/** Representación pública de un turno (F3), con los datos del animal, tutor y operativo. */
export interface TurnoDto {
  id: number;
  /** HH:MM */
  horario: string;
  tipo_solicitado: TipoProcedimiento;
  estado: EstadoTurno;
  motivo_cancelacion: string | null;
  /** Fecha y hora de la solicitud en ISO 8601. */
  fecha_solicitud: string;
  animal_id: number;
  animal: string;
  /** "Apellido, Nombre" del tutor, o null si el animal no tiene. */
  tutor: string | null;
  operativo_id: number;
  /** Fecha del operativo (YYYY-MM-DD). */
  fecha: string;
  lugar: string;
  zona: string;
}

/** Animal del turno con su tutor (opcional: los callejeros no tienen). */
const INCLUIR_ANIMAL: Includeable = {
  association: "animal",
  attributes: ["id", "nombre", "vecino_id"],
  include: [{ association: "vecino", attributes: ["id", "nombre", "apellido", "dni"], required: false }],
};

/** Zona del operativo del turno. */
const INCLUIR_ZONA: Includeable = { association: "zona", attributes: ["id", "nombre"] };

/** Asociaciones que necesita el DTO: animal con tutor y operativo con zona. */
const INCLUIR_DETALLE: Includeable[] = [
  INCLUIR_ANIMAL,
  { association: "operativo", attributes: ["id", "fecha", "lugar"], include: [INCLUIR_ZONA] },
];

/** Filtra los turnos por la asignación del veterinario al operativo, sin traer columnas del personal. */
function incluirAsignacion(veterinarioId: number): Includeable {
  return { association: "personal", attributes: [], where: { id: veterinarioId }, through: { attributes: [] } };
}

/** Convierte el modelo (con sus asociaciones) al DTO público. */
function aDto(turno: Turno): TurnoDto {
  const animal = turno.animal!;
  const operativo = turno.operativo!;
  return {
    id: turno.id,
    horario: horaCorta(turno.horario),
    tipo_solicitado: turno.tipo_solicitado,
    estado: turno.estado,
    motivo_cancelacion: turno.motivo_cancelacion,
    fecha_solicitud: turno.fecha_solicitud.toISOString(),
    animal_id: turno.animal_id,
    animal: nombreAnimal(animal),
    tutor: animal.vecino ? `${animal.vecino.apellido}, ${animal.vecino.nombre}` : null,
    operativo_id: turno.operativo_id,
    fecha: operativo.fecha,
    lugar: operativo.lugar,
    zona: operativo.zona!.nombre,
  };
}

/** Obtiene el DTO de un turno (404 si no existe). */
async function obtenerTurnoDto(id: number, transaction?: Transaction): Promise<TurnoDto> {
  return aDto(await buscarPorId(Turno, id, "El turno no existe", { include: INCLUIR_DETALLE, transaction }));
}

/** Listado paginado con búsqueda por animal o tutor (apellido o DNI) y filtros de estado y operativo. */
export async function listarTurnos(parametros: ParametrosListadoTurnos): Promise<ResultadoPaginado<TurnoDto>> {
  const { rows, count } = await Turno.findAndCountAll({
    where: {
      [Op.and]: [
        // "animal->vecino" es el alias que Sequelize da al tutor incluido dentro del animal.
        condicionBusqueda(["animal.nombre", "animal->vecino.apellido", "animal->vecino.dni"], parametros.busqueda),
        parametros.estado ? { estado: parametros.estado } : {},
        parametros.operativo_id ? { operativo_id: parametros.operativo_id } : {},
      ],
    },
    include: INCLUIR_DETALLE,
    order: [["operativo", "fecha", "DESC"], ["horario", "ASC"], ["id", "ASC"]],
    ...paginacion(parametros),
  });
  return { filas: rows.map(aDto), total: count, pagina: parametros.pagina, tamanio: parametros.tamanio };
}

/**
 * Turnos que un veterinario puede atender ahora (F7): confirmados, de operativos en curso
 * a los que está asignado, ordenados por horario.
 */
export async function listarTurnosAtendibles(veterinarioId: number): Promise<TurnoDto[]> {
  const turnos = await Turno.findAll({
    where: { estado: "confirmado" },
    include: [
      INCLUIR_ANIMAL,
      {
        association: "operativo",
        attributes: ["id", "fecha", "lugar"],
        where: { estado: "en_curso" },
        include: [INCLUIR_ZONA, incluirAsignacion(veterinarioId)],
      },
    ],
    order: [["horario", "ASC"], ["id", "ASC"]],
  });
  return turnos.map(aDto);
}

/**
 * Turnos no cancelados de los operativos de hoy, por horario (dashboard). Con `veterinarioId`,
 * solo los de los operativos a los que ese integrante del personal está asignado.
 */
export async function listarTurnosDelDia(veterinarioId?: number): Promise<TurnoDto[]> {
  const turnos = await Turno.findAll({
    where: { estado: { [Op.ne]: "cancelado" } },
    include: [
      INCLUIR_ANIMAL,
      {
        association: "operativo",
        attributes: ["id", "fecha", "lugar"],
        where: { fecha: hoyLocal(), estado: { [Op.ne]: "cancelado" } },
        include: veterinarioId ? [INCLUIR_ZONA, incluirAsignacion(veterinarioId)] : [INCLUIR_ZONA],
      },
    ],
    order: [["horario", "ASC"], ["id", "ASC"]],
  });
  return turnos.map(aDto);
}

/**
 * Bloquea la fila del operativo elegido (SELECT … FOR UPDATE): serializa las solicitudes
 * que compiten por su cupo. Si no existe, es un error del campo `operativo_id`.
 */
async function bloquearOperativo(id: number, transaction: Transaction): Promise<Operativo> {
  const operativo = await Operativo.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
  if (!operativo) {
    throw new ValidacionError("Revise los datos ingresados", { operativo_id: "El operativo seleccionado no existe" });
  }
  return operativo;
}

/** Bloquea la fila del turno (404 si no existe). */
function bloquearTurno(id: number, transaction: Transaction): Promise<Turno> {
  return buscarPorId(Turno, id, "El turno no existe", { transaction, lock: transaction.LOCK.UPDATE });
}

/** Exige que el turno esté pendiente o confirmado para la acción indicada. */
function exigirActivo(turno: Turno, accion: string): void {
  if (!esTurnoActivo(turno.estado)) {
    // CreationOptional de Sequelize añade una marca de tipo que impide indexar Record directamente (TS7053).
    throw new ReglaNegocioError(
      `No se puede ${accion} un turno ${ETIQUETAS_ESTADO_TURNO[turno.estado as EstadoTurno].toLowerCase()}`,
    );
  }
}

/**
 * Verifica que el operativo (ya bloqueado) admita un turno en ese horario: estado programado,
 * horario dentro de la franja, instante futuro y cupo disponible. `excluirTurnoId` descuenta
 * el turno que se está reprogramando (no compite consigo mismo por el cupo).
 */
async function validarDisponibilidad(
  operativo: Operativo,
  horario: string,
  transaction: Transaction,
  excluirTurnoId?: number,
): Promise<void> {
  if (operativo.estado !== "programado") {
    throw new ReglaNegocioError(
      `El operativo no admite turnos: está ${ETIQUETAS_ESTADO_OPERATIVO[operativo.estado as EstadoOperativo].toLowerCase()}`,
    );
  }
  const inicio = horaCorta(operativo.hora_inicio);
  const fin = horaCorta(operativo.hora_fin);
  if (horario < inicio || horario >= fin) {
    throw new ValidacionError("Revise los datos ingresados", {
      horario: `El horario debe estar entre las ${inicio} y las ${fin}`,
    });
  }
  if (instanteLocal(operativo.fecha, horario) <= new Date()) {
    throw new ValidacionError("Revise los datos ingresados", { horario: "El horario del turno ya pasó" });
  }
  const ocupados = await Turno.count({
    where: {
      operativo_id: operativo.id,
      estado: { [Op.in]: ESTADOS_TURNO_CON_CUPO },
      ...(excluirTurnoId ? { id: { [Op.ne]: excluirTurnoId } } : {}),
    },
    transaction,
  });
  if (ocupados >= operativo.cupo_maximo) {
    throw new ReglaNegocioError("El operativo no tiene cupo disponible");
  }
}

/**
 * Verifica que el animal pueda pedir el turno: tutor activo (si tiene), que no esté ya
 * castrado o chipeado según lo solicitado y que no tenga otro turno activo.
 */
async function validarAnimal(animal: Animal, tipo: TipoProcedimiento, transaction: Transaction): Promise<void> {
  if (animal.vecino_id !== null) {
    const tutor = await Vecino.findByPk(animal.vecino_id, { transaction });
    if (!tutor?.activo) {
      throw new ReglaNegocioError("El tutor del animal está dado de baja: no puede solicitar turnos");
    }
  }
  if (incluyeCastracion(tipo) && animal.castrado) {
    throw new ReglaNegocioError("El animal ya está castrado");
  }
  if (incluyeChipeo(tipo) && animal.numero_chip) {
    throw new ReglaNegocioError("El animal ya tiene chip colocado");
  }
  const activos = await Turno.count({
    where: { animal_id: animal.id, estado: { [Op.in]: ESTADOS_TURNO_ACTIVOS } },
    transaction,
  });
  // El índice único ux_turno_activo_por_animal es el resguardo ante solicitudes simultáneas.
  if (activos > 0) {
    throw new ReglaNegocioError("El animal ya tiene un turno pendiente o confirmado");
  }
}

/** Solicitud de turno (F3): queda pendiente hasta que se confirma. No genera notificaciones. */
export async function solicitarTurno(datos: DatosSolicitarTurno): Promise<TurnoDto> {
  return sequelize.transaction(async (transaction) => {
    const operativo = await bloquearOperativo(datos.operativo_id, transaction);
    const animal = await exigirReferencia(Animal, datos.animal_id, "animal_id", "El animal seleccionado no existe", transaction);
    await validarAnimal(animal, datos.tipo_solicitado, transaction);
    await validarDisponibilidad(operativo, datos.horario, transaction);
    const turno = await Turno.create(
      { horario: datos.horario, tipo_solicitado: datos.tipo_solicitado, animal_id: animal.id, operativo_id: operativo.id },
      { transaction },
    );
    return obtenerTurnoDto(turno.id, transaction);
  });
}

/** Confirma un turno pendiente: aviso de confirmación y recordatorio 24 h antes (F3/F12). */
export async function confirmarTurno(id: number): Promise<TurnoDto> {
  return sequelize.transaction(async (transaction) => {
    const turno = await bloquearTurno(id, transaction);
    if (turno.estado !== "pendiente") {
      throw new ReglaNegocioError(
        `Solo se pueden confirmar turnos pendientes (el turno está ${ETIQUETAS_ESTADO_TURNO[turno.estado as EstadoTurno].toLowerCase()})`,
      );
    }
    await turno.update({ estado: "confirmado" }, { transaction });

    const notificable = await cargarTurnoNotificable(id, transaction);
    await notificar(notificable, "confirmacion", transaction);
    await programarRecordatorio(notificable, transaction);
    return obtenerTurnoDto(id, transaction);
  });
}

/**
 * Reprograma un turno activo a otro horario y/o operativo, revalidando el destino.
 * Anula el recordatorio anterior, avisa la reprogramación y, si está confirmado,
 * programa el recordatorio nuevo.
 */
export async function reprogramarTurno(id: number, datos: DatosReprogramarTurno): Promise<TurnoDto> {
  return sequelize.transaction(async (transaction) => {
    // Orden de bloqueo: operativo y después turno (el mismo que usa la cancelación de operativos).
    const destino = await bloquearOperativo(datos.operativo_id, transaction);
    const turno = await bloquearTurno(id, transaction);
    exigirActivo(turno, "reprogramar");
    if (turno.operativo_id === destino.id && horaCorta(turno.horario) === datos.horario) {
      throw new ValidacionError("Revise los datos ingresados", {
        horario: "Indique un horario u operativo distinto del actual",
      });
    }
    await validarDisponibilidad(destino, datos.horario, transaction, turno.id);
    await turno.update({ operativo_id: destino.id, horario: datos.horario }, { transaction });

    await anularRecordatorios([id], transaction);
    const notificable = await cargarTurnoNotificable(id, transaction);
    await notificar(notificable, "reprogramacion", transaction);
    await programarRecordatorio(notificable, transaction);
    return obtenerTurnoDto(id, transaction);
  });
}

/** Cancela un turno activo con motivo: anula su recordatorio y avisa al tutor. */
export async function cancelarTurno(id: number, datos: DatosCancelarTurno): Promise<TurnoDto> {
  return sequelize.transaction(async (transaction) => {
    const turno = await bloquearTurno(id, transaction);
    exigirActivo(turno, "cancelar");
    await turno.update({ estado: "cancelado", motivo_cancelacion: datos.motivo }, { transaction });

    await anularRecordatorios([id], transaction);
    const notificable = await cargarTurnoNotificable(id, transaction);
    await notificar(notificable, "cancelacion", transaction, datos.motivo);
    return obtenerTurnoDto(id, transaction);
  });
}
