import { NextResponse } from "next/server";
import { leerCuerpo, leerParametros, manejarApi } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { esquemaCrearInsumo, esquemaListadoInsumos } from "@/schemas/insumos";
import { crearInsumo, listarInsumos } from "@/services/insumos";

/** GET /api/insumos?pagina=&tamanio=&busqueda=&stock= — listado paginado (todos los roles). */
export const GET = manejarApi(async (request) => {
  await requerirSesion("insumos:ver");
  return NextResponse.json(await listarInsumos(leerParametros(request, esquemaListadoInsumos)));
});

/** POST /api/insumos — alta; el stock inicial queda registrado a nombre del usuario en sesión. */
export const POST = manejarApi(async (request) => {
  const sesion = await requerirSesion("insumos:gestionar");
  const datos = await leerCuerpo(request, esquemaCrearInsumo);
  return NextResponse.json(await crearInsumo(datos, sesion.usuarioId), { status: 201 });
});
