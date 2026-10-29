import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";

/** Etiqueta + control + mensaje de error de un campo de formulario. */
export function CampoFormulario({ id, etiqueta, error, children }: {
  id: string;
  etiqueta: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{etiqueta}</Label>
      {children}
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
    </div>
  );
}
