import { NextResponse } from "next/server";
import { leerCuerpo, manejarApi } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { esquemaProcedimiento } from "@/schemas/procedimientos";
import { registrarProcedimiento } from "@/services/procedimientos";

/** POST /api/procedimientos — registra un procedimiento (solo veterinarios habilitados). */
export const POST = manejarApi(async (request) => {
  const sesion = await requerirSesion("procedimientos:registrar");
  const datos = await leerCuerpo(request, esquemaProcedimiento);
  return NextResponse.json(await registrarProcedimiento(datos, sesion.usuarioId), { status: 201 });
});
