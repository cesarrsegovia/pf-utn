import type { Metadata } from "next";
import { GestionZonas } from "@/components/zonas/gestion-zonas";
import { tienePermiso } from "@/lib/permisos";
import { exigirPermisoPagina } from "@/lib/sesion";

export const metadata: Metadata = { title: "Zonas" };

/** F10 — Zonas (gestión: administrador; consulta: todos los roles). */
export default async function PaginaZonas() {
  const sesion = await exigirPermisoPagina("zonas:ver");
  return <GestionZonas puedeGestionar={tienePermiso(sesion.rol, "zonas:gestionar")} />;
}
