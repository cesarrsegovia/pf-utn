import { NextResponse } from "next/server";
import { leerCuerpo, leerParametros, manejarApi } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { esquemaAnimal, esquemaListadoAnimales } from "@/schemas/animales";
import { crearAnimal, listarAnimales } from "@/services/animales";

/** GET /api/animales?pagina=&tamanio=&busqueda=&condicion= — listado paginado (todos los roles). */
export const GET = manejarApi(async (request) => {
  await requerirSesion("animales:ver");
  return NextResponse.json(await listarAnimales(leerParametros(request, esquemaListadoAnimales)));
});

/** POST /api/animales — alta de animal (administrador y operador). */
export const POST = manejarApi(async (request) => {
  await requerirSesion("animales:gestionar");
  const datos = await leerCuerpo(request, esquemaAnimal);
  return NextResponse.json(await crearAnimal(datos), { status: 201 });
});
