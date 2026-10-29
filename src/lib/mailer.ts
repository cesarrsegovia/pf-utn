import nodemailer from "nodemailer";
import type { TipoNotificacion } from "./constantes";

/**
 * Envío de correo por SMTP (F12) con Nodemailer. La configuración se toma de .env
 * (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM). Este módulo solo envía:
 * qué enviar y cuándo lo decide el servicio de notificaciones.
 */

/** Correo listo para enviar. */
export interface Correo {
  para: string;
  asunto: string;
  texto: string;
}

/** Asunto de cada tipo de notificación. */
export const ASUNTOS_NOTIFICACION: Record<TipoNotificacion, string> = {
  recordatorio: "SIGCAN – Recordatorio de turno",
  confirmacion: "SIGCAN – Turno confirmado",
  cancelacion: "SIGCAN – Turno cancelado",
  reprogramacion: "SIGCAN – Turno reprogramado",
};

/** Indica si están completos los datos mínimos del servidor SMTP. */
export function smtpConfigurado(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

/** Transporte reutilizable (se crea en el primer envío). */
let transporte: ReturnType<typeof nodemailer.createTransport> | null = null;

/** Devuelve el transporte SMTP o lanza un error si falta configuración. */
function obtenerTransporte() {
  if (!smtpConfigurado()) {
    throw new Error("El servidor SMTP no está configurado (SMTP_HOST, SMTP_USER y SMTP_PASS en .env)");
  }
  const puerto = Number(process.env.SMTP_PORT ?? 465);
  transporte ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: puerto,
    // El puerto 465 usa TLS desde el inicio; el 587 negocia STARTTLS.
    secure: puerto === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transporte;
}

/** Envía un correo de texto plano. Lanza un error si el servidor SMTP lo rechaza. */
export async function enviarCorreo(correo: Correo): Promise<void> {
  await obtenerTransporte().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: correo.para,
    subject: correo.asunto,
    text: correo.texto,
  });
}
