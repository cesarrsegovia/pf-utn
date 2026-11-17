import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Colores por tono semántico; cada fase mapea sus estados a uno de estos tonos. */
const CLASES_TONO = {
  exito: "bg-[#e2efe7] text-[#1f5a3d] dark:bg-[#183a2b] dark:text-[#9ad3b4]",
  alerta: "bg-[#f8ecd2] text-[#7a520c] dark:bg-[#3d2f12] dark:text-[#e9c27a]",
  peligro: "bg-[#f7e0de] text-[#8f1f18] dark:bg-[#43201d] dark:text-[#f2a39b]",
  info: "bg-[#ddebf2] text-[#1e5672] dark:bg-[#17323f] dark:text-[#93c6de]",
  neutro: "bg-muted text-muted-foreground",
} as const;
export type TonoEstado = keyof typeof CLASES_TONO;

/** Etiqueta de estado con color según su tono. */
export function BadgeEstado({ texto, tono }: { texto: string; tono: TonoEstado }) {
  return (
    <Badge variant="outline" className={cn("gap-1.5 border-transparent font-medium", CLASES_TONO[tono])}>
      {/* Punto de color: refuerza el estado sin depender solo del texto. */}
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {texto}
    </Badge>
  );
}
