import { NextResponse } from "next/server";
import { leerCuerpo, leerId, manejarApi, type ContextoId } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { esquemaVecino } from "@/schemas/vecinos";
import { actualizarVecino, eliminarVecino, obtenerVecino } from "@/services/vecinos";

/** GET /api/vecinos/:id */
export const GET = manejarApi<ContextoId>(async (_request, { params }) => {
  await requerirSesion("vecinos:ver");
  return NextResponse.json(await obtenerVecino(await leerId(params)));
});

/** PUT /api/vecinos/:id — modificación de datos. */
export const PUT = manejarApi<ContextoId>(async (request, { params }) => {
  await requerirSesion("vecinos:gestionar");
  const id = await leerId(params);
  const datos = await leerCuerpo(request, esquemaVecino);
  return NextResponse.json(await actualizarVecino(id, datos));
});

/** DELETE /api/vecinos/:id — baja física o lógica con cancelación de turnos en cascada. */
export const DELETE = manejarApi<ContextoId>(async (_request, { params }) => {
  await requerirSesion("vecinos:gestionar");
  return NextResponse.json(await eliminarVecino(await leerId(params)));
});
