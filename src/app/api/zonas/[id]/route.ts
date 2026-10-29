import { NextResponse } from "next/server";
import { leerCuerpo, leerId, manejarApi, type ContextoId } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { esquemaZona } from "@/schemas/zonas";
import { actualizarZona, eliminarZona, obtenerZona } from "@/services/zonas";

/** GET /api/zonas/:id */
export const GET = manejarApi<ContextoId>(async (_request, { params }) => {
  await requerirSesion("zonas:ver");
  return NextResponse.json(await obtenerZona(await leerId(params)));
});

/** PUT /api/zonas/:id — modificación (solo administrador). */
export const PUT = manejarApi<ContextoId>(async (request, { params }) => {
  await requerirSesion("zonas:gestionar");
  const id = await leerId(params);
  const datos = await leerCuerpo(request, esquemaZona);
  return NextResponse.json(await actualizarZona(id, datos));
});

/** DELETE /api/zonas/:id — solo si no tiene vecinos, operativos ni reportes (204). */
export const DELETE = manejarApi<ContextoId>(async (_request, { params }) => {
  await requerirSesion("zonas:gestionar");
  await eliminarZona(await leerId(params));
  return new NextResponse(null, { status: 204 });
});
