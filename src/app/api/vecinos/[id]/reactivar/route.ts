import { NextResponse } from "next/server";
import { leerId, manejarApi, type ContextoId } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { reactivarVecino } from "@/services/vecinos";

/** POST /api/vecinos/:id/reactivar — revierte la baja lógica de un vecino. */
export const POST = manejarApi<ContextoId>(async (_request, { params }) => {
  await requerirSesion("vecinos:gestionar");
  return NextResponse.json(await reactivarVecino(await leerId(params)));
});
