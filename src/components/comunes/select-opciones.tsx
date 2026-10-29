"use client";

import useSWR from "swr";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { obtenerJson } from "@/lib/cliente-api";
import type { Opcion } from "@/schemas/comun";

/**
 * Lista desplegable de registros (zonas, tutores, usuarios…) cargada desde la API.
 * Es controlada (`valor`/`onCambiar`) para usarla con `Controller` de react-hook-form:
 * así muestra el valor correcto aunque las opciones lleguen después de montar el formulario.
 */
export function SelectOpciones({ id, url, valor, onCambiar, placeholder = "Seleccione…", invalido }: {
  id: string;
  url: string;
  valor: number | null;
  onCambiar: (valor: number | null) => void;
  placeholder?: string;
  invalido?: boolean;
}) {
  const { data, isLoading } = useSWR<Opcion[]>(url, obtenerJson);
  return (
    <NativeSelect
      id={id}
      className="w-full"
      aria-invalid={invalido || undefined}
      disabled={isLoading}
      value={valor === null ? "" : String(valor)}
      onChange={(evento) => onCambiar(evento.target.value === "" ? null : Number(evento.target.value))}
    >
      <NativeSelectOption value="">{isLoading ? "Cargando…" : placeholder}</NativeSelectOption>
      {data?.map((opcion) => (
        <NativeSelectOption key={opcion.id} value={String(opcion.id)}>{opcion.etiqueta}</NativeSelectOption>
      ))}
    </NativeSelect>
  );
}
