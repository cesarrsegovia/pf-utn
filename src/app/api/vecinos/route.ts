import { NextResponse } from "next/server";
import { leerCuerpo, leerParametros, manejarApi } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { esquemaListadoVecinos, esquemaVecino } from "@/schemas/vecinos";
import { crearVecino, listarVecinos } from "@/services/vecinos";

/** GET /api/vecinos?pagina=&tamanio=&busqueda=&estado=&zona_id= — listado paginado (todos los roles). */
export const GET = manejarApi(async (request) => {
  await requerirSesion("vecinos:ver");
  return NextResponse.json(await listarVecinos(leerParametros(request, esquemaListadoVecinos)));
});

/** POST /api/vecinos — alta de vecino (administrador y operador). */
export const POST = manejarApi(async (request) => {
  await requerirSesion("vecinos:gestionar");
  const datos = await leerCuerpo(request, esquemaVecino);
  return NextResponse.json(await crearVecino(datos), { status: 201 });
});
