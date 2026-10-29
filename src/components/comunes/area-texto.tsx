import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Área de texto con el mismo aspecto que `Input` (no hay componente Textarea de shadcn instalado).
 * Acepta las props de `<textarea>`, incluido lo que devuelve `register()` de react-hook-form.
 */
export function AreaTexto({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "min-h-20 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}
