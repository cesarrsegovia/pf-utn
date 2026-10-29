"use client";

import { Button } from "@/components/ui/button";

/** Controles de paginación: total de registros, página actual y navegación. */
export function Paginacion({ pagina, tamanio, total, onCambiar }: {
  pagina: number;
  tamanio: number;
  total: number;
  onCambiar: (pagina: number) => void;
}) {
  const totalPaginas = Math.max(1, Math.ceil(total / tamanio));
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
      <span>{total} registro{total === 1 ? "" : "s"}</span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={pagina <= 1} onClick={() => onCambiar(pagina - 1)}>Anterior</Button>
        <span>Página {pagina} de {totalPaginas}</span>
        <Button variant="outline" size="sm" disabled={pagina >= totalPaginas} onClick={() => onCambiar(pagina + 1)}>Siguiente</Button>
      </div>
    </div>
  );
}
