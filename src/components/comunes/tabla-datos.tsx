import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/** Definición de una columna: título y cómo renderizar la celda a partir de la fila. */
export interface Columna<T> {
  titulo: string;
  celda: (fila: T) => ReactNode;
  className?: string;
}

/**
 * Tabla genérica con estados de carga y de lista vacía.
 * `integrada` quita el marco propio cuando la tabla va dentro de una tarjeta.
 */
export function TablaDatos<T>({ columnas, filas, claveFila, cargando, mensajeVacio = "No hay registros para mostrar", integrada }: {
  columnas: Columna<T>[];
  filas: T[] | undefined;
  claveFila: (fila: T) => string | number;
  cargando?: boolean;
  mensajeVacio?: string;
  integrada?: boolean;
}) {
  const mensaje = cargando ? "Cargando…" : !filas?.length ? mensajeVacio : null;

  return (
    // Contenedor blanco sobre el fondo "estepa", con encabezado de columnas destacado.
    <div className={cn("overflow-hidden bg-card", integrada ? "border-t" : "rounded-lg border")}>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/60 hover:bg-muted/60">
            {columnas.map((columna) => (
              <TableHead key={columna.titulo} className={columna.className}>{columna.titulo}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {mensaje ? (
            <TableRow>
              <TableCell colSpan={columnas.length} className="h-28 text-center text-muted-foreground">{mensaje}</TableCell>
            </TableRow>
          ) : (
            filas!.map((fila) => (
              <TableRow key={claveFila(fila)}>
                {columnas.map((columna) => (
                  <TableCell key={columna.titulo} className={columna.className}>{columna.celda(fila)}</TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
