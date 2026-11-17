import type { ReactNode } from "react";

/** Título, descripción y acciones principales de una página del panel. */
export function EncabezadoPagina({ titulo, descripcion, acciones }: { titulo: string; descripcion?: string; acciones?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b pb-5">
      <div className="min-w-0">
        {/* Título en la tipografía de encabezados, compacta y de peso firme. */}
        <h1 className="text-3xl leading-tight font-semibold">{titulo}</h1>
        {descripcion && <p className="mt-1 max-w-prose text-sm text-muted-foreground">{descripcion}</p>}
      </div>
      {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
    </div>
  );
}
