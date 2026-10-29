import { GestionAnimales } from "@/components/animales/gestion-animales";
import { tienePermiso } from "@/lib/permisos";
import { exigirPermisoPagina } from "@/lib/sesion";

/** F2 — Animales (gestión: administrador y operador; consulta: veterinario). */
export default async function PaginaAnimales() {
  const sesion = await exigirPermisoPagina("animales:ver");
  return <GestionAnimales puedeGestionar={tienePermiso(sesion.rol, "animales:gestionar")} />;
}
