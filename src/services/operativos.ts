import { Op, type Includeable, type ProjectionAlias, type Transaction } from "sequelize";
import {
  ESTADOS_TURNO_ACTIVOS, ESTADOS_TURNO_CON_CUPO, HORAS_MINIMAS_CANCELACION, MOTIVOS_CANCELACION,
  type EstadoOperativo, type TipoPersonal,
} from "@/lib/constantes";
import { condicionBusqueda } from "@/lib/busqueda";
import { Operativo, OperativoVeterinario, sequelize, Turno, Veterinario, Zona } from "@/lib/db";
import { NoEncontradoError, ReglaNegocioError, ValidacionError } from "@/lib/errores";
import { ETIQUETAS_ESTADO_OPERATIVO } from "@/lib/etiquetas";
import { formatearFecha, horaCorta, hoyLocal, instanteLocal, MS_POR_HORA } from "@/lib/fechas";
import type { Opcion, ResultadoPaginado } from "@/schemas/comun";
import type {
  DatosCancelarOperativo, DatosEstadoOperativo, DatosOperativo, DatosPersonalOperativo,
  ParametrosListadoOperativos,
} from "@/schemas/operativos";
import { buscarPorId, exigirReferencia, paginacion } from "./comun";
import { anularRecordatorios, cargarTurnoNotificable, notificar, programarRecordatorio } from "./notificaciones";

/** Representación pública de un operativo (F4). El cupo ocupado se calcula en la base. */
export interface OperativoDto {
  id: number;
  /** YYYY-MM-DD */
  fecha: string;
  /** HH:MM */
  hora_inicio: string;
  hora_fin: string;
  lugar: string;
  cupo_maximo: number;
  /** Turnos pendientes, confirmados o completados. */
  ocupados: number;
  disponibles: number;
  estado: EstadoOperativo;
  zona_id: number;
  zona: string;
  motivo_cancelacion: string | null;
}

/** Integrante del personal asignado a un operativo. */
export interface PersonalAsignadoDto {
  id: number;
  /** "Apellido, Nombre" */
  nombre: string;
  tipo: TipoPersonal;
  matricula: string | null;
}

/** Detalle de un operativo: datos, cupo y personal asignado. */
export interface OperativoDetalleDto extends OperativoDto {
  personal: PersonalAsignadoDto[];
}

/** Resultado de una cancelación o cambio de estado: cuántos turnos se cancelaron en cascada. */
export interface ResultadoCambioEstado {
  turnosCancelados: number;
}

/** Subconsulta del cupo ocupado. `"Operativo"` es el alias del modelo principal en la consulta. */
const ATRIBUTO_OCUPADOS: ProjectionAlias = [
  sequelize.literal(
    `(SELECT COUNT(*) FROM turno AS t WHERE t.operativo_id = "Operativo"."id" AND t.estado IN (${ESTADOS_TURNO_CON_CUPO.map(
      (estado) => `'${estado}'`,
    ).join(", ")}))`,
  ),
  "ocupados",
];

const INCLUIR_ZONA: Includeable = { association: "zona", attributes: ["id", "nombre"] };
const INCLUIR_PERSONAL: Includeable = {
  association: "personal",
  attributes: ["id", "nombre", "apellido", "tipo", "matricula"],
  through: { attributes: [] },
};

/** Estado en minúsculas para los mensajes ("en curso", "realizado"…). */
const estadoEnTexto = (estado: EstadoOperativo) => ETIQUETAS_ESTADO_OPERATIVO[estado].toLowerCase();

/** Convierte el modelo (con zona y el atributo calculado `ocupados`) al DTO público. */
function aDto(operativo: Operativo): OperativoDto {
  const ocupados = Number(operativo.get("ocupados"));
  return {
    id: operativo.id,
    fecha: operativo.fecha,
    hora_inicio: horaCorta(operativo.hora_inicio),
    hora_fin: horaCorta(operativo.hora_fin),
    lugar: operativo.lugar,
    cupo_maximo: operativo.cupo_maximo,
    ocupados,
    disponibles: Math.max(operativo.cupo_maximo - ocupados, 0),
    estado: operativo.estado,
    zona_id: operativo.zona_id,
    zona: operativo.zona!.nombre,
    motivo_cancelacion: operativo.motivo_cancelacion,
  };
}

/** Obtiene el detalle de un operativo con su personal (404 si no existe). */
async function obtenerDetalle(id: number, transaction?: Transaction): Promise<OperativoDetalleDto> {
  const operativo = await buscarPorId(Operativo, id, "El operativo no existe", {
    attributes: { include: [ATRIBUTO_OCUPADOS] },
    include: [INCLUIR_ZONA, INCLUIR_PERSONAL],
    order: [["personal", "apellido", "ASC"]],
    transaction,
  });
  return {
    ...aDto(operativo),
    personal: (operativo.personal ?? []).map((persona) => ({
      id: persona.id,
      nombre: `${persona.apellido}, ${persona.nombre}`,
      tipo: persona.tipo,
      matricula: persona.matricula,
    })),
  };
}

/** Bloquea la fila del operativo (404 si no existe). */
function bloquearOperativo(id: number, transaction: Transaction): Promise<Operativo> {
  return buscarPorId(Operativo, id, "El operativo no existe", { transaction, lock: transaction.LOCK.UPDATE });
}

/** Los operativos realizados o cancelados ya no admiten cambios. */
function exigirVigente(operativo: Operativo, accion: string): void {
  if (operativo.estado === "realizado" || operativo.estado === "cancelado") {
    throw new ReglaNegocioError(`No se puede ${accion} un operativo ${estadoEnTexto(operativo.estado)}`);
  }
}

/** El inicio (fecha + hora de inicio) debe ser futuro. */
function exigirInicioFuturo(fecha: string, horaInicio: string): void {
  if (instanteLocal(fecha, horaInicio) <= new Date()) {
    throw new ValidacionError("Revise los datos ingresados", { fecha: "La fecha y hora de inicio deben ser futuras" });
  }
}

/**
 * Verifica que ninguna de las personas indicadas esté asignada a otro operativo no cancelado
 * del mismo día con franja superpuesta (inicio_a < fin_b y fin_a > inicio_b).
 */
async function verificarSinSuperposicion(
  franja: { id: number; fecha: string; hora_inicio: string; hora_fin: string },
  veterinarioIds: number[],
  transaction: Transaction,
): Promise<void> {
  if (veterinarioIds.length === 0) return;
  const conflicto = await Operativo.findOne({
    where: {
      id: { [Op.ne]: franja.id },
      fecha: franja.fecha,
      estado: { [Op.ne]: "cancelado" },
      hora_inicio: { [Op.lt]: franja.hora_fin },
      hora_fin: { [Op.gt]: franja.hora_inicio },
    },
    include: [
      { association: "personal", where: { id: veterinarioIds }, attributes: ["nombre", "apellido"], through: { attributes: [] } },
    ],
    // Sin subconsulta: findOne agrega LIMIT 1 y el filtro está en la tabla incluida.
    subQuery: false,
    transaction,
  });
  if (conflicto) {
    const persona = conflicto.personal![0];
    throw new ReglaNegocioError(
      `${persona.apellido}, ${persona.nombre} ya está asignado a otro operativo el ${formatearFecha(franja.fecha)} ` +
        `de ${horaCorta(conflicto.hora_inicio)} a ${horaCorta(conflicto.hora_fin)}`,
    );
  }
}

/** Cancela los turnos activos del operativo con el motivo indicado y anula sus recordatorios. */
async function cancelarTurnosActivos(operativoId: number, motivo: string, transaction: Transaction): Promise<number[]> {
  const activos = await Turno.findAll({
    attributes: ["id"],
    where: { operativo_id: operativoId, estado: { [Op.in]: ESTADOS_TURNO_ACTIVOS } },
    // Se bloquean las filas (sin include) para no pisar una confirmación o cancelación
    // de turno concurrente, que solo bloquea el turno y no el operativo.
    lock: transaction.LOCK.UPDATE,
    transaction,
  });
  const ids = activos.map((turno) => turno.id);
  if (ids.length > 0) {
    await Turno.update({ estado: "cancelado", motivo_cancelacion: motivo }, { where: { id: ids }, transaction });
    await anularRecordatorios(ids, transaction);
  }
  return ids;
}

/** Atributos del modelo a partir del formulario. */
function aAtributos(datos: DatosOperativo) {
  return {
    fecha: datos.fecha,
    hora_inicio: datos.hora_inicio,
    hora_fin: datos.hora_fin,
    lugar: datos.lugar,
    cupo_maximo: datos.cupo_maximo,
    zona_id: datos.zona_id,
  };
}

/** Listado paginado: próximos (ascendente), pasados o todos (descendente), con filtros. */
export async function listarOperativos(
  parametros: ParametrosListadoOperativos,
): Promise<ResultadoPaginado<OperativoDto>> {
  const hoy = hoyLocal();
  const periodo = {
    proximos: { fecha: { [Op.gte]: hoy } },
    pasados: { fecha: { [Op.lt]: hoy } },
    todos: {},
  }[parametros.periodo];
  const direccion = parametros.periodo === "proximos" ? "ASC" : "DESC";

  const { rows, count } = await Operativo.findAndCountAll({
    attributes: { include: [ATRIBUTO_OCUPADOS] },
    where: {
      [Op.and]: [
        condicionBusqueda(["Operativo.lugar", "zona.nombre"], parametros.busqueda),
        periodo,
        parametros.estado ? { estado: parametros.estado } : {},
        parametros.zona_id ? { zona_id: parametros.zona_id } : {},
      ],
    },
    include: [INCLUIR_ZONA],
    order: [["fecha", direccion], ["hora_inicio", direccion]],
    ...paginacion(parametros),
  });
  return { filas: rows.map(aDto), total: count, pagina: parametros.pagina, tamanio: parametros.tamanio };
}

/** Operativos programados de hoy en adelante, en orden cronológico y con su cupo calculado. */
async function programadosVigentes(): Promise<OperativoDto[]> {
  const operativos = await Operativo.findAll({
    attributes: { include: [ATRIBUTO_OCUPADOS] },
    where: { estado: "programado", fecha: { [Op.gte]: hoyLocal() } },
    include: [INCLUIR_ZONA],
    order: [["fecha", "ASC"], ["hora_inicio", "ASC"]],
  });
  return operativos.map(aDto);
}

/** Operativos que admiten turnos (programados, de hoy en adelante) para las listas desplegables. */
export async function opcionesOperativos(): Promise<Opcion[]> {
  return (await programadosVigentes()).map((o) => ({
    id: o.id,
    etiqueta: `${formatearFecha(o.fecha)} ${o.hora_inicio}–${o.hora_fin} · ${o.zona} · ${o.lugar} (${o.disponibles} libres)`,
  }));
}

/** Próximos operativos programados que todavía tienen cupo disponible (dashboard). */
export async function proximosOperativosConCupo(limite: number): Promise<OperativoDto[]> {
  return (await programadosVigentes()).filter((operativo) => operativo.disponibles > 0).slice(0, limite);
}

/**
 * Operativos no cancelados de una zona, del más reciente al más antiguo, para asociarlos
 * a la atención de un reporte de avistamiento (F9).
 */
export async function opcionesOperativosDeZona(zonaId: number): Promise<Opcion[]> {
  const operativos = await Operativo.findAll({
    where: { zona_id: zonaId, estado: { [Op.ne]: "cancelado" } },
    order: [["fecha", "DESC"], ["hora_inicio", "DESC"]],
    limit: 30,
  });
  return operativos.map((operativo) => {
    const horario = `${horaCorta(operativo.hora_inicio)}–${horaCorta(operativo.hora_fin)}`;
    // estadoEnTexto recibe un EstadoOperativo tipado: evita el TS7053 de indexar con CreationOptional (L1).
    const estado = estadoEnTexto(operativo.estado);
    return { id: operativo.id, etiqueta: `${formatearFecha(operativo.fecha)} ${horario} · ${operativo.lugar} (${estado})` };
  });
}

/** Detalle de un operativo (404 si no existe). */
export function obtenerOperativo(id: number): Promise<OperativoDetalleDto> {
  return obtenerDetalle(id);
}

/** Alta de operativo: inicio futuro y zona existente; queda programado. */
export async function crearOperativo(datos: DatosOperativo): Promise<OperativoDetalleDto> {
  return sequelize.transaction(async (transaction) => {
    exigirInicioFuturo(datos.fecha, datos.hora_inicio);
    await exigirReferencia(Zona, datos.zona_id, "zona_id", "La zona seleccionada no existe", transaction);
    const operativo = await Operativo.create(aAtributos(datos), { transaction });
    return obtenerDetalle(operativo.id, transaction);
  });
}

/**
 * Edición (F4). No se editan operativos realizados ni cancelados; fecha y horario solo
 * cambian mientras está programado. El cupo no puede quedar por debajo de los turnos
 * ocupados ni la franja dejar turnos activos afuera. Si cambian fecha, horario, lugar o
 * zona, cada turno activo recibe aviso de reprogramación y su recordatorio se recalcula.
 */
export async function actualizarOperativo(id: number, datos: DatosOperativo): Promise<OperativoDetalleDto> {
  return sequelize.transaction(async (transaction) => {
    const operativo = await bloquearOperativo(id, transaction);
    exigirVigente(operativo, "editar");
    await exigirReferencia(Zona, datos.zona_id, "zona_id", "La zona seleccionada no existe", transaction);

    const cambiaFechaHorario =
      operativo.fecha !== datos.fecha ||
      horaCorta(operativo.hora_inicio) !== datos.hora_inicio ||
      horaCorta(operativo.hora_fin) !== datos.hora_fin;
    const cambiaLugar = operativo.lugar !== datos.lugar || operativo.zona_id !== datos.zona_id;

    if (cambiaFechaHorario) {
      if (operativo.estado !== "programado") {
        throw new ReglaNegocioError("La fecha y el horario solo se pueden cambiar en operativos programados");
      }
      exigirInicioFuturo(datos.fecha, datos.hora_inicio);
    }

    const ocupados = await Turno.count({
      where: { operativo_id: id, estado: { [Op.in]: ESTADOS_TURNO_CON_CUPO } },
      transaction,
    });
    if (datos.cupo_maximo < ocupados) {
      throw new ValidacionError("Revise los datos ingresados", {
        cupo_maximo: `No puede ser menor a los ${ocupados} turnos ya asignados`,
      });
    }

    const activos = await Turno.findAll({
      attributes: ["id", "horario"],
      where: { operativo_id: id, estado: { [Op.in]: ESTADOS_TURNO_ACTIVOS } },
      transaction,
    });
    const fuera = activos.filter(
      (turno) => horaCorta(turno.horario) < datos.hora_inicio || horaCorta(turno.horario) >= datos.hora_fin,
    ).length;
    if (fuera > 0) {
      throw new ReglaNegocioError(
        `${fuera} ${fuera === 1 ? "turno quedaría" : "turnos quedarían"} fuera del nuevo horario: reprográmelos antes de cambiarlo`,
      );
    }

    if (cambiaFechaHorario) {
      const asignados = await OperativoVeterinario.findAll({ where: { operativo_id: id }, transaction });
      await verificarSinSuperposicion(
        { id, ...datos },
        asignados.map((asignacion) => asignacion.veterinario_id),
        transaction,
      );
    }

    await operativo.update(aAtributos(datos), { transaction });

    if (cambiaFechaHorario || cambiaLugar) {
      const ids = activos.map((turno) => turno.id);
      await anularRecordatorios(ids, transaction);
      for (const turnoId of ids) {
        const notificable = await cargarTurnoNotificable(turnoId, transaction);
        await notificar(notificable, "reprogramacion", transaction);
        await programarRecordatorio(notificable, transaction);
      }
    }
    return obtenerDetalle(id, transaction);
  });
}

/** Asigna un integrante activo del personal, sin superposición horaria con otro operativo. */
export async function asignarPersonal(id: number, datos: DatosPersonalOperativo): Promise<OperativoDetalleDto> {
  return sequelize.transaction(async (transaction) => {
    const operativo = await bloquearOperativo(id, transaction);
    exigirVigente(operativo, "modificar el personal de");
    const persona = await exigirReferencia(
      Veterinario, datos.veterinario_id, "veterinario_id", "El integrante seleccionado no existe", transaction,
    );
    if (!persona.activo) {
      throw new ValidacionError("Revise los datos ingresados", { veterinario_id: "Solo se puede asignar personal activo" });
    }
    const yaAsignado = await OperativoVeterinario.count({
      where: { operativo_id: id, veterinario_id: persona.id },
      transaction,
    });
    if (yaAsignado > 0) {
      throw new ValidacionError("Revise los datos ingresados", { veterinario_id: "Ya está asignado a este operativo" });
    }
    await verificarSinSuperposicion(operativo, [persona.id], transaction);
    await OperativoVeterinario.create({ operativo_id: id, veterinario_id: persona.id }, { transaction });
    return obtenerDetalle(id, transaction);
  });
}

/** Quita a un integrante del personal de un operativo vigente. */
export async function quitarPersonal(id: number, datos: DatosPersonalOperativo): Promise<OperativoDetalleDto> {
  return sequelize.transaction(async (transaction) => {
    const operativo = await bloquearOperativo(id, transaction);
    exigirVigente(operativo, "modificar el personal de");
    const quitados = await OperativoVeterinario.destroy({
      where: { operativo_id: id, veterinario_id: datos.veterinario_id },
      transaction,
    });
    if (quitados === 0) {
      throw new NoEncontradoError("El integrante no está asignado a este operativo");
    }
    return obtenerDetalle(id, transaction);
  });
}

/**
 * Cancelación (F4, solo administrador). Requiere 48 h de anticipación al inicio; con
 * "fuerza mayor" alcanza con que no haya comenzado. En la misma transacción: estado,
 * fecha y usuario de la cancelación; turnos activos cancelados; recordatorios anulados;
 * aviso de cancelación (con el motivo) a cada vecino con correo.
 */
export async function cancelarOperativo(
  id: number,
  datos: DatosCancelarOperativo,
  usuarioId: number,
): Promise<ResultadoCambioEstado> {
  return sequelize.transaction(async (transaction) => {
    const operativo = await bloquearOperativo(id, transaction);
    if (operativo.estado === "cancelado") {
      throw new ReglaNegocioError("El operativo ya está cancelado");
    }
    if (operativo.estado !== "programado") {
      throw new ReglaNegocioError(`No se puede cancelar un operativo ${estadoEnTexto(operativo.estado)}`);
    }

    const ahora = new Date();
    const inicio = instanteLocal(operativo.fecha, operativo.hora_inicio);
    if (datos.fuerza_mayor) {
      if (inicio <= ahora) {
        throw new ReglaNegocioError("El operativo ya comenzó: no se puede cancelar");
      }
    } else if (inicio.getTime() - ahora.getTime() < HORAS_MINIMAS_CANCELACION * MS_POR_HORA) {
      throw new ReglaNegocioError(
        `Faltan menos de ${HORAS_MINIMAS_CANCELACION} h para el inicio: solo se puede cancelar por fuerza mayor ` +
          "(marque la casilla y justifíquela en el motivo)",
      );
    }

    await operativo.update(
      { estado: "cancelado", motivo_cancelacion: datos.motivo, fecha_cancelacion: ahora, usuario_cancelacion_id: usuarioId },
      { transaction },
    );
    const ids = await cancelarTurnosActivos(id, MOTIVOS_CANCELACION.operativoCancelado, transaction);
    for (const turnoId of ids) {
      const notificable = await cargarTurnoNotificable(turnoId, transaction);
      await notificar(notificable, "cancelacion", transaction, datos.motivo);
    }
    return { turnosCancelados: ids.length };
  });
}

/**
 * Cambio de estado manual: programado → en curso (solo el día del operativo) y
 * en curso → realizado (los turnos que siguen activos se cancelan con "No se presentó").
 */
export async function cambiarEstadoOperativo(id: number, datos: DatosEstadoOperativo): Promise<ResultadoCambioEstado> {
  return sequelize.transaction(async (transaction) => {
    const operativo = await bloquearOperativo(id, transaction);

    if (datos.estado === "en_curso") {
      if (operativo.estado !== "programado") {
        throw new ReglaNegocioError("Solo se puede iniciar un operativo programado");
      }
      if (operativo.fecha !== hoyLocal()) {
        throw new ReglaNegocioError(`El operativo solo se puede iniciar el día programado (${formatearFecha(operativo.fecha)})`);
      }
      await operativo.update({ estado: "en_curso" }, { transaction });
      return { turnosCancelados: 0 };
    }

    if (operativo.estado !== "en_curso") {
      throw new ReglaNegocioError("Solo se puede finalizar un operativo en curso");
    }
    await operativo.update({ estado: "realizado" }, { transaction });
    const ids = await cancelarTurnosActivos(id, MOTIVOS_CANCELACION.noSePresento, transaction);
    return { turnosCancelados: ids.length };
  });
}
