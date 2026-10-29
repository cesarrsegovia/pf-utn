import { NextResponse } from "next/server";
import { leerId, manejarApi, type ContextoId } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { confirmarTurno } from "@/services/turnos";

/** POST /api/turnos/:id/confirmar — confirma un turno pendiente (aviso + recordatorio). */
export const POST = manejarApi<ContextoId>(async (_request, { params }) => {
  await requerirSesion("turnos:gestionar");
  return NextResponse.json(await confirmarTurno(await leerId(params)));
});
