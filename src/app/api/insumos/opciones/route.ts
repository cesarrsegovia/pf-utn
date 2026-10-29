import { NextResponse } from "next/server";
import { manejarApi } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { opcionesInsumos } from "@/services/insumos";

/** GET /api/insumos/opciones — insumos con stock disponible, para el formulario de procedimientos. */
export const GET = manejarApi(async () => {
  await requerirSesion("insumos:ver");
  return NextResponse.json(await opcionesInsumos());
});
