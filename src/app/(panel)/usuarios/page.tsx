import { GestionUsuarios } from "@/components/usuarios/gestion-usuarios";
import { exigirPermisoPagina } from "@/lib/sesion";

/** F11 — Gestión de usuarios (solo administrador). */
export default async function PaginaUsuarios() {
  await exigirPermisoPagina("usuarios:gestionar");
  return <GestionUsuarios />;
}
