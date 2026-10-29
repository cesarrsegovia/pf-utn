import type { EstadoAvistamiento, EstadoEnvio, EstadoOperativo, EstadoTurno } from "@/lib/constantes";
import {
  ETIQUETAS_ESTADO_AVISTAMIENTO, ETIQUETAS_ESTADO_ENVIO, ETIQUETAS_ESTADO_OPERATIVO, ETIQUETAS_ESTADO_TURNO,
} from "@/lib/etiquetas";
import { BadgeEstado, type TonoEstado } from "./badge-estado";

/** Color de cada estado de operativo, turno, envío y avistamiento (spec §6: badges de color por estado). */
const TONOS_OPERATIVO: Record<EstadoOperativo, TonoEstado> = {
  programado: "info",
  en_curso: "alerta",
  realizado: "exito",
  cancelado: "neutro",
};
const TONOS_TURNO: Record<EstadoTurno, TonoEstado> = {
  pendiente: "alerta",
  confirmado: "info",
  completado: "exito",
  cancelado: "neutro",
};
const TONOS_ENVIO: Record<EstadoEnvio, TonoEstado> = {
  pendiente: "alerta",
  enviado: "exito",
  fallido: "peligro",
  anulado: "neutro",
};
const TONOS_AVISTAMIENTO: Record<EstadoAvistamiento, TonoEstado> = {
  pendiente: "alerta",
  atendido: "exito",
};

/** Estado de un operativo (F4). */
export function BadgeOperativo({ estado }: { estado: EstadoOperativo }) {
  return <BadgeEstado texto={ETIQUETAS_ESTADO_OPERATIVO[estado]} tono={TONOS_OPERATIVO[estado]} />;
}

/** Estado de un turno (F3). */
export function BadgeTurno({ estado }: { estado: EstadoTurno }) {
  return <BadgeEstado texto={ETIQUETAS_ESTADO_TURNO[estado]} tono={TONOS_TURNO[estado]} />;
}

/** Estado de envío de una notificación (F12). */
export function BadgeEnvio({ estado }: { estado: EstadoEnvio }) {
  return <BadgeEstado texto={ETIQUETAS_ESTADO_ENVIO[estado]} tono={TONOS_ENVIO[estado]} />;
}

/** Estado de un reporte de avistamiento (F9). */
export function BadgeAvistamiento({ estado }: { estado: EstadoAvistamiento }) {
  return <BadgeEstado texto={ETIQUETAS_ESTADO_AVISTAMIENTO[estado]} tono={TONOS_AVISTAMIENTO[estado]} />;
}
