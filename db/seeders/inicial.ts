import bcrypt from "bcryptjs";
import { Rol, Usuario, Zona } from "@/lib/db";
import { ROLES } from "@/lib/constantes";

/** Barrios de Río Grande usados como zonas administrativas iniciales. */
const ZONAS_RIO_GRANDE = [
  "Centro", "Chacra II", "Chacra IV", "Chacra XI", "Chacra XIII", "Austral",
  "Mutual", "Malvinas Argentinas", "Los Cisnes", "Vapor Amadeo", "Margen Sur", "Aeropuerto",
];

/**
 * Carga los datos mínimos para operar el sistema: roles, administrador inicial y zonas.
 * Es idempotente: usa findOrCreate, así que puede ejecutarse varias veces sin duplicar.
 */
export async function sembrarDatosIniciales(): Promise<void> {
  // 1) Roles del sistema.
  for (const nombre of ROLES) {
    await Rol.findOrCreate({ where: { nombre } });
  }

  // 2) Administrador inicial (credenciales tomadas de .env).
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("Faltan SEED_ADMIN_EMAIL y/o SEED_ADMIN_PASSWORD en el archivo .env");
  }
  const rolAdministrador = await Rol.findOne({ where: { nombre: "administrador" } });
  await Usuario.findOrCreate({
    where: { email },
    defaults: {
      nombre: "Administrador",
      apellido: "SIGCAN",
      email,
      password_hash: await bcrypt.hash(password, 10),
      rol_id: rolAdministrador!.id,
    },
  });

  // 3) Zonas administrativas.
  for (const nombre of ZONAS_RIO_GRANDE) {
    await Zona.findOrCreate({ where: { nombre } });
  }
}
