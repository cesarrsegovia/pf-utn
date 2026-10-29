"use client";

/** Error devuelto por la API, con el código HTTP y los errores por campo. */
export class ErrorApi extends Error {
  constructor(
    mensaje: string,
    public readonly estado: number,
    public readonly campos?: Record<string, string>,
  ) {
    super(mensaje);
  }
}

/**
 * Llama a la API REST propia y devuelve el JSON tipado.
 * Ante 401 (sesión vencida) redirige al login; ante otros errores lanza `ErrorApi`
 * con el mensaje en español preparado por el servidor.
 */
export async function llamarApi<T>(url: string, opciones: { metodo?: string; cuerpo?: unknown } = {}): Promise<T> {
  const respuesta = await fetch(url, {
    method: opciones.metodo ?? "GET",
    headers: opciones.cuerpo !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: opciones.cuerpo !== undefined ? JSON.stringify(opciones.cuerpo) : undefined,
  });

  const datos = await respuesta.json().catch(() => null);

  if (respuesta.status === 401 && !url.startsWith("/api/auth/")) {
    window.location.href = "/login";
  }
  if (!respuesta.ok) {
    throw new ErrorApi(datos?.error?.mensaje ?? "Ocurrió un error inesperado", respuesta.status, datos?.error?.campos);
  }
  return datos as T;
}

/** Fetcher para SWR: `useSWR(url, obtenerJson)`. */
export const obtenerJson = <T,>(url: string) => llamarApi<T>(url);
