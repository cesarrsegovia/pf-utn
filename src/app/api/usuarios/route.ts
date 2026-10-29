import { NextResponse } from "next/server";
import { leerCuerpo, leerParametros, manejarApi } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { esquemaListado } from "@/schemas/comun";
import { esquemaCrearUsuario } from "@/schemas/usuarios";
import { crearUsuario, listarUsuarios } from "@/services/usuarios";

/** GET /api/usuarios?pagina=&tamanio=&busqueda= — listado paginado (solo administrador). */
export const GET = manejarApi(async (request) => {
  await requerirSesion("usuarios:gestionar");
  return NextResponse.json(await listarUsuarios(leerParametros(request, esquemaListado)));
});

/** POST /api/usuarios — alta de usuario (solo administrador). */
export const POST = manejarApi(async (request) => {
  await requerirSesion("usuarios:gestionar");
  const datos = await leerCuerpo(request, esquemaCrearUsuario);
  return NextResponse.json(await crearUsuario(datos), { status: 201 });
});
