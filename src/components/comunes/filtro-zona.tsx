"use client";

import useSWR from "swr";
import { obtenerJson } from "@/lib/cliente-api";
import type { Opcion } from "@/schemas/comun";
import { FiltroSelect } from "./filtro-select";

/** Filtro de zona de un listado o reporte: "Todas las zonas" (valor vacío) o una zona puntual. */
export function FiltroZona({ valor, onCambiar }: { valor: string; onCambiar: (valor: string) => void }) {
  const { data: zonas } = useSWR<Opcion[]>("/api/zonas/opciones", obtenerJson);
  return (
    <FiltroSelect
      etiqueta="Zona"
      valor={valor}
      opciones={(zonas ?? []).map((zona) => ({ valor: String(zona.id), etiqueta: zona.etiqueta }))}
      etiquetaTodos="Todas las zonas"
      onCambiar={onCambiar}
    />
  );
}
