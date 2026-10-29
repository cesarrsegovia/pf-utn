import { GestionVecinos } from "@/components/vecinos/gestion-vecinos";
import { tienePermiso } from "@/lib/permisos";
import { exigirPermisoPagina } from "@/lib/sesion";

/** F1 — Vecinos (gestión: administrador y operador; consulta: veterinario). */
export default async function PaginaVecinos() {
  const sesion = await exigirPermisoPagina("vecinos:ver");
  return <GestionVecinos puedeGestionar={tienePermiso(sesion.rol, "vecinos:gestionar")} />;
}
