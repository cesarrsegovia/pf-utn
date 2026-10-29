import { NextResponse } from "next/server";
import { leerCuerpo, leerParametros, manejarApi } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { esquemaAvistamiento, esquemaListadoAvistamientos } from "@/schemas/avistamientos";
import { crearAvistamiento, listarAvistamientos } from "@/services/avistamientos";

/** GET /api/avistamientos?pagina=&tamanio=&busqueda=&estado=&zona_id=&desde=&hasta= — listado (todos los roles). */
export const GET = manejarApi(async (request) => {
  await requerirSesion("avistamientos:ver");
  return NextResponse.json(await listarAvistamientos(leerParametros(request, esquemaListadoAvistamientos)));
});

/** POST /api/avistamientos — alta; queda registrado el usuario en sesión (administrador u operador). */
export const POST = manejarApi(async (request) => {
  const sesion = await requerirSesion("avistamientos:gestionar");
  const datos = await leerCuerpo(request, esquemaAvistamiento);
  return NextResponse.json(await crearAvistamiento(datos, sesion.usuarioId), { status: 201 });
});
