import { GestionOperativos } from "@/components/operativos/gestion-operativos";
import { tienePermiso } from "@/lib/permisos";
import { exigirPermisoPagina } from "@/lib/sesion";

/** F4 — Operativos (gestión: administrador y operador; consulta: veterinario). */
export default async function PaginaOperativos() {
  const sesion = await exigirPermisoPagina("operativos:ver");
  return <GestionOperativos puedeGestionar={tienePermiso(sesion.rol, "operativos:gestionar")} />;
}
