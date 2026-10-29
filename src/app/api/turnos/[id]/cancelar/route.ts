import { NextResponse } from "next/server";
import { leerCuerpo, leerId, manejarApi, type ContextoId } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { esquemaCancelarTurno } from "@/schemas/turnos";
import { cancelarTurno } from "@/services/turnos";

/** POST /api/turnos/:id/cancelar — cancela un turno activo ({ motivo }). */
export const POST = manejarApi<ContextoId>(async (request, { params }) => {
  await requerirSesion("turnos:gestionar");
  const id = await leerId(params);
  const datos = await leerCuerpo(request, esquemaCancelarTurno);
  return NextResponse.json(await cancelarTurno(id, datos));
});
