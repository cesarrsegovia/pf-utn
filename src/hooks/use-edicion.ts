"use client";

import { useState } from "react";

/**
 * Estado de los diálogos de una pantalla de gestión: el formulario de alta/edición
 * y la confirmación de baja.
 * - `formulario`: null = cerrado; `{ registro: null }` = alta; `{ registro }` = edición.
 * - `aEliminar`: registro cuya baja se está confirmando (null = sin confirmación abierta).
 */
export function useEdicion<T>() {
  const [formulario, setFormulario] = useState<{ registro: T | null } | null>(null);
  const [aEliminar, setAEliminar] = useState<T | null>(null);

  return {
    formulario,
    abrirAlta: () => setFormulario({ registro: null }),
    abrirEdicion: (registro: T) => setFormulario({ registro }),
    cerrarFormulario: () => setFormulario(null),
    aEliminar,
    pedirEliminar: (registro: T) => setAEliminar(registro),
    cerrarEliminar: () => setAEliminar(null),
  };
}
