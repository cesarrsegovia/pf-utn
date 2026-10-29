import { NextResponse } from "next/server";
import { leerCuerpo, manejarApi } from "@/lib/api";
import { guardarSesion } from "@/lib/sesion";
import { esquemaLogin } from "@/schemas/auth";
import { autenticar } from "@/services/auth";

/** POST /api/auth/login — valida credenciales y abre la sesión (cookie httpOnly). */
export const POST = manejarApi(async (request) => {
  const { email, password } = await leerCuerpo(request, esquemaLogin);
  const sesion = await autenticar(email, password);
  await guardarSesion(sesion);
  return NextResponse.json({ usuario: sesion });
});
