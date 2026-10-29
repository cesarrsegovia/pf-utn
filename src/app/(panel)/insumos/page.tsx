import { GestionInsumos } from "@/components/insumos/gestion-insumos";
import { tienePermiso } from "@/lib/permisos";
import { exigirPermisoPagina } from "@/lib/sesion";

/** F6 — Insumos (gestión: administrador y operador; consulta: veterinario). */
export default async function PaginaInsumos() {
  const sesion = await exigirPermisoPagina("insumos:ver");
  return <GestionInsumos puedeGestionar={tienePermiso(sesion.rol, "insumos:gestionar")} />;
}
