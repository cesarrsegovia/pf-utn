import { NextResponse } from "next/server";
import { leerParametros, manejarApi } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { esquemaOpcionesUsuarios } from "@/schemas/personal";
import { opcionesUsuariosVinculables } from "@/services/personal";

/** GET /api/personal/usuarios-disponibles?personalId= — usuarios veterinarios vinculables. */
export const GET = manejarApi(async (request) => {
  await requerirSesion("personal:gestionar");
  const { personalId } = leerParametros(request, esquemaOpcionesUsuarios);
  return NextResponse.json(await opcionesUsuariosVinculables(personalId));
});
