import type { Metadata } from "next";
import { GestionNotificaciones } from "@/components/notificaciones/gestion-notificaciones";
import { tienePermiso } from "@/lib/permisos";
import { exigirPermisoPagina } from "@/lib/sesion";

export const metadata: Metadata = { title: "Notificaciones" };

/** F12 — Notificaciones (gestión: administrador; consulta: operador). */
export default async function PaginaNotificaciones() {
  const sesion = await exigirPermisoPagina("notificaciones:ver");
  return <GestionNotificaciones puedeGestionar={tienePermiso(sesion.rol, "notificaciones:gestionar")} />;
}
