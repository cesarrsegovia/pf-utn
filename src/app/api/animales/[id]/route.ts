import { NextResponse } from "next/server";
import { leerCuerpo, leerId, manejarApi, type ContextoId } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { esquemaAnimal } from "@/schemas/animales";
import { actualizarAnimal, eliminarAnimal, obtenerAnimal } from "@/services/animales";

/** GET /api/animales/:id */
export const GET = manejarApi<ContextoId>(async (_request, { params }) => {
  await requerirSesion("animales:ver");
  return NextResponse.json(await obtenerAnimal(await leerId(params)));
});

/** PUT /api/animales/:id — modificación. */
export const PUT = manejarApi<ContextoId>(async (request, { params }) => {
  await requerirSesion("animales:gestionar");
  const id = await leerId(params);
  const datos = await leerCuerpo(request, esquemaAnimal);
  return NextResponse.json(await actualizarAnimal(id, datos));
});

/** DELETE /api/animales/:id — solo si no tiene turnos (204). */
export const DELETE = manejarApi<ContextoId>(async (_request, { params }) => {
  await requerirSesion("animales:gestionar");
  await eliminarAnimal(await leerId(params));
  return new NextResponse(null, { status: 204 });
});
