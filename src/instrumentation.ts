/**
 * Next.js ejecuta `register()` una vez al iniciar el servidor. Arranca el procesador
 * periódico de notificaciones (F12) solo en el runtime de Node.js (no en Edge) y nunca
 * durante `next build`. El import dinámico evita cargar Sequelize en otros runtimes.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NEXT_PHASE !== "phase-production-build") {
    const { iniciarProcesadorNotificaciones } = await import("./lib/procesador-notificaciones");
    iniciarProcesadorNotificaciones();
  }
}
