import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Colores por tono semántico; cada fase mapea sus estados a uno de estos tonos. */
const CLASES_TONO = {
  exito: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  alerta: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  peligro: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  info: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  neutro: "bg-muted text-muted-foreground",
} as const;
export type TonoEstado = keyof typeof CLASES_TONO;

/** Etiqueta de estado con color según su tono. */
export function BadgeEstado({ texto, tono }: { texto: string; tono: TonoEstado }) {
  return <Badge variant="outline" className={cn("border-transparent", CLASES_TONO[tono])}>{texto}</Badge>;
}
