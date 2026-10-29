"use client";

import type { ReactNode } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Botones de acción de una fila: editar y eliminar (si se indican) más acciones extra. */
export function AccionesFila({ onEditar, onEliminar, textoEliminar = "Eliminar", children }: {
  onEditar?: () => void;
  onEliminar?: () => void;
  textoEliminar?: string;
  /** Acciones adicionales propias del módulo (ej.: reactivar). */
  children?: ReactNode;
}) {
  return (
    <div className="flex justify-end gap-1">
      {children}
      {onEditar && (
        <Button variant="ghost" size="icon-sm" aria-label="Editar" title="Editar" onClick={onEditar}>
          <Pencil />
        </Button>
      )}
      {onEliminar && (
        <Button variant="ghost" size="icon-sm" aria-label={textoEliminar} title={textoEliminar} onClick={onEliminar}>
          <Trash2 />
        </Button>
      )}
    </div>
  );
}
