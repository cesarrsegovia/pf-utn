import { GestionAvistamientos } from "@/components/avistamientos/gestion-avistamientos";
import { tienePermiso } from "@/lib/permisos";
import { exigirPermisoPagina } from "@/lib/sesion";

/** F9 — Avistamientos (gestión: administrador y operador; consulta: veterinario). */
export default async function PaginaAvistamientos() {
  const sesion = await exigirPermisoPagina("avistamientos:ver");
  return <GestionAvistamientos puedeGestionar={tienePermiso(sesion.rol, "avistamientos:gestionar")} />;
}
