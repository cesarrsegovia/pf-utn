import { NextResponse } from "next/server";
import { leerCuerpo, leerParametros, manejarApi } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { esquemaListadoPersonal, esquemaPersonal } from "@/schemas/personal";
import { crearPersonal, listarPersonal } from "@/services/personal";

/** GET /api/personal?pagina=&tamanio=&busqueda=&tipo=&estado= — listado paginado (todos los roles). */
export const GET = manejarApi(async (request) => {
  await requerirSesion("personal:ver");
  return NextResponse.json(await listarPersonal(leerParametros(request, esquemaListadoPersonal)));
});

/** POST /api/personal — alta de personal actuante (solo administrador). */
export const POST = manejarApi(async (request) => {
  await requerirSesion("personal:gestionar");
  const datos = await leerCuerpo(request, esquemaPersonal);
  return NextResponse.json(await crearPersonal(datos), { status: 201 });
});
