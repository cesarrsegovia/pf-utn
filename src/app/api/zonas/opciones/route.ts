import { NextResponse } from "next/server";
import { manejarApi } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { opcionesZonas } from "@/services/zonas";

/** GET /api/zonas/opciones — todas las zonas para listas desplegables y filtros. */
export const GET = manejarApi(async () => {
  await requerirSesion("zonas:ver");
  return NextResponse.json(await opcionesZonas());
});
