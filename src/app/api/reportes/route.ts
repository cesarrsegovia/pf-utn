import { NextResponse } from "next/server";
import { leerParametros, manejarApi } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { esquemaFiltrosReportes } from "@/schemas/reportes";
import { generarReportes } from "@/services/reportes";

/** GET /api/reportes?desde=&hasta=&zona_id= — indicadores de F13 (administrador y operador). */
export const GET = manejarApi(async (request) => {
  await requerirSesion("reportes:ver");
  return NextResponse.json(await generarReportes(leerParametros(request, esquemaFiltrosReportes)));
});
