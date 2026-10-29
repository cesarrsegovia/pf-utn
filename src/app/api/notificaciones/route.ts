import { NextResponse } from "next/server";
import { leerParametros, manejarApi } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { esquemaListadoNotificaciones } from "@/schemas/notificaciones";
import { listarNotificaciones } from "@/services/notificaciones";

/** GET /api/notificaciones?pagina=&tamanio=&busqueda=&tipo=&estado=&desde=&hasta= — administrador y operador. */
export const GET = manejarApi(async (request) => {
  await requerirSesion("notificaciones:ver");
  return NextResponse.json(await listarNotificaciones(leerParametros(request, esquemaListadoNotificaciones)));
});
