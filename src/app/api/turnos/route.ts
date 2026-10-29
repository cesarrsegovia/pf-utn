import { NextResponse } from "next/server";
import { leerCuerpo, leerParametros, manejarApi } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { esquemaListadoTurnos, esquemaSolicitarTurno } from "@/schemas/turnos";
import { listarTurnos, solicitarTurno } from "@/services/turnos";

/** GET /api/turnos?pagina=&tamanio=&busqueda=&estado=&operativo_id= — listado (todos los roles). */
export const GET = manejarApi(async (request) => {
  await requerirSesion("turnos:ver");
  return NextResponse.json(await listarTurnos(leerParametros(request, esquemaListadoTurnos)));
});

/** POST /api/turnos — solicitud de turno (queda pendiente). */
export const POST = manejarApi(async (request) => {
  await requerirSesion("turnos:gestionar");
  const datos = await leerCuerpo(request, esquemaSolicitarTurno);
  return NextResponse.json(await solicitarTurno(datos), { status: 201 });
});
