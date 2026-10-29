import { NextResponse } from "next/server";
import { manejarApi } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { procesarPendientes } from "@/services/notificaciones";

/**
 * POST /api/notificaciones/procesar — envía las notificaciones pendientes vencidas.
 * Lo usa el botón "Procesar pendientes" (sesión con permiso de gestión) o un programador
 * externo con el encabezado `Authorization: Bearer <CRON_SECRET>`.
 */
export const POST = manejarApi(async (request) => {
  const secreto = process.env.CRON_SECRET;
  const autorizadoPorSecreto = Boolean(secreto) && request.headers.get("authorization") === `Bearer ${secreto}`;
  if (!autorizadoPorSecreto) {
    await requerirSesion("notificaciones:gestionar");
  }
  return NextResponse.json(await procesarPendientes());
});
