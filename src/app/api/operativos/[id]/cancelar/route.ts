import { NextResponse } from "next/server";
import { leerCuerpo, leerId, manejarApi, type ContextoId } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { esquemaCancelarOperativo } from "@/schemas/operativos";
import { cancelarOperativo } from "@/services/operativos";

/** POST /api/operativos/:id/cancelar — solo administrador; registra al usuario en sesión. */
export const POST = manejarApi<ContextoId>(async (request, { params }) => {
  const sesion = await requerirSesion("operativos:cancelar");
  const id = await leerId(params);
  const datos = await leerCuerpo(request, esquemaCancelarOperativo);
  return NextResponse.json(await cancelarOperativo(id, datos, sesion.usuarioId));
});
