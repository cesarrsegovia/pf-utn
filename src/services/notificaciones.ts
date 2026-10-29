import { Op, type Transaction } from "sequelize";
import { HORAS_RECORDATORIO, type EstadoEnvio, type TipoNotificacion } from "@/lib/constantes";
import { condicionBusqueda } from "@/lib/busqueda";
import { Notificacion, sequelize, Turno, Vecino } from "@/lib/db";
import { ReglaNegocioError } from "@/lib/errores";
import { ETIQUETAS_TIPO_PROCEDIMIENTO, nombreAnimal } from "@/lib/etiquetas";
import { formatearFecha, horaCorta, instanteLocal, MS_POR_HORA, sumarDias } from "@/lib/fechas";
import { ASUNTOS_NOTIFICACION, enviarCorreo, type Correo } from "@/lib/mailer";
import type { ResultadoPaginado } from "@/schemas/comun";
import type { ParametrosListadoNotificaciones } from "@/schemas/notificaciones";
import { buscarPorId, paginacion } from "./comun";

/** Representación pública de una notificación (F12). Las fechas viajan en ISO 8601. */
export interface NotificacionDto {
  id: number;
  tipo: TipoNotificacion;
  estado_envio: EstadoEnvio;
  mensaje: string;
  fecha_programada: string;
  fecha_envio: string | null;
  turno_id: number;
  /** "Apellido, Nombre" del vecino destinatario. */
  vecino: string;
  email: string | null;
}

/** Resultado de una ejecución del procesador de envío. */
export interface ResultadoProcesamiento {
  enviadas: number;
  fallidas: number;
}

/** Cantidad máxima de notificaciones que envía cada ejecución del procesador. */
const LOTE_ENVIO = 50;

/* ───────────────────────── Generación (dentro de las transacciones de F3/F4) ───────────────────────── */

/**
 * Carga un turno con lo necesario para redactar un aviso: animal con su tutor y
 * operativo con su zona. Se llama después de bloquear y actualizar el turno.
 */
export async function cargarTurnoNotificable(turnoId: number, transaction: Transaction): Promise<Turno> {
  const turno = await Turno.findByPk(turnoId, {
    include: [
      { association: "animal", include: [{ association: "vecino" }] },
      { association: "operativo", include: [{ association: "zona" }] },
    ],
    transaction,
  });
  return turno!;
}

/** Redacta el cuerpo del correo según el tipo de notificación. */
function redactarMensaje(tipo: TipoNotificacion, turno: Turno, motivo?: string): string {
  const animal = turno.animal!;
  const operativo = turno.operativo!;
  const servicio = ETIQUETAS_TIPO_PROCEDIMIENTO[turno.tipo_solicitado].toLowerCase();
  const sujeto = `el turno de ${servicio} de ${nombreAnimal(animal)}`;
  const cuando = `el ${formatearFecha(operativo.fecha)} a las ${horaCorta(turno.horario)} h`;
  const donde = `en ${operativo.lugar} (${operativo.zona!.nombre})`;

  const cuerpos: Record<TipoNotificacion, string> = {
    confirmacion: `Le confirmamos ${sujeto} ${cuando} ${donde}.`,
    recordatorio: `Le recordamos que mañana tiene ${sujeto} ${cuando} ${donde}.`,
    reprogramacion: `Le informamos que ${sujeto} fue reprogramado para ${cuando} ${donde}.`,
    cancelacion: `Le informamos que ${sujeto} previsto para ${cuando} fue cancelado. Motivo: ${motivo ?? "no informado"}.`,
  };
  return `Hola ${animal.vecino!.nombre}:\n\n${cuerpos[tipo]}\n\nZoonosis – Municipio de Río Grande`;
}

/**
 * Registra un aviso inmediato (confirmación, reprogramación o cancelación) para el tutor
 * del turno. No se genera si el animal no tiene tutor o el tutor no tiene email (F12).
 * `turno` debe venir de `cargarTurnoNotificable()`.
 */
export async function notificar(
  turno: Turno,
  tipo: Exclude<TipoNotificacion, "recordatorio">,
  transaction: Transaction,
  motivo?: string,
): Promise<void> {
  const vecino = turno.animal?.vecino;
  if (!vecino?.email) return;
  await Notificacion.create(
    {
      tipo,
      mensaje: redactarMensaje(tipo, turno, motivo),
      fecha_programada: new Date(),
      turno_id: turno.id,
      vecino_id: vecino.id,
    },
    { transaction },
  );
}

/**
 * Programa el recordatorio 24 h antes de un turno confirmado. Si ese momento ya pasó
 * (turno muy próximo), no se programa. `turno` debe venir de `cargarTurnoNotificable()`.
 */
export async function programarRecordatorio(turno: Turno, transaction: Transaction): Promise<void> {
  const vecino = turno.animal?.vecino;
  if (turno.estado !== "confirmado" || !vecino?.email) return;

  const inicioTurno = instanteLocal(turno.operativo!.fecha, turno.horario);
  const momento = new Date(inicioTurno.getTime() - HORAS_RECORDATORIO * MS_POR_HORA);
  if (momento <= new Date()) return;

  await Notificacion.create(
    {
      tipo: "recordatorio",
      mensaje: redactarMensaje("recordatorio", turno),
      fecha_programada: momento,
      turno_id: turno.id,
      vecino_id: vecino.id,
    },
    { transaction },
  );
}

/**
 * Anula los recordatorios todavía no enviados (pendientes o fallidos) de los turnos
 * indicados: el turno fue cancelado, reprogramado o completado. No se borran (trazabilidad).
 */
export async function anularRecordatorios(turnoIds: number[], transaction: Transaction): Promise<void> {
  if (turnoIds.length === 0) return;
  await Notificacion.update(
    { estado_envio: "anulado" },
    {
      where: { turno_id: turnoIds, tipo: "recordatorio", estado_envio: { [Op.in]: ["pendiente", "fallido"] } },
      transaction,
    },
  );
}

/* ───────────────────────── Envío ───────────────────────── */

/**
 * Procesador de envío (F12): toma las notificaciones pendientes cuya fecha programada ya
 * llegó, las envía y las marca como enviadas (con fecha de envío) o fallidas.
 * Las filas se bloquean con FOR UPDATE SKIP LOCKED: si el temporizador y el botón
 * "Procesar pendientes" coinciden, cada notificación la envía una sola ejecución.
 * `enviar` se puede reemplazar en los tests para no usar SMTP real.
 */
export async function procesarPendientes(
  enviar: (correo: Correo) => Promise<void> = enviarCorreo,
): Promise<ResultadoProcesamiento> {
  return sequelize.transaction(async (transaction) => {
    const pendientes = await Notificacion.findAll({
      where: { estado_envio: "pendiente", fecha_programada: { [Op.lte]: new Date() } },
      order: [["fecha_programada", "ASC"], ["id", "ASC"]],
      limit: LOTE_ENVIO,
      lock: transaction.LOCK.UPDATE,
      skipLocked: true,
      transaction,
    });
    if (pendientes.length === 0) return { enviadas: 0, fallidas: 0 };

    // Emails actuales de los destinatarios (se consultan aparte: no se combina lock con include).
    const vecinos = await Vecino.findAll({
      attributes: ["id", "email"],
      where: { id: [...new Set(pendientes.map((notificacion) => notificacion.vecino_id))] },
      transaction,
    });
    const emails = new Map(vecinos.map((vecino) => [vecino.id, vecino.email]));

    const resultado: ResultadoProcesamiento = { enviadas: 0, fallidas: 0 };
    for (const notificacion of pendientes) {
      try {
        const para = emails.get(notificacion.vecino_id);
        if (!para) throw new Error("El vecino no tiene email registrado");
        await enviar({ para, asunto: ASUNTOS_NOTIFICACION[notificacion.tipo], texto: notificacion.mensaje });
        await notificacion.update({ estado_envio: "enviado", fecha_envio: new Date() }, { transaction });
        resultado.enviadas += 1;
      } catch (error) {
        console.error(`No se pudo enviar la notificación ${notificacion.id}:`, error);
        await notificacion.update({ estado_envio: "fallido" }, { transaction });
        resultado.fallidas += 1;
      }
    }
    return resultado;
  });
}

/** Vuelve a poner en cola una notificación fallida (se envía en la próxima ejecución). */
export async function reintentarNotificacion(id: number): Promise<void> {
  await sequelize.transaction(async (transaction) => {
    const notificacion = await buscarPorId(Notificacion, id, "La notificación no existe", {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (notificacion.estado_envio !== "fallido") {
      throw new ReglaNegocioError("Solo se pueden reintentar las notificaciones fallidas");
    }
    await notificacion.update({ estado_envio: "pendiente", fecha_programada: new Date() }, { transaction });
  });
}

/* ───────────────────────── Consulta ───────────────────────── */

/** Listado paginado (más recientes primero) con búsqueda por vecino y filtros de tipo, estado y fechas. */
export async function listarNotificaciones(
  parametros: ParametrosListadoNotificaciones,
): Promise<ResultadoPaginado<NotificacionDto>> {
  const { rows, count } = await Notificacion.findAndCountAll({
    where: {
      [Op.and]: [
        condicionBusqueda(["vecino.apellido", "vecino.nombre", "vecino.email"], parametros.busqueda),
        parametros.tipo ? { tipo: parametros.tipo } : {},
        parametros.estado ? { estado_envio: parametros.estado } : {},
        // Rango de días locales: desde las 00:00 de "desde" hasta antes de las 00:00 del día siguiente a "hasta".
        parametros.desde ? { fecha_programada: { [Op.gte]: instanteLocal(parametros.desde, "00:00") } } : {},
        parametros.hasta
          ? { fecha_programada: { [Op.lt]: instanteLocal(sumarDias(parametros.hasta, 1), "00:00") } }
          : {},
      ],
    },
    include: [{ association: "vecino", attributes: ["id", "nombre", "apellido", "email"] }],
    order: [["fecha_programada", "DESC"], ["id", "DESC"]],
    ...paginacion(parametros),
  });
  return {
    filas: rows.map((notificacion) => ({
      id: notificacion.id,
      tipo: notificacion.tipo,
      estado_envio: notificacion.estado_envio,
      mensaje: notificacion.mensaje,
      fecha_programada: notificacion.fecha_programada.toISOString(),
      fecha_envio: notificacion.fecha_envio?.toISOString() ?? null,
      turno_id: notificacion.turno_id,
      vecino: `${notificacion.vecino!.apellido}, ${notificacion.vecino!.nombre}`,
      email: notificacion.vecino!.email,
    })),
    total: count,
    pagina: parametros.pagina,
    tamanio: parametros.tamanio,
  };
}
