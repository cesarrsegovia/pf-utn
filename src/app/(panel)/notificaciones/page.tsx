import type { Metadata } from "next";
import { GestionNotificaciones } from "@/components/notificaciones/gestion-notificaciones";
import { smtpConfigurado } from "@/lib/mailer";
import { tienePermiso } from "@/lib/permisos";
import { exigirPermisoPagina } from "@/lib/sesion";

export const metadata: Metadata = { title: "Notificaciones" };

/** F12 — Notificaciones (gestión: administrador; consulta: operador). */
export default async function PaginaNotificaciones() {
  const sesion = await exigirPermisoPagina("notificaciones:ver");
  return (
    <GestionNotificaciones
      puedeGestionar={tienePermiso(sesion.rol, "notificaciones:gestionar")}
      // Sin SMTP el envío automático no se inicia (ver lib/procesador-notificaciones.ts); la pantalla lo informa.
      envioAutomatico={smtpConfigurado()}
    />
  );
}
