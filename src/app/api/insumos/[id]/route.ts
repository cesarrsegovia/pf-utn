import { NextResponse } from "next/server";
import { leerCuerpo, leerId, manejarApi, type ContextoId } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { esquemaEditarInsumo } from "@/schemas/insumos";
import { actualizarInsumo, eliminarInsumo, obtenerInsumo } from "@/services/insumos";

/** GET /api/insumos/:id */
export const GET = manejarApi<ContextoId>(async (_request, { params }) => {
  await requerirSesion("insumos:ver");
  return NextResponse.json(await obtenerInsumo(await leerId(params)));
});

/** PUT /api/insumos/:id — nombre, unidad y stock mínimo (el stock cambia solo por movimientos). */
export const PUT = manejarApi<ContextoId>(async (request, { params }) => {
  await requerirSesion("insumos:gestionar");
  const id = await leerId(params);
  const datos = await leerCuerpo(request, esquemaEditarInsumo);
  return NextResponse.json(await actualizarInsumo(id, datos));
});

/** DELETE /api/insumos/:id — solo si no tiene movimientos ni usos (204). */
export const DELETE = manejarApi<ContextoId>(async (_request, { params }) => {
  await requerirSesion("insumos:gestionar");
  await eliminarInsumo(await leerId(params));
  return new NextResponse(null, { status: 204 });
});
