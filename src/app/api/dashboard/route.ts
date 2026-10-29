import { NextResponse } from "next/server";
import { manejarApi } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { resumenDashboard } from "@/services/dashboard";

/** GET /api/dashboard — resumen del inicio según el rol del usuario en sesión. */
export const GET = manejarApi(async () => {
  const sesion = await requerirSesion("dashboard:ver");
  return NextResponse.json(await resumenDashboard(sesion));
});
