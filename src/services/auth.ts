import bcrypt from "bcryptjs";
import type { DatosSesion } from "@/lib/auth";
import { Usuario } from "@/lib/db";
import { NoAutenticadoError } from "@/lib/errores";

/**
 * Valida las credenciales y devuelve los datos de sesión del usuario.
 * Ante email inexistente o contraseña incorrecta responde el mismo mensaje,
 * para no revelar qué emails están registrados.
 */
export async function autenticar(email: string, password: string): Promise<DatosSesion> {
  const usuario = await Usuario.scope("conPassword").findOne({
    where: { email: email.trim().toLowerCase() },
    include: ["rol"],
  });

  const credencialesValidas = usuario !== null && (await bcrypt.compare(password, usuario.password_hash));
  if (!usuario || !credencialesValidas) {
    throw new NoAutenticadoError("Email o contraseña incorrectos");
  }
  if (!usuario.activo) {
    throw new NoAutenticadoError("El usuario está inactivo. Contacte al administrador");
  }

  return { usuarioId: usuario.id, nombre: `${usuario.nombre} ${usuario.apellido}`, rol: usuario.rol!.nombre };
}
