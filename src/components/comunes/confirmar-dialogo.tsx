"use client";

import { useState } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Diálogo de confirmación controlado para acciones sensibles (eliminar, cancelar…).
 * Mientras `onConfirmar` se ejecuta, los botones quedan deshabilitados.
 */
export function ConfirmarDialogo({ abierto, titulo, descripcion, textoConfirmar = "Confirmar", onConfirmar, onCerrar }: {
  abierto: boolean;
  titulo: string;
  descripcion: string;
  textoConfirmar?: string;
  onConfirmar: () => Promise<void>;
  onCerrar: () => void;
}) {
  const [procesando, setProcesando] = useState(false);

  async function confirmar() {
    setProcesando(true);
    try {
      await onConfirmar();
    } finally {
      setProcesando(false);
    }
  }

  return (
    <AlertDialog open={abierto} onOpenChange={(abrir) => !abrir && !procesando && onCerrar()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          <AlertDialogDescription>{descripcion}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={procesando}>Volver</AlertDialogCancel>
          <AlertDialogAction disabled={procesando} onClick={confirmar}>
            {procesando ? "Procesando…" : textoConfirmar}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
