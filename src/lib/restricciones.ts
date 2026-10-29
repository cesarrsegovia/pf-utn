/**
 * Mensajes en español para las restricciones con nombre de la migración 0001.
 * Son el último resguardo: los servicios validan antes, pero si una regla llega a la
 * base (por ejemplo, por concurrencia), el usuario igual recibe un mensaje comprensible.
 */
const MENSAJES_RESTRICCION: Record<string, string> = {
  // Unicidad
  uq_usuario_email: "Ya existe un usuario con ese email",
  uq_zona_nombre: "Ya existe una zona con ese nombre",
  uq_vecino_dni: "Ya existe un vecino con ese DNI",
  uq_animal_chip: "Ya existe un animal con ese número de chip",
  uq_veterinario_matricula: "Ya existe personal con esa matrícula",
  uq_veterinario_usuario: "Ese usuario ya está vinculado a otro integrante del personal",
  uq_insumo_nombre: "Ya existe un insumo con ese nombre",
  uq_procedimiento_turno: "El turno ya tiene un procedimiento registrado",
  uq_procedimiento_chip: "Ese número de chip ya fue colocado",
  ux_turno_activo_por_animal: "El animal ya tiene un turno pendiente o confirmado",
  // Claves foráneas (al eliminar registros referenciados)
  fk_usuario_rol: "El rol indicado no existe",
  fk_vecino_zona: "La zona tiene vecinos asociados",
  fk_operativo_zona: "La zona tiene operativos asociados",
  fk_reporte_zona: "La zona tiene reportes de avistamiento asociados",
  fk_animal_vecino: "El vecino tiene animales asociados",
  fk_turno_animal: "El animal tiene turnos asociados",
  fk_turno_operativo: "El operativo tiene turnos asociados",
  fk_movimiento_insumo: "El insumo tiene movimientos de stock registrados",
  fk_pi_insumo: "El insumo fue usado en procedimientos",
  fk_procedimiento_veterinario: "El integrante del personal tiene procedimientos registrados",
};

/** Mensaje para una restricción violada, o uno genérico si no está mapeada. */
export function mensajeDeRestriccion(nombre: string | undefined, porDefecto: string): string {
  return (nombre && MENSAJES_RESTRICCION[nombre]) || porDefecto;
}
