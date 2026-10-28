import { NextResponse } from "next/server";
import { sequelize } from "@/lib/db";

/**
 * GET /api/salud
 * Verifica que la aplicación pueda conectarse a PostgreSQL a través de Sequelize.
 * Responde 200 si la conexión funciona y 503 si no.
 */
export async function GET() {
  try {
    await sequelize.authenticate();
    return NextResponse.json({ estado: "ok", baseDeDatos: "conectada" });
  } catch {
    return NextResponse.json({ estado: "error", baseDeDatos: "sin conexión" }, { status: 503 });
  }
}
