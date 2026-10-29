import { NextResponse } from "next/server";
import { leerParametros, manejarApi } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { esquemaOperativosZona } from "@/schemas/avistamientos";
import { opcionesOperativosDeZona } from "@/services/operativos";

/** GET /api/avistamientos/operativos?zona_id= — operativos no cancelados de la zona, para atender un reporte. */
export const GET = manejarApi(async (request) => {
  await requerirSesion("avistamientos:gestionar");
  const { zona_id } = leerParametros(request, esquemaOperativosZona);
  return NextResponse.json(await opcionesOperativosDeZona(zona_id));
});
