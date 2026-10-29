import { NextResponse } from "next/server";
import { leerCuerpo, leerId, manejarApi, type ContextoId } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { esquemaEstadoOperativo } from "@/schemas/operativos";
import { cambiarEstadoOperativo } from "@/services/operativos";

/** POST /api/operativos/:id/estado — iniciar ({ estado: "en_curso" }) o finalizar ({ estado: "realizado" }). */
export const POST = manejarApi<ContextoId>(async (request, { params }) => {
  await requerirSesion("operativos:gestionar");
  const id = await leerId(params);
  const datos = await leerCuerpo(request, esquemaEstadoOperativo);
  return NextResponse.json(await cambiarEstadoOperativo(id, datos));
});
