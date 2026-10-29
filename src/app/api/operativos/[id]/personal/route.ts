import { NextResponse } from "next/server";
import { leerCuerpo, leerId, manejarApi, type ContextoId } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { esquemaPersonalOperativo } from "@/schemas/operativos";
import { asignarPersonal, quitarPersonal } from "@/services/operativos";

/** POST /api/operativos/:id/personal — asigna un integrante ({ veterinario_id }). Devuelve el detalle. */
export const POST = manejarApi<ContextoId>(async (request, { params }) => {
  await requerirSesion("operativos:gestionar");
  const id = await leerId(params);
  const datos = await leerCuerpo(request, esquemaPersonalOperativo);
  return NextResponse.json(await asignarPersonal(id, datos));
});

/** DELETE /api/operativos/:id/personal — quita un integrante ({ veterinario_id }). Devuelve el detalle. */
export const DELETE = manejarApi<ContextoId>(async (request, { params }) => {
  await requerirSesion("operativos:gestionar");
  const id = await leerId(params);
  const datos = await leerCuerpo(request, esquemaPersonalOperativo);
  return NextResponse.json(await quitarPersonal(id, datos));
});
