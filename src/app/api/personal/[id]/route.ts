import { NextResponse } from "next/server";
import { leerCuerpo, leerId, manejarApi, type ContextoId } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { esquemaPersonal } from "@/schemas/personal";
import { actualizarPersonal, eliminarPersonal, obtenerPersonal } from "@/services/personal";

/** GET /api/personal/:id */
export const GET = manejarApi<ContextoId>(async (_request, { params }) => {
  await requerirSesion("personal:ver");
  return NextResponse.json(await obtenerPersonal(await leerId(params)));
});

/** PUT /api/personal/:id — modificación (solo administrador). */
export const PUT = manejarApi<ContextoId>(async (request, { params }) => {
  await requerirSesion("personal:gestionar");
  const id = await leerId(params);
  const datos = await leerCuerpo(request, esquemaPersonal);
  return NextResponse.json(await actualizarPersonal(id, datos));
});

/** DELETE /api/personal/:id — elimina o desactiva según tenga historial. */
export const DELETE = manejarApi<ContextoId>(async (_request, { params }) => {
  await requerirSesion("personal:gestionar");
  return NextResponse.json(await eliminarPersonal(await leerId(params)));
});
