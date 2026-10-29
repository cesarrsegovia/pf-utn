import type { ReactNode } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/** Definición de una columna: título y cómo renderizar la celda a partir de la fila. */
export interface Columna<T> {
  titulo: string;
  celda: (fila: T) => ReactNode;
  className?: string;
}

/** Tabla genérica con estados de carga y de lista vacía. */
export function TablaDatos<T>({ columnas, filas, claveFila, cargando, mensajeVacio = "No hay registros para mostrar" }: {
  columnas: Columna<T>[];
  filas: T[] | undefined;
  claveFila: (fila: T) => string | number;
  cargando?: boolean;
  mensajeVacio?: string;
}) {
  const mensaje = cargando ? "Cargando…" : !filas?.length ? mensajeVacio : null;

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            {columnas.map((columna) => (
              <TableHead key={columna.titulo} className={columna.className}>{columna.titulo}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {mensaje ? (
            <TableRow>
              <TableCell colSpan={columnas.length} className="h-24 text-center text-muted-foreground">{mensaje}</TableCell>
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
