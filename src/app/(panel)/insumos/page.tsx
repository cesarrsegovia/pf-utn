import type { Metadata } from "next";
import { GestionInsumos } from "@/components/insumos/gestion-insumos";
import { tienePermiso } from "@/lib/permisos";
import { exigirPermisoPagina } from "@/lib/sesion";

export const metadata: Metadata = { title: "Insumos" };

/** F6 — Insumos (gestión: administrador y operador; consulta: veterinario). */
export default async function PaginaInsumos() {
  const sesion = await exigirPermisoPagina("insumos:ver");
  return <GestionInsumos puedeGestionar={tienePermiso(sesion.rol, "insumos:gestionar")} />;
}
