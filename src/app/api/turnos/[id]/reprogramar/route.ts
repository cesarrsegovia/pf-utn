import { NextResponse } from "next/server";
import { leerCuerpo, leerId, manejarApi, type ContextoId } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { esquemaReprogramarTurno } from "@/schemas/turnos";
import { reprogramarTurno } from "@/services/turnos";

/** POST /api/turnos/:id/reprogramar — nuevo operativo y/o horario ({ operativo_id, horario }). */
export const POST = manejarApi<ContextoId>(async (request, { params }) => {
  await requerirSesion("turnos:gestionar");
  const id = await leerId(params);
  const datos = await leerCuerpo(request, esquemaReprogramarTurno);
  return NextResponse.json(await reprogramarTurno(id, datos));
});
