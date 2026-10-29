import bcrypt from "bcryptjs";
import type { DatosSesion } from "@/lib/auth";
import {
  incluyeChipeo, type EstadoAvistamiento, type EstadoEnvio, type EstadoOperativo, type EstadoTurno, type NombreRol,
  type TipoNotificacion, type TipoPersonal, type TipoProcedimiento,
} from "@/lib/constantes";
import {
  Animal, Notificacion, Operativo, Procedimiento, ReporteAvistamiento, Rol, Turno, Usuario, Vecino, Veterinario, Zona,
} from "@/lib/db";
import { hoyLocal, sumarDias } from "@/lib/fechas";

/** Contador para generar emails y apellidos únicos dentro de una corrida. */
let secuencia = 0;

export const PASSWORD_PRUEBA = "Clave1234";

/** Crea un usuario de prueba. Usa costo 4 de bcrypt para que los tests sean rápidos. */
export async function crearUsuarioPrueba(
  opciones: { rol?: NombreRol; activo?: boolean; email?: string } = {},
): Promise<Usuario> {
  secuencia += 1;
  const rol = await Rol.findOne({ where: { nombre: opciones.rol ?? "operador" } });
  return Usuario.create({
    nombre: "Usuario",
    apellido: `Prueba ${secuencia}`,
    email: opciones.email ?? `usuario${secuencia}@prueba.local`,
    password_hash: await bcrypt.hash(PASSWORD_PRUEBA, 4),
    activo: opciones.activo ?? true,
    rol_id: rol!.id,
  });
}

/** Administrador creado por el seed inicial. */
export async function adminSemilla(): Promise<Usuario> {
  const admin = await Usuario.findOne({ where: { email: process.env.SEED_ADMIN_EMAIL } });
  return admin!;
}

/** Arma los datos de sesión de un usuario, como los entregaría `requerirSesion()`. */
export function sesionDe(usuario: Usuario, rol: NombreRol): DatosSesion {
  return { usuarioId: usuario.id, nombre: `${usuario.nombre} ${usuario.apellido}`, rol };
}

/** Zona cargada por el seed inicial ("Centro" por defecto). */
export async function zonaSemilla(nombre = "Centro"): Promise<Zona> {
  return (await Zona.findOne({ where: { nombre } }))!;
}

/** Crea un vecino con DNI y email únicos. Si se crea inactivo, registra la fecha de baja. */
export async function crearVecinoPrueba(opciones: { zonaId?: number; activo?: boolean } = {}): Promise<Vecino> {
  secuencia += 1;
  const activo = opciones.activo ?? true;
  return Vecino.create({
    nombre: "Vecino",
    apellido: `Prueba ${secuencia}`,
    dni: String(30_000_000 + secuencia),
    telefono: "2964400000",
    email: `vecino${secuencia}@prueba.local`,
    direccion: "Calle de Prueba 123",
    zona_id: opciones.zonaId ?? (await zonaSemilla()).id,
    activo,
    fecha_baja: activo ? null : hoyLocal(),
  });
}

/**
 * Crea un animal. `vecinoId` sin indicar crea un tutor nuevo; `null` crea un callejero.
 */
export async function crearAnimalPrueba(opciones: { vecinoId?: number | null; numeroChip?: string } = {}): Promise<Animal> {
  const vecinoId = opciones.vecinoId === undefined ? (await crearVecinoPrueba()).id : opciones.vecinoId;
  return Animal.create({
    nombre: "Animal de prueba",
    sexo: "M",
    condicion: vecinoId === null ? "callejero" : "con_tutor",
    vecino_id: vecinoId,
    numero_chip: opciones.numeroChip ?? null,
  });
}

/** Crea un operativo a `diasDesdeHoy` días (7 por defecto), de 09:00 a 13:00 y cupo 20. */
export async function crearOperativoPrueba(
  opciones: { diasDesdeHoy?: number; estado?: EstadoOperativo; zonaId?: number } = {},
): Promise<Operativo> {
  return Operativo.create({
    fecha: sumarDias(hoyLocal(), opciones.diasDesdeHoy ?? 7),
    hora_inicio: "09:00",
    hora_fin: "13:00",
    lugar: "SUM municipal",
    cupo_maximo: 20,
    estado: opciones.estado ?? "programado",
    zona_id: opciones.zonaId ?? (await zonaSemilla()).id,
  });
}

/** Crea un turno de castración a las 09:30 en el estado indicado. */
export async function crearTurnoPrueba(
  animalId: number,
  operativoId: number,
  estado: EstadoTurno = "pendiente",
): Promise<Turno> {
  return Turno.create({
    horario: "09:30",
    tipo_solicitado: "castracion",
    estado,
    motivo_cancelacion: estado === "cancelado" ? "Cancelado en prueba" : null,
    animal_id: animalId,
    operativo_id: operativoId,
  });
}

/** Crea un integrante del personal: veterinario con matrícula única. */
export async function crearPersonalPrueba(opciones: { activo?: boolean } = {}): Promise<Veterinario> {
  secuencia += 1;
  return Veterinario.create({
    tipo: "veterinario",
    nombre: "Personal",
    apellido: `Prueba ${secuencia}`,
    matricula: `MP-${secuencia}`,
    activo: opciones.activo ?? true,
  });
}

/** Crea una notificación de un turno (por defecto, una confirmación lista para enviar). */
export async function crearNotificacionPrueba(
  turnoId: number,
  vecinoId: number,
  opciones: { tipo?: TipoNotificacion; estado?: EstadoEnvio; fechaProgramada?: Date } = {},
): Promise<Notificacion> {
  return Notificacion.create({
    tipo: opciones.tipo ?? "confirmacion",
    mensaje: "Mensaje de prueba",
    estado_envio: opciones.estado ?? "pendiente",
    fecha_programada: opciones.fechaProgramada ?? new Date(),
    turno_id: turnoId,
    vecino_id: vecinoId,
  });
}

/**
 * Crea un usuario con rol veterinario y su registro de personal vinculado.
 * Por defecto es veterinario con matrícula; `matricula: null` solo es válido para auxiliares.
 */
export async function crearVeterinarioConUsuario(
  opciones: { tipo?: TipoPersonal; matricula?: string | null } = {},
): Promise<{ usuario: Usuario; personal: Veterinario }> {
  const usuario = await crearUsuarioPrueba({ rol: "veterinario" });
  secuencia += 1;
  const personal = await Veterinario.create({
    tipo: opciones.tipo ?? "veterinario",
    nombre: "Veterinaria",
    apellido: `Prueba ${secuencia}`,
    matricula: opciones.matricula === undefined ? `MP-${secuencia}` : opciones.matricula,
    usuario_id: usuario.id,
  });
  return { usuario, personal };
}

/**
 * Crea un procedimiento sobre un turno sin pasar por F7 (para preparar datos de los reportes).
 * Si el tipo incluye chipeo, coloca un chip único de 15 dígitos (lo exige ck_procedimiento_chip).
 */
export async function crearProcedimientoPrueba(
  turnoId: number,
  veterinarioId: number,
  opciones: { tipo?: TipoProcedimiento; fecha?: Date } = {},
): Promise<Procedimiento> {
  secuencia += 1;
  const tipo = opciones.tipo ?? "castracion";
  return Procedimiento.create({
    tipo,
    fecha: opciones.fecha ?? new Date(),
    numero_chip_colocado: incluyeChipeo(tipo) ? String(985_000_000_000_000 + secuencia) : null,
    turno_id: turnoId,
    veterinario_id: veterinarioId,
  });
}

/** Crea un reporte de avistamiento: pendiente por defecto; si se crea atendido, registra la fecha de atención. */
export async function crearAvistamientoPrueba(
  usuarioId: number,
  opciones: { zonaId?: number; fecha?: Date; estado?: EstadoAvistamiento; fechaAtencion?: Date } = {},
): Promise<ReporteAvistamiento> {
  const estado = opciones.estado ?? "pendiente";
  return ReporteAvistamiento.create({
    fecha: opciones.fecha ?? new Date(),
    descripcion: "Perros sueltos en la plaza",
    cantidad_animales: 3,
    estado,
    fecha_atencion: estado === "atendido" ? (opciones.fechaAtencion ?? new Date()) : null,
    zona_id: opciones.zonaId ?? (await zonaSemilla()).id,
    usuario_id: usuarioId,
  });
}

