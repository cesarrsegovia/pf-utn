import { NextResponse } from "next/server";
import { manejarApi } from "@/lib/api";
import { cerrarSesion } from "@/lib/sesion";

/** POST /api/auth/logout — elimina la cookie de sesión. */
export const POST = manejarApi(async () => {
  await cerrarSesion();
  return NextResponse.json({ ok: true });
});
