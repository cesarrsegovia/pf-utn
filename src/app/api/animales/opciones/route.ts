import { NextResponse } from "next/server";
import { manejarApi } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { opcionesAnimales } from "@/services/animales";

/** GET /api/animales/opciones — animales que pueden pedir turno (sin tutor o con tutor activo). */
export const GET = manejarApi(async () => {
  await requerirSesion("animales:ver");
  return NextResponse.json(await opcionesAnimales());
});
