import { NextResponse } from "next/server";
import { manejarApi } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { turnosParaAtender } from "@/services/procedimientos";

/** GET /api/procedimientos/turnos — turnos que el veterinario en sesión puede atender ahora. */
export const GET = manejarApi(async () => {
  const sesion = await requerirSesion("procedimientos:registrar");
  return NextResponse.json(await turnosParaAtender(sesion.usuarioId));
});
