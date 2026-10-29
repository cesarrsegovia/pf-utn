import { NextResponse } from "next/server";
import { leerCuerpo, leerParametros, manejarApi } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { esquemaListadoOperativos, esquemaOperativo } from "@/schemas/operativos";
import { crearOperativo, listarOperativos } from "@/services/operativos";

/** GET /api/operativos?pagina=&tamanio=&busqueda=&periodo=&estado=&zona_id= — listado (todos los roles). */
export const GET = manejarApi(async (request) => {
  await requerirSesion("operativos:ver");
  return NextResponse.json(await listarOperativos(leerParametros(request, esquemaListadoOperativos)));
});

/** POST /api/operativos — alta (administrador y operador). */
export const POST = manejarApi(async (request) => {
  await requerirSesion("operativos:gestionar");
  const datos = await leerCuerpo(request, esquemaOperativo);
  return NextResponse.json(await crearOperativo(datos), { status: 201 });
});
