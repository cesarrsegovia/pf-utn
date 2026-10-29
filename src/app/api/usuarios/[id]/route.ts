import { NextResponse } from "next/server";
import { leerCuerpo, leerId, manejarApi, type ContextoId } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { esquemaEditarUsuario } from "@/schemas/usuarios";
import { actualizarUsuario, eliminarUsuario, obtenerUsuario } from "@/services/usuarios";

/** GET /api/usuarios/:id */
export const GET = manejarApi<ContextoId>(async (_request, { params }) => {
  await requerirSesion("usuarios:gestionar");
  return NextResponse.json(await obtenerUsuario(await leerId(params)));
});

/** PUT /api/usuarios/:id — modificación (contraseña vacía = sin cambios). */
export const PUT = manejarApi<ContextoId>(async (request, { params }) => {
  const sesion = await requerirSesion("usuarios:gestionar");
  const id = await leerId(params);
  const datos = await leerCuerpo(request, esquemaEditarUsuario);
  return NextResponse.json(await actualizarUsuario(id, datos, sesion));
});

/** DELETE /api/usuarios/:id — elimina o desactiva según tenga registros asociados. */
export const DELETE = manejarApi<ContextoId>(async (_request, { params }) => {
  const sesion = await requerirSesion("usuarios:gestionar");
  return NextResponse.json(await eliminarUsuario(await leerId(params), sesion));
});
