import type { Metadata } from "next";
import { GestionVecinos } from "@/components/vecinos/gestion-vecinos";
import { tienePermiso } from "@/lib/permisos";
import { exigirPermisoPagina } from "@/lib/sesion";

export const metadata: Metadata = { title: "Vecinos" };

/** F1 — Vecinos (gestión: administrador y operador; consulta: veterinario). */
export default async function PaginaVecinos() {
  const sesion = await exigirPermisoPagina("vecinos:ver");
  return <GestionVecinos puedeGestionar={tienePermiso(sesion.rol, "vecinos:gestionar")} />;
}
