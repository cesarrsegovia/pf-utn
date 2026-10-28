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
