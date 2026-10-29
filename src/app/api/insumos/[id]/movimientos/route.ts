import { NextResponse } from "next/server";
import { leerCuerpo, leerId, leerParametros, manejarApi, type ContextoId } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { esquemaListado } from "@/schemas/comun";
import { esquemaMovimiento } from "@/schemas/insumos";
import { listarMovimientos, registrarMovimiento } from "@/services/insumos";

/** GET /api/insumos/:id/movimientos?pagina=&tamanio= — historial de stock del insumo. */
export const GET = manejarApi<ContextoId>(async (request, { params }) => {
  await requerirSesion("insumos:ver");
  const id = await leerId(params);
  return NextResponse.json(await listarMovimientos(id, leerParametros(request, esquemaListado)));
});

/** POST /api/insumos/:id/movimientos — ingreso o egreso manual (devuelve el insumo actualizado). */
export const POST = manejarApi<ContextoId>(async (request, { params }) => {
  const sesion = await requerirSesion("insumos:gestionar");
  const id = await leerId(params);
  const datos = await leerCuerpo(request, esquemaMovimiento);
  return NextResponse.json(await registrarMovimiento(id, datos, sesion.usuarioId), { status: 201 });
});
