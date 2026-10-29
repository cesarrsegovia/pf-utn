"use client";

import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { toast } from "sonner";
import { ErrorApi } from "./cliente-api";

/** Mensaje de un error de la API, o el indicado si el error no vino del servidor. */
export function mensajeDeError(error: unknown, porDefecto: string): string {
  return error instanceof ErrorApi ? error.message : porDefecto;
}

/**
 * Muestra un error al guardar un formulario: los errores por campo que devuelve la API
 * se asocian a cada input y el mensaje general se muestra en un toast.
 */
export function mostrarErrorFormulario<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  porDefecto: string,
): void {
  if (error instanceof ErrorApi && error.campos) {
    for (const [campo, mensaje] of Object.entries(error.campos)) {
      setError(campo as Path<T>, { message: mensaje });
    }
  }
  toast.error(mensajeDeError(error, porDefecto));
}

/** Convierte el valor de un input numérico opcional o de un `<select>` de ids: "" → null. */
export function numeroONulo(valor: unknown): number | null {
  return valor === "" || valor === null || valor === undefined ? null : Number(valor);
}
