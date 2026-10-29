"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Diálogo de alta/edición. Se monta solo mientras está abierto (`{abierto && <Formulario />}`),
 * así cada apertura empieza con los valores iniciales. El `<form>` lo aporta el contenido
 * con el mismo `idFormulario`, al que apunta el botón Guardar.
 */
export function FormularioDialogo({ titulo, descripcion, idFormulario, enviando, amplio, textoEnviar, onCerrar, children }: {
  titulo: string;
  descripcion?: string;
  idFormulario: string;
  enviando: boolean;
  /** Diálogo más ancho, para formularios de dos columnas. */
  amplio?: boolean;
  /** Texto del botón principal cuando no es "Guardar" (ej.: "Cancelar turno"). El de cierre pasa a "Volver". */
  textoEnviar?: string;
  onCerrar: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog open onOpenChange={(abrir) => !abrir && !enviando && onCerrar()}>
      <DialogContent className={cn(amplio && "sm:max-w-2xl")}>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          {descripcion && <DialogDescription>{descripcion}</DialogDescription>}
        </DialogHeader>
        {children}
        <DialogFooter>
          {/* Con una acción distinta de "Guardar", el botón de cierre dice "Volver" para no confundir con "Cancelar …". */}
          <Button variant="outline" onClick={onCerrar} disabled={enviando}>{textoEnviar ? "Volver" : "Cancelar"}</Button>
          <Button type="submit" form={idFormulario} disabled={enviando}>
            {enviando ? (textoEnviar ? "Procesando…" : "Guardando…") : (textoEnviar ?? "Guardar")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
