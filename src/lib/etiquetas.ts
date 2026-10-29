import type {
  CondicionAnimal, EstadoAvistamiento, EstadoEnvio, EstadoOperativo, EstadoTurno, NombreRol, SexoAnimal,
  TipoMovimiento, TipoNotificacion, TipoPersonal, TipoProcedimiento,
} from "./constantes";

/** Textos visibles para los valores de dominio. Cada fase agrega los suyos aquí. */
export const ETIQUETAS_ROL: Record<NombreRol, string> = {
  administrador: "Administrador",
  operador: "Operador",
  veterinario: "Veterinario",
};

export const ETIQUETAS_SEXO: Record<SexoAnimal, string> = {
  M: "Macho",
  H: "Hembra",
};

export const ETIQUETAS_CONDICION: Record<CondicionAnimal, string> = {
  con_tutor: "Con tutor",
  callejero: "Callejero",
  asilvestrado: "Asilvestrado",
};

export const ETIQUETAS_TIPO_PERSONAL: Record<TipoPersonal, string> = {
  veterinario: "Veterinario/a",
  auxiliar: "Auxiliar",
};

export const ETIQUETAS_TIPO_MOVIMIENTO: Record<TipoMovimiento, string> = {
  ingreso: "Ingreso",
  egreso: "Egreso",
};

export const ETIQUETAS_ESTADO_OPERATIVO: Record<EstadoOperativo, string> = {
  programado: "Programado",
  en_curso: "En curso",
  realizado: "Realizado",
  cancelado: "Cancelado",
};

export const ETIQUETAS_ESTADO_TURNO: Record<EstadoTurno, string> = {
  pendiente: "Pendiente",
  confirmado: "Confirmado",
  completado: "Completado",
  cancelado: "Cancelado",
};

export const ETIQUETAS_TIPO_PROCEDIMIENTO: Record<TipoProcedimiento, string> = {
  castracion: "Castración",
  chipeo: "Chipeo",
  castracion_y_chipeo: "Castración y chipeo",
};

export const ETIQUETAS_TIPO_NOTIFICACION: Record<TipoNotificacion, string> = {
  recordatorio: "Recordatorio",
  confirmacion: "Confirmación",
  cancelacion: "Cancelación",
  reprogramacion: "Reprogramación",
};

export const ETIQUETAS_ESTADO_ENVIO: Record<EstadoEnvio, string> = {
  pendiente: "Pendiente",
  enviado: "Enviado",
  fallido: "Fallido",
  anulado: "Anulado",
};

export const ETIQUETAS_ESTADO_AVISTAMIENTO: Record<EstadoAvistamiento, string> = {
  pendiente: "Pendiente",
  atendido: "Atendido",
};

/** Nombre visible de un animal: el registrado o, si no tiene, su número ("Animal #7"). */
export function nombreAnimal(animal: { id: number; nombre: string | null }): string {
  return animal.nombre || `Animal #${animal.id}`;
}

/** Opción de un filtro o lista desplegable con valor de texto. */
export interface OpcionTexto {
  valor: string;
  etiqueta: string;
}

/** Opciones del filtro de estado de los listados con baja lógica (personal y vecinos). */
export const OPCIONES_ESTADO: OpcionTexto[] = [
  { valor: "activos", etiqueta: "Activos" },
  { valor: "inactivos", etiqueta: "Inactivos" },
  { valor: "todos", etiqueta: "Todos" },
];

/** Convierte un mapa de etiquetas en opciones para un `<select>` (en el orden declarado). */
export function opcionesDeEtiquetas<T extends string>(etiquetas: Record<T, string>): OpcionTexto[] {
  return (Object.entries(etiquetas) as Array<[T, string]>).map(([valor, etiqueta]) => ({ valor, etiqueta }));
}
