import { GestionZonas } from "@/components/zonas/gestion-zonas";
import { tienePermiso } from "@/lib/permisos";
import { exigirPermisoPagina } from "@/lib/sesion";

/** F10 — Zonas (gestión: administrador; consulta: todos los roles). */
export default async function PaginaZonas() {
  const sesion = await exigirPermisoPagina("zonas:ver");
  return <GestionZonas puedeGestionar={tienePermiso(sesion.rol, "zonas:gestionar")} />;
}
