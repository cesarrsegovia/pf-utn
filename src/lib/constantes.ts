/**
 * Valores permitidos de los campos de tipo y estado del modelo de datos.
 * Es la fuente única que usan los esquemas de validación y la interfaz;
 * la base de datos los refuerza con restricciones CHECK (ver migración 0001).
 */

export const ROLES = ["administrador", "operador", "veterinario"] as const;
export type NombreRol = (typeof ROLES)[number];

export const SEXOS_ANIMAL = ["M", "H"] as const;
export type SexoAnimal = (typeof SEXOS_ANIMAL)[number];

export const CONDICIONES_ANIMAL = ["con_tutor", "callejero", "asilvestrado"] as const;
export type CondicionAnimal = (typeof CONDICIONES_ANIMAL)[number];

export const TIPOS_PERSONAL = ["veterinario", "auxiliar"] as const;
export type TipoPersonal = (typeof TIPOS_PERSONAL)[number];

export const ESTADOS_OPERATIVO = ["programado", "en_curso", "realizado", "cancelado"] as const;
export type EstadoOperativo = (typeof ESTADOS_OPERATIVO)[number];

/** Se usa tanto para el tipo solicitado en un turno como para el procedimiento realizado. */
export const TIPOS_PROCEDIMIENTO = ["castracion", "chipeo", "castracion_y_chipeo"] as const;
export type TipoProcedimiento = (typeof TIPOS_PROCEDIMIENTO)[number];

export const ESTADOS_TURNO = ["pendiente", "confirmado", "completado", "cancelado"] as const;
export type EstadoTurno = (typeof ESTADOS_TURNO)[number];

export const TIPOS_MOVIMIENTO = ["ingreso", "egreso"] as const;
export type TipoMovimiento = (typeof TIPOS_MOVIMIENTO)[number];

export const ESTADOS_AVISTAMIENTO = ["pendiente", "atendido"] as const;
export type EstadoAvistamiento = (typeof ESTADOS_AVISTAMIENTO)[number];

export const TIPOS_NOTIFICACION = ["recordatorio", "confirmacion", "cancelacion", "reprogramacion"] as const;
export type TipoNotificacion = (typeof TIPOS_NOTIFICACION)[number];

/** `anulado` registra recordatorios que dejaron de valer (turno cancelado o reprogramado). */
export const ESTADOS_ENVIO = ["pendiente", "enviado", "fallido", "anulado"] as const;
export type EstadoEnvio = (typeof ESTADOS_ENVIO)[number];

/** Zona horaria oficial de Río Grande (UTC-3, sin horario de verano). */
export const ZONA_HORARIA = "America/Argentina/Ushuaia";

/** Motivos de cancelación de turnos generados automáticamente por el sistema. */
export const MOTIVOS_CANCELACION = {
  /** F1: el vecino fue dado de baja (cascada sobre sus turnos activos). */
  bajaVecino: "Baja del vecino",
  /** F4: el operativo finalizó y el turno seguía pendiente o confirmado. */
  noSePresento: "No se presentó",
  /** F4: el administrador canceló el operativo (su motivo queda en el operativo). */
  operativoCancelado: "Cancelación del operativo",
} as const;

/** Estados de turno que ocupan un lugar del cupo del operativo (los cancelados lo liberan). */
export const ESTADOS_TURNO_CON_CUPO = ["pendiente", "confirmado", "completado"] as const;

/** Estados de turno activos: se pueden confirmar, reprogramar o cancelar. */
export const ESTADOS_TURNO_ACTIVOS = ["pendiente", "confirmado"] as const;

/** Indica si un turno sigue activo (pendiente o confirmado). */
export function esTurnoActivo(estado: EstadoTurno): boolean {
  return estado === "pendiente" || estado === "confirmado";
}

/** Anticipación mínima para cancelar un operativo sin invocar fuerza mayor (F4). */
export const HORAS_MINIMAS_CANCELACION = 48;

/** Anticipación con la que se programa el recordatorio de un turno confirmado (F3/F12). */
export const HORAS_RECORDATORIO = 24;

/** Indica si el tipo solicitado o realizado incluye castración. */
export function incluyeCastracion(tipo: TipoProcedimiento): boolean {
  return tipo !== "chipeo";
}

/** Indica si el tipo solicitado o realizado incluye chipeo. */
export function incluyeChipeo(tipo: TipoProcedimiento): boolean {
  return tipo !== "castracion";
}

/**
 * Indica si el tipo realizado está incluido en el solicitado: "castración y chipeo" admite
 * castración, chipeo o ambos; "castración" o "chipeo" solo admiten ese mismo tipo (F7).
 */
export function tipoIncluido(realizado: TipoProcedimiento, solicitado: TipoProcedimiento): boolean {
  return (
    (!incluyeCastracion(realizado) || incluyeCastracion(solicitado)) &&
    (!incluyeChipeo(realizado) || incluyeChipeo(solicitado))
  );
}

