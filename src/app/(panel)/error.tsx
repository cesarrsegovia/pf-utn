"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * Límite de error de las páginas del panel: si una página falla al mostrarse, presenta un
 * aviso en lugar de una pantalla en blanco y permite reintentar (Next 16 entrega `retry`).
 */
export default function ErrorPanel({ error, retry }: { error: unknown; retry: () => void }) {
  // El detalle queda en la consola del navegador; en producción Next oculta el mensaje real.
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto mt-16 grid max-w-md gap-4 rounded-lg border p-6 text-center">
      <h2 className="text-lg font-semibold">No se pudo mostrar esta página</h2>
      <p className="text-sm text-muted-foreground">
        Ocurrió un error inesperado. Puede reintentar; si el problema continúa, avise al administrador.
      </p>
      <div>
        <Button onClick={() => retry()}>Reintentar</Button>
      </div>
    </div>
  );
}
