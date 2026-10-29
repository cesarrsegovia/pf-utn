import type { Metadata } from "next";
import { GestionPersonal } from "@/components/personal/gestion-personal";
import { tienePermiso } from "@/lib/permisos";
import { exigirPermisoPagina } from "@/lib/sesion";

export const metadata: Metadata = { title: "Personal" };

/** F5 — Personal actuante (gestión: administrador; consulta: todos los roles). */
export default async function PaginaPersonal() {
  const sesion = await exigirPermisoPagina("personal:ver");
  return <GestionPersonal puedeGestionar={tienePermiso(sesion.rol, "personal:gestionar")} />;
}
