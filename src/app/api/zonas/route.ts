import { NextResponse } from "next/server";
import { leerCuerpo, leerParametros, manejarApi } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { esquemaListado } from "@/schemas/comun";
import { esquemaZona } from "@/schemas/zonas";
import { crearZona, listarZonas } from "@/services/zonas";

/** GET /api/zonas?pagina=&tamanio=&busqueda= — listado paginado (todos los roles). */
export const GET = manejarApi(async (request) => {
  await requerirSesion("zonas:ver");
  return NextResponse.json(await listarZonas(leerParametros(request, esquemaListado)));
});

/** POST /api/zonas — alta de zona (solo administrador). */
export const POST = manejarApi(async (request) => {
  await requerirSesion("zonas:gestionar");
  const datos = await leerCuerpo(request, esquemaZona);
  return NextResponse.json(await crearZona(datos), { status: 201 });
});
