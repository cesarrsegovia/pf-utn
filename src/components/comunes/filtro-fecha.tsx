"use client";

import { Input } from "@/components/ui/input";

/** Filtro de fecha de un listado o reporte: campo de fecha accesible con etiqueta y tooltip. */
export function FiltroFecha({ etiqueta, valor, onCambiar }: {
  /** Nombre accesible del filtro (no se muestra). */
  etiqueta: string;
  valor: string;
  onCambiar: (valor: string) => void;
}) {
  return (
    <Input
      type="date"
      aria-label={etiqueta}
      title={etiqueta}
      className="w-auto"
      value={valor}
      onChange={(evento) => onCambiar(evento.target.value)}
    />
  );
}
