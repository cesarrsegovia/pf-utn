import { NextResponse } from "next/server";
import { leerParametros, manejarApi } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { esquemaOpcionesVecinos } from "@/schemas/vecinos";
import { opcionesVecinos } from "@/services/vecinos";

/** GET /api/vecinos/opciones?incluirId= — vecinos activos (más el tutor actual) para elegir tutor. */
export const GET = manejarApi(async (request) => {
  await requerirSesion("vecinos:ver");
  const { incluirId } = leerParametros(request, esquemaOpcionesVecinos);
  return NextResponse.json(await opcionesVecinos(incluirId));
});
