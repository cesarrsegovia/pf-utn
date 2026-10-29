"use client";

import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { OpcionTexto } from "@/lib/etiquetas";

/**
 * Filtro desplegable de un listado. `etiquetaTodos` agrega una primera opción con valor
 * vacío ("sin filtrar"); sin ella, el filtro siempre tiene un valor seleccionado.
 */
export function FiltroSelect({ etiqueta, valor, opciones, etiquetaTodos, onCambiar }: {
  /** Nombre accesible del filtro (no se muestra). */
  etiqueta: string;
  valor: string;
  opciones: OpcionTexto[];
  etiquetaTodos?: string;
  onCambiar: (valor: string) => void;
}) {
  return (
    <NativeSelect aria-label={etiqueta} value={valor} onChange={(evento) => onCambiar(evento.target.value)}>
      {etiquetaTodos && <NativeSelectOption value="">{etiquetaTodos}</NativeSelectOption>}
      {opciones.map((opcion) => (
        <NativeSelectOption key={opcion.valor} value={opcion.valor}>{opcion.etiqueta}</NativeSelectOption>
      ))}
    </NativeSelect>
  );
}
