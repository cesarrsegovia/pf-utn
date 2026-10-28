/**
 * Punto de entrada de la capa de datos: importa los 16 modelos, declara sus
 * asociaciones (según el ERD) y los reexporta junto con la instancia de Sequelize.
 * Los servicios deben importar siempre desde aquí para que las asociaciones existan.
 *
 * IMPORTANTE: este módulo depende de `pg`, por lo que nunca debe importarse desde
 * `src/proxy.ts` ni desde código que corra en el Edge Runtime.
 */
import { sequelize } from "./conexion";
import { Animal } from "@/models/animal";
import { HistorialClinico } from "@/models/historial-clinico";
import { Insumo } from "@/models/insumo";
import { MovimientoInsumo } from "@/models/movimiento-insumo";
import { Notificacion } from "@/models/notificacion";
import { Operativo } from "@/models/operativo";
import { OperativoVeterinario } from "@/models/operativo-veterinario";
import { Procedimiento } from "@/models/procedimiento";
import { ProcedimientoInsumo } from "@/models/procedimiento-insumo";
import { ReporteAvistamiento } from "@/models/reporte-avistamiento";
import { Rol } from "@/models/rol";
import { Turno } from "@/models/turno";
import { Usuario } from "@/models/usuario";
import { Vecino } from "@/models/vecino";
import { Veterinario } from "@/models/veterinario";
import { Zona } from "@/models/zona";

/**
 * Declara las asociaciones una sola vez por instancia de Sequelize
 * (la recarga en caliente de Next.js puede volver a evaluar este módulo).
 */
function declararAsociaciones() {
  // Usuarios y roles (F11)
  Rol.hasMany(Usuario, { foreignKey: "rol_id", as: "usuarios" });
  Usuario.belongsTo(Rol, { foreignKey: "rol_id", as: "rol" });

  // Personal actuante ↔ cuenta de acceso (0..1 : 0..1)
  Usuario.hasOne(Veterinario, { foreignKey: "usuario_id", as: "personal" });
  Veterinario.belongsTo(Usuario, { foreignKey: "usuario_id", as: "usuario" });

  // Zonas (F10)
  Zona.hasMany(Vecino, { foreignKey: "zona_id", as: "vecinos" });
  Vecino.belongsTo(Zona, { foreignKey: "zona_id", as: "zona" });
  Zona.hasMany(Operativo, { foreignKey: "zona_id", as: "operativos" });
  Operativo.belongsTo(Zona, { foreignKey: "zona_id", as: "zona" });
  Zona.hasMany(ReporteAvistamiento, { foreignKey: "zona_id", as: "reportes" });
  ReporteAvistamiento.belongsTo(Zona, { foreignKey: "zona_id", as: "zona" });

  // Vecinos y animales (F1/F2)
  Vecino.hasMany(Animal, { foreignKey: "vecino_id", as: "animales" });
  Animal.belongsTo(Vecino, { foreignKey: "vecino_id", as: "vecino" });

  // Operativos ↔ personal (N:M a través de operativo_veterinario)
  Operativo.belongsToMany(Veterinario, {
    through: OperativoVeterinario,
    foreignKey: "operativo_id",
    otherKey: "veterinario_id",
    as: "personal",
  });
  Veterinario.belongsToMany(Operativo, {
    through: OperativoVeterinario,
    foreignKey: "veterinario_id",
    otherKey: "operativo_id",
    as: "operativos",
  });
  Operativo.belongsTo(Usuario, { foreignKey: "usuario_cancelacion_id", as: "usuarioCancelacion" });

  // Turnos (F3)
  Animal.hasMany(Turno, { foreignKey: "animal_id", as: "turnos" });
  Turno.belongsTo(Animal, { foreignKey: "animal_id", as: "animal" });
  Operativo.hasMany(Turno, { foreignKey: "operativo_id", as: "turnos" });
  Turno.belongsTo(Operativo, { foreignKey: "operativo_id", as: "operativo" });

  // Procedimientos (F7) e historial (F8)
  Turno.hasOne(Procedimiento, { foreignKey: "turno_id", as: "procedimiento" });
  Procedimiento.belongsTo(Turno, { foreignKey: "turno_id", as: "turno" });
  Veterinario.hasMany(Procedimiento, { foreignKey: "veterinario_id", as: "procedimientos" });
  Procedimiento.belongsTo(Veterinario, { foreignKey: "veterinario_id", as: "veterinario" });
  Procedimiento.hasOne(HistorialClinico, { foreignKey: "procedimiento_id", as: "historial" });
  HistorialClinico.belongsTo(Procedimiento, { foreignKey: "procedimiento_id", as: "procedimiento" });

  // Insumos (F6): uso por procedimiento (N:M con cantidad) y movimientos de stock
  Procedimiento.belongsToMany(Insumo, {
    through: ProcedimientoInsumo,
    foreignKey: "procedimiento_id",
    otherKey: "insumo_id",
    as: "insumos",
  });
  Insumo.belongsToMany(Procedimiento, {
    through: ProcedimientoInsumo,
    foreignKey: "insumo_id",
    otherKey: "procedimiento_id",
    as: "procedimientos",
  });
  Procedimiento.hasMany(ProcedimientoInsumo, { foreignKey: "procedimiento_id", as: "detalleInsumos" });
  ProcedimientoInsumo.belongsTo(Insumo, { foreignKey: "insumo_id", as: "insumo" });
  Insumo.hasMany(MovimientoInsumo, { foreignKey: "insumo_id", as: "movimientos" });
  MovimientoInsumo.belongsTo(Insumo, { foreignKey: "insumo_id", as: "insumo" });
  Usuario.hasMany(MovimientoInsumo, { foreignKey: "usuario_id", as: "movimientos" });
  MovimientoInsumo.belongsTo(Usuario, { foreignKey: "usuario_id", as: "usuario" });
  Procedimiento.hasMany(MovimientoInsumo, { foreignKey: "procedimiento_id", as: "movimientos" });
  MovimientoInsumo.belongsTo(Procedimiento, { foreignKey: "procedimiento_id", as: "procedimiento" });

  // Avistamientos (F9)
  Vecino.hasMany(ReporteAvistamiento, { foreignKey: "vecino_id", as: "reportes" });
  ReporteAvistamiento.belongsTo(Vecino, { foreignKey: "vecino_id", as: "vecino" });
  Usuario.hasMany(ReporteAvistamiento, { foreignKey: "usuario_id", as: "reportes" });
  ReporteAvistamiento.belongsTo(Usuario, { foreignKey: "usuario_id", as: "usuario" });
  Operativo.hasMany(ReporteAvistamiento, { foreignKey: "operativo_id", as: "reportes" });
  ReporteAvistamiento.belongsTo(Operativo, { foreignKey: "operativo_id", as: "operativo" });

  // Notificaciones (F12)
  Turno.hasMany(Notificacion, { foreignKey: "turno_id", as: "notificaciones" });
  Notificacion.belongsTo(Turno, { foreignKey: "turno_id", as: "turno" });
  Vecino.hasMany(Notificacion, { foreignKey: "vecino_id", as: "notificaciones" });
  Notificacion.belongsTo(Vecino, { foreignKey: "vecino_id", as: "vecino" });
}

// Si Rol ya tiene la asociación "usuarios", este módulo ya fue inicializado.
if (!Rol.associations.usuarios) {
  declararAsociaciones();
}

export {
  sequelize,
  Animal, HistorialClinico, Insumo, MovimientoInsumo, Notificacion, Operativo, OperativoVeterinario,
  Procedimiento, ProcedimientoInsumo, ReporteAvistamiento, Rol, Turno, Usuario, Vecino, Veterinario, Zona,
};
