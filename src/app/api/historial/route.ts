import { NextResponse } from "next/server";
import { leerParametros, manejarApi } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { esquemaListadoHistorial } from "@/schemas/historial";
import { listarHistorial } from "@/services/historial";

/** GET /api/historial?pagina=&tamanio=&busqueda=&animal_id=&tipo=&desde=&hasta= — consulta (todos los roles). */
export const GET = manejarApi(async (request) => {
  await requerirSesion("historial:ver");
  return NextResponse.json(await listarHistorial(leerParametros(request, esquemaListadoHistorial)));
});
