import { jwtVerify, SignJWT } from "jose";
import { ROLES, type NombreRol } from "./constantes";

/**
 * Firma y verificación del JWT de sesión.
 * Este módulo NO accede a la base de datos: lo usa `src/proxy.ts`, que solo hace un
 * chequeo optimista. La validación completa (usuario activo, rol vigente) la hace
 * `src/lib/sesion.ts` en cada página y Route Handler.
 */

export const COOKIE_SESION = "sigcan_sesion";
/** Duración de la sesión: una jornada laboral (8 horas). */
export const DURACION_SESION_SEGUNDOS = 8 * 60 * 60;

/** Datos que viajan dentro del token y que usa la aplicación. */
export interface DatosSesion {
  usuarioId: number;
  nombre: string;
  rol: NombreRol;
}

/** Clave HMAC derivada de JWT_SECRET; se exige una longitud mínima razonable. */
function claveSecreta(): Uint8Array {
  const secreto = process.env.JWT_SECRET;
  if (!secreto || secreto.length < 32) {
    throw new Error("JWT_SECRET debe estar definido en .env y tener al menos 32 caracteres");
  }
  return new TextEncoder().encode(secreto);
}

/** Genera el token firmado (HS256) para la sesión indicada. */
export async function firmarSesion(datos: DatosSesion): Promise<string> {
  return new SignJWT({ nombre: datos.nombre, rol: datos.rol })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(datos.usuarioId))
    .setIssuedAt()
    .setExpirationTime(`${DURACION_SESION_SEGUNDOS}s`)
    .sign(claveSecreta());
}

/** Verifica firma y vencimiento del token; devuelve null si no es válido. */
export async function verificarSesion(token: string | undefined): Promise<DatosSesion | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, claveSecreta(), { algorithms: ["HS256"] });
    const usuarioId = Number(payload.sub);
    const rol = payload.rol as NombreRol;
    if (!Number.isInteger(usuarioId) || !ROLES.includes(rol) || typeof payload.nombre !== "string") {
      return null;
    }
    return { usuarioId, nombre: payload.nombre, rol };
  } catch {
    // Firma inválida, token vencido o mal formado.
    return null;
  }
}
