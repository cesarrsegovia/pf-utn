import { NextResponse } from "next/server";
import { leerCuerpo, leerId, manejarApi, type ContextoId } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { esquemaAvistamiento } from "@/schemas/avistamientos";
import { actualizarAvistamiento, eliminarAvistamiento, obtenerAvistamiento } from "@/services/avistamientos";

/** GET /api/avistamientos/:id */
export const GET = manejarApi<ContextoId>(async (_request, { params }) => {
  await requerirSesion("avistamientos:ver");
  return NextResponse.json(await obtenerAvistamiento(await leerId(params)));
});

/** PUT /api/avistamientos/:id — modificación de un reporte pendiente (409 si ya fue atendido). */
export const PUT = manejarApi<ContextoId>(async (request, { params }) => {
  await requerirSesion("avistamientos:gestionar");
  const id = await leerId(params);
  const datos = await leerCuerpo(request, esquemaAvistamiento);
  return NextResponse.json(await actualizarAvistamiento(id, datos));
});

/** DELETE /api/avistamientos/:id — baja de un reporte pendiente (204; 409 si ya fue atendido). */
export const DELETE = manejarApi<ContextoId>(async (_request, { params }) => {
  await requerirSesion("avistamientos:gestionar");
  await eliminarAvistamiento(await leerId(params));
  return new NextResponse(null, { status: 204 });
});
