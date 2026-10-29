import { Op, type Transaction } from "sequelize";
import { ESTADOS_TURNO_ACTIVOS, MOTIVOS_CANCELACION } from "@/lib/constantes";
import { condicionBusqueda } from "@/lib/busqueda";
import { Animal, Notificacion, ReporteAvistamiento, sequelize, Turno, Vecino, Zona } from "@/lib/db";
import { ReglaNegocioError } from "@/lib/errores";
import { hoyLocal } from "@/lib/fechas";
import type { Opcion, ResultadoPaginado } from "@/schemas/comun";
import type { DatosVecino, ParametrosListadoVecinos } from "@/schemas/vecinos";
import {
  buscarPorId, condicionEstado, exigirReferencia, exigirValorUnico, nuloSiVacio, paginacion, type ResultadoBaja,
} from "./comun";
import { anularRecordatorios } from "./notificaciones";

/** Representación pública de un vecino (F1). */
export interface VecinoDto {
  id: number;
  nombre: string;
  apellido: string;
  dni: string;
  telefono: string;
  email: string | null;
  direccion: string;
  zona_id: number;
  /** Nombre de la zona, para mostrar en el listado. */
  zona: string;
  activo: boolean;
  fecha_baja: string | null;
}

/** Inclusión de la zona (solo su nombre). */
const INCLUIR_ZONA = { association: "zona", attributes: ["id", "nombre"] };

/** Convierte el modelo (con su zona incluida) al DTO público. */
function aDto(vecino: Vecino): VecinoDto {
  return {
    id: vecino.id,
    nombre: vecino.nombre,
    apellido: vecino.apellido,
    dni: vecino.dni,
    telefono: vecino.telefono,
    email: vecino.email,
    direccion: vecino.direccion,
    zona_id: vecino.zona_id,
    zona: vecino.zona!.nombre,
    activo: vecino.activo,
    fecha_baja: vecino.fecha_baja,
  };
}

/** Busca un vecino con su zona o lanza 404. */
function buscarVecino(id: number, transaction?: Transaction): Promise<Vecino> {
  return buscarPorId(Vecino, id, "El vecino no existe", { include: [INCLUIR_ZONA], transaction });
}

/** Listado paginado con búsqueda por nombre, apellido o DNI y filtros de estado y zona. */
export async function listarVecinos(parametros: ParametrosListadoVecinos): Promise<ResultadoPaginado<VecinoDto>> {
  const { rows, count } = await Vecino.findAndCountAll({
    where: {
      [Op.and]: [
        condicionBusqueda(["Vecino.nombre", "Vecino.apellido", "Vecino.dni"], parametros.busqueda),
        condicionEstado(parametros.estado),
        parametros.zona_id ? { zona_id: parametros.zona_id } : {},
      ],
    },
    include: [INCLUIR_ZONA],
    order: [["apellido", "ASC"], ["nombre", "ASC"]],
    ...paginacion(parametros),
  });
  return { filas: rows.map(aDto), total: count, pagina: parametros.pagina, tamanio: parametros.tamanio };
}

/**
 * Vecinos que pueden elegirse como tutor: los activos y, si se indica `incluirId`,
 * el tutor actual del animal en edición aunque esté dado de baja.
 */
export async function opcionesVecinos(incluirId?: number): Promise<Opcion[]> {
  const vecinos = await Vecino.findAll({
    attributes: ["id", "nombre", "apellido", "dni"],
    where: incluirId ? { [Op.or]: [{ activo: true }, { id: incluirId }] } : { activo: true },
    order: [["apellido", "ASC"], ["nombre", "ASC"]],
  });
  return vecinos.map((vecino) => ({
    id: vecino.id,
    etiqueta: `${vecino.apellido}, ${vecino.nombre} (DNI ${vecino.dni})`,
  }));
}

/** Obtiene un vecino por id (404 si no existe). */
export async function obtenerVecino(id: number): Promise<VecinoDto> {
  return aDto(await buscarVecino(id));
}

/** Valida DNI único y zona existente. */
async function validarVecino(datos: DatosVecino, transaction: Transaction, excluirId?: number) {
  await exigirValorUnico(Vecino, "dni", datos.dni, "Ya existe un vecino con ese DNI", { excluirId, transaction });
  await exigirReferencia(Zona, datos.zona_id, "zona_id", "La zona seleccionada no existe", transaction);
}

/** Convierte los datos del formulario en los atributos del modelo (email opcional en minúsculas). */
function aAtributos(datos: DatosVecino) {
  return {
    nombre: datos.nombre,
    apellido: datos.apellido,
    dni: datos.dni,
    telefono: datos.telefono,
    email: nuloSiVacio(datos.email)?.toLowerCase() ?? null,
    direccion: datos.direccion,
    zona_id: datos.zona_id,
  };
}

/** Alta de vecino (queda activo). */
export async function crearVecino(datos: DatosVecino): Promise<VecinoDto> {
  return sequelize.transaction(async (transaction) => {
    await validarVecino(datos, transaction);
    const vecino = await Vecino.create(aAtributos(datos), { transaction });
    return aDto(await buscarVecino(vecino.id, transaction));
  });
}

/** Modificación de los datos del vecino (el estado se cambia con la baja o la reactivación). */
export async function actualizarVecino(id: number, datos: DatosVecino): Promise<VecinoDto> {
  return sequelize.transaction(async (transaction) => {
    const vecino = await buscarVecino(id, transaction);
    await validarVecino(datos, transaction, id);
    await vecino.update(aAtributos(datos), { transaction });
    return aDto(await buscarVecino(id, transaction));
  });
}

/**
 * Baja de vecino (F1). Sin animales, avistamientos ni notificaciones se elimina
 * físicamente. Si tiene alguno, baja lógica (activo=false, fecha_baja=hoy) y, en la
 * misma transacción, sus turnos pendientes o confirmados pasan a cancelado con el
 * motivo "Baja del vecino" y sus recordatorios pendientes a anulado.
 */
export async function eliminarVecino(id: number): Promise<ResultadoBaja> {
  return sequelize.transaction(async (transaction) => {
    // Bloqueo de fila: evita que se le asigne un turno mientras se procesa la baja.
    const vecino = await buscarPorId(Vecino, id, "El vecino no existe", { transaction, lock: transaction.LOCK.UPDATE });

    const [animales, reportes, notificaciones] = await Promise.all([
      Animal.count({ where: { vecino_id: id }, transaction }),
      ReporteAvistamiento.count({ where: { vecino_id: id }, transaction }),
      Notificacion.count({ where: { vecino_id: id }, transaction }),
    ]);
    if (animales + reportes + notificaciones === 0) {
      await vecino.destroy({ transaction });
      return { resultado: "eliminado" };
    }
    if (!vecino.activo) {
      throw new ReglaNegocioError("El vecino ya está dado de baja");
    }

    await vecino.update({ activo: false, fecha_baja: hoyLocal() }, { transaction });

    // Turnos activos de los animales del vecino.
    const turnosActivos = await Turno.findAll({
      attributes: ["id"],
      where: { estado: { [Op.in]: ESTADOS_TURNO_ACTIVOS } },
      include: [{ association: "animal", where: { vecino_id: id }, attributes: [] }],
      transaction,
    });
    const idsTurnos = turnosActivos.map((turno) => turno.id);
    if (idsTurnos.length > 0) {
      await Turno.update(
        { estado: "cancelado", motivo_cancelacion: MOTIVOS_CANCELACION.bajaVecino },
        { where: { id: idsTurnos }, transaction },
      );
      await anularRecordatorios(idsTurnos, transaction);
    }
    return { resultado: "desactivado", turnosCancelados: idsTurnos.length };
  });
}

/** Reactiva a un vecino dado de baja (sus turnos cancelados no se restauran). */
export async function reactivarVecino(id: number): Promise<VecinoDto> {
  return sequelize.transaction(async (transaction) => {
    const vecino = await buscarVecino(id, transaction);
    if (vecino.activo) {
      throw new ReglaNegocioError("El vecino ya está activo");
    }
    await vecino.update({ activo: true, fecha_baja: null }, { transaction });
    return aDto(vecino);
  });
}
