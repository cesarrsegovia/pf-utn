import { NextResponse } from "next/server";
import { leerId, manejarApi, type ContextoId } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { reintentarNotificacion } from "@/services/notificaciones";

/** POST /api/notificaciones/:id/reintentar — vuelve a poner en cola una notificación fallida (204). */
export const POST = manejarApi<ContextoId>(async (_request, { params }) => {
  await requerirSesion("notificaciones:gestionar");
  await reintentarNotificacion(await leerId(params));
  return new NextResponse(null, { status: 204 });
});
