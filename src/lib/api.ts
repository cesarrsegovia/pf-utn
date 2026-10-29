import { NextResponse, type NextRequest } from "next/server";
import { ForeignKeyConstraintError, UniqueConstraintError } from "sequelize";
import { ZodError, type ZodType } from "zod";
import { ErrorAplicacion, ValidacionError } from "./errores";
import { mensajeDeRestriccion } from "./restricciones";
import { esquemaId } from "@/schemas/comun";

/** Forma de todas las respuestas de error de la API. */
export interface CuerpoError {
  error: { mensaje: string; campos?: Record<string, string> };
}

/** Convierte los issues de Zod en un mapa campo → primer mensaje. */
function camposDeZod(error: ZodError): Record<string, string> {
  const campos: Record<string, string> = {};
  for (const issue of error.issues) {
    const campo = issue.path.join(".") || "formulario";
    campos[campo] ??= issue.message;
  }
  return campos;
}

/** Traduce cualquier error a una respuesta JSON con el código HTTP adecuado. */
export function respuestaDeError(error: unknown): NextResponse<CuerpoError> {
  if (error instanceof ErrorAplicacion) {
    return NextResponse.json({ error: { mensaje: error.message, campos: error.campos } }, { status: error.estado });
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: { mensaje: "Revise los datos ingresados", campos: camposDeZod(error) } },
      { status: 400 },
    );
  }
  // Resguardo ante restricciones de la base (ver src/lib/restricciones.ts).
  if (error instanceof UniqueConstraintError) {
    const restriccion = (error.parent as { constraint?: string }).constraint;
    return NextResponse.json(
      { error: { mensaje: mensajeDeRestriccion(restriccion, "Ya existe un registro con esos datos") } },
      { status: 409 },
    );
  }
  if (error instanceof ForeignKeyConstraintError) {
    const restriccion = (error.parent as { constraint?: string }).constraint;
    return NextResponse.json(
      { error: { mensaje: mensajeDeRestriccion(restriccion, "La operación afecta registros relacionados") } },
      { status: 409 },
    );
  }
  console.error("Error no controlado en la API:", error);
  return NextResponse.json({ error: { mensaje: "Ocurrió un error inesperado. Intente nuevamente." } }, { status: 500 });
}

/**
 * Envuelve un Route Handler para que cualquier error termine en una respuesta JSON
 * uniforme. Uso: `export const GET = manejarApi(async (request) => { ... })`.
 */
export function manejarApi<Contexto>(
  manejador: (request: NextRequest, contexto: Contexto) => Promise<Response>,
): (request: NextRequest, contexto: Contexto) => Promise<Response> {
  return async (request, contexto) => {
    try {
      return await manejador(request, contexto);
    } catch (error) {
      return respuestaDeError(error);
    }
  };
}

/** Lee y valida el cuerpo JSON de la solicitud con el esquema indicado. */
export async function leerCuerpo<T>(request: NextRequest, esquema: ZodType<T>): Promise<T> {
  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    throw new ValidacionError("El cuerpo de la solicitud no es un JSON válido");
  }
  return esquema.parse(cuerpo);
}

/** Valida los parámetros de la URL (query string) con el esquema indicado. */
export function leerParametros<T>(request: NextRequest, esquema: ZodType<T>): T {
  return esquema.parse(Object.fromEntries(request.nextUrl.searchParams));
}

/** Contexto de las rutas con un parámetro dinámico `[id]` (en Next.js 16 llega como Promise). */
export type ContextoId = { params: Promise<{ id: string }> };

/** Lee y valida el `[id]` numérico de la ruta (400 si no es un entero positivo). */
export async function leerId(params: ContextoId["params"]): Promise<number> {
  return esquemaId.parse((await params).id);
}
