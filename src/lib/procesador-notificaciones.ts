import { setInterval } from "node:timers";
import { procesarPendientes } from "@/services/notificaciones";
import { smtpConfigurado } from "./mailer";

/** Frecuencia del envío automático de notificaciones (F12). */
const INTERVALO_MS = 60_000;

/** El temporizador se guarda en globalThis para no duplicarlo si el módulo se vuelve a evaluar. */
const almacenGlobal = globalThis as unknown as { temporizadorNotificaciones?: NodeJS.Timeout };

/**
 * Arranca el procesador periódico de notificaciones. Si el SMTP no está configurado no
 * arranca (lo avisa en el log): las notificaciones quedan pendientes y pueden enviarse
 * luego con "Procesar pendientes".
 */
export function iniciarProcesadorNotificaciones(): void {
  if (almacenGlobal.temporizadorNotificaciones) return;
  if (!smtpConfigurado()) {
    console.warn("[SIGCAN] SMTP sin configurar: el envío automático de notificaciones está desactivado.");
    return;
  }

  // Evita que una ejecución lenta (SMTP demorado) se superponga con la siguiente.
  let enCurso = false;
  almacenGlobal.temporizadorNotificaciones = setInterval(async () => {
    if (enCurso) return;
    enCurso = true;
    try {
      const { enviadas, fallidas } = await procesarPendientes();
      if (enviadas + fallidas > 0) {
        console.info(`[SIGCAN] Notificaciones: ${enviadas} enviadas, ${fallidas} fallidas`);
      }
    } catch (error) {
      console.error("[SIGCAN] Error en el procesador de notificaciones:", error);
    } finally {
      enCurso = false;
    }
  }, INTERVALO_MS);
  // No impide que el proceso termine (por ejemplo, al detener el servidor).
  almacenGlobal.temporizadorNotificaciones.unref();
}
