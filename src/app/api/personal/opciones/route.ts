import { NextResponse } from "next/server";
import { manejarApi } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { opcionesPersonal } from "@/services/personal";

/** GET /api/personal/opciones — personal activo para asignar a operativos. */
export const GET = manejarApi(async () => {
  await requerirSesion("personal:ver");
  return NextResponse.json(await opcionesPersonal());
});
