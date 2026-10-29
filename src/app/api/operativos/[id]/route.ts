import { NextResponse } from "next/server";
import { leerCuerpo, leerId, manejarApi, type ContextoId } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { esquemaOperativo } from "@/schemas/operativos";
import { actualizarOperativo, obtenerOperativo } from "@/services/operativos";

/** GET /api/operativos/:id — detalle con cupo y personal asignado. */
export const GET = manejarApi<ContextoId>(async (_request, { params }) => {
  await requerirSesion("operativos:ver");
  return NextResponse.json(await obtenerOperativo(await leerId(params)));
});

/** PUT /api/operativos/:id — edición; avisa a los turnos activos si cambian fecha, horario o lugar. */
export const PUT = manejarApi<ContextoId>(async (request, { params }) => {
  await requerirSesion("operativos:gestionar");
  const id = await leerId(params);
  const datos = await leerCuerpo(request, esquemaOperativo);
  return NextResponse.json(await actualizarOperativo(id, datos));
});
