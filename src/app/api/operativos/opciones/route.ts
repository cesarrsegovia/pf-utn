import { NextResponse } from "next/server";
import { manejarApi } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { opcionesOperativos } from "@/services/operativos";

/** GET /api/operativos/opciones — operativos que admiten turnos, para listas desplegables. */
export const GET = manejarApi(async () => {
  await requerirSesion("turnos:ver");
  return NextResponse.json(await opcionesOperativos());
});
