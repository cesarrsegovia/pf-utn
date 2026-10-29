import type { NombreRol } from "./constantes";

/**
 * Acciones controladas del sistema. Convención: `<módulo>:<operación>`.
 * "ver" = solo lectura; "gestionar" = alta, modificación y baja.
 */
export const ACCIONES = [
  "dashboard:ver",
  "vecinos:ver", "vecinos:gestionar",
  "animales:ver", "animales:gestionar",
  "turnos:ver", "turnos:gestionar",
  "operativos:ver", "operativos:gestionar", "operativos:cancelar",
  "personal:ver", "personal:gestionar",
  "insumos:ver", "insumos:gestionar",
  "procedimientos:registrar",
  "historial:ver",
  "avistamientos:ver", "avistamientos:gestionar",
  "zonas:ver", "zonas:gestionar",
  "usuarios:gestionar",
  "notificaciones:ver", "notificaciones:gestionar",
  "reportes:ver",
] as const;
export type Accion = (typeof ACCIONES)[number];

/** Matriz rol → acciones permitidas (spec §4). */
const PERMISOS_POR_ROL: Record<NombreRol, ReadonlySet<Accion>> = {
  // El administrador puede todo, salvo registrar procedimientos (exclusivo de veterinarios).
  administrador: new Set(ACCIONES.filter((accion) => accion !== "procedimientos:registrar")),
  operador: new Set<Accion>([
    "dashboard:ver",
    "vecinos:ver", "vecinos:gestionar",
    "animales:ver", "animales:gestionar",
    "turnos:ver", "turnos:gestionar",
    "operativos:ver", "operativos:gestionar",
    "personal:ver",
    "insumos:ver", "insumos:gestionar",
    "historial:ver",
    "avistamientos:ver", "avistamientos:gestionar",
    "zonas:ver",
    "notificaciones:ver",
    "reportes:ver",
  ]),
  veterinario: new Set<Accion>([
    "dashboard:ver",
    "vecinos:ver", "animales:ver", "turnos:ver", "operativos:ver",
    "personal:ver", "insumos:ver",
    "procedimientos:registrar",
    "historial:ver", "avistamientos:ver", "zonas:ver",
  ]),
};

/** Indica si un rol puede ejecutar una acción. */
export function tienePermiso(rol: NombreRol, accion: Accion): boolean {
  return PERMISOS_POR_ROL[rol].has(accion);
}
