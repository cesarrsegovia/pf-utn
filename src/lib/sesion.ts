import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_SESION, DURACION_SESION_SEGUNDOS, firmarSesion, verificarSesion, type DatosSesion } from "./auth";
import { Usuario } from "./db";
import { NoAutenticadoError, ProhibidoError } from "./errores";
import { tienePermiso, type Accion } from "./permisos";

/**
 * Lee la sesión desde la cookie y la revalida contra la base: si el usuario fue
 * desactivado o cambió de rol, el cambio rige desde el siguiente request.
 */
export async function obtenerSesion(): Promise<DatosSesion | null> {
  const almacen = await cookies();
  const datos = await verificarSesion(almacen.get(COOKIE_SESION)?.value);
  if (!datos) return null;

  const usuario = await Usuario.findByPk(datos.usuarioId, { include: ["rol"] });
  if (!usuario || !usuario.activo || !usuario.rol) return null;

  return { usuarioId: usuario.id, nombre: `${usuario.nombre} ${usuario.apellido}`, rol: usuario.rol.nombre };
}

/** Para Route Handlers: exige sesión válida (401) y, opcionalmente, un permiso (403). */
export async function requerirSesion(accion?: Accion): Promise<DatosSesion> {
  const sesion = await obtenerSesion();
  if (!sesion) throw new NoAutenticadoError();
  if (accion && !tienePermiso(sesion.rol, accion)) throw new ProhibidoError();
  return sesion;
}

/** Para páginas: sin sesión redirige a /login; sin permiso redirige al inicio. */
export async function exigirPermisoPagina(accion: Accion): Promise<DatosSesion> {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  if (!tienePermiso(sesion.rol, accion)) redirect("/dashboard");
  return sesion;
}

/** Guarda el JWT en una cookie httpOnly (inaccesible desde JavaScript del navegador). */
export async function guardarSesion(datos: DatosSesion): Promise<void> {
  const almacen = await cookies();
  almacen.set({
    name: COOKIE_SESION,
    value: await firmarSesion(datos),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DURACION_SESION_SEGUNDOS,
  });
}

/** Elimina la cookie de sesión. */
export async function cerrarSesion(): Promise<void> {
  const almacen = await cookies();
  almacen.delete(COOKIE_SESION);
}
