import { NextResponse } from "next/server";
import { leerCuerpo, leerId, manejarApi, type ContextoId } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { esquemaAtenderAvistamiento } from "@/schemas/avistamientos";
import { atenderAvistamiento } from "@/services/avistamientos";

/** POST /api/avistamientos/:id/atender — pendiente → atendido, con operativo opcional de la misma zona. */
export const POST = manejarApi<ContextoId>(async (request, { params }) => {
  await requerirSesion("avistamientos:gestionar");
  const id = await leerId(params);
  const datos = await leerCuerpo(request, esquemaAtenderAvistamiento);
  return NextResponse.json(await atenderAvistamiento(id, datos));
});
