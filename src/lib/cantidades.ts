/**
 * Cantidades de stock (columnas NUMERIC(10,2), que pg devuelve como texto).
 * Se opera en centésimos enteros para evitar errores de coma flotante (0.1 + 0.2).
 */

/** Convierte una cantidad (texto o número) a centésimos enteros. */
export function aCentesimos(valor: string | number): number {
  return Math.round(Number(valor) * 100);
}

/** Convierte centésimos a texto con dos decimales, listo para guardar en NUMERIC(10,2). */
export function deCentesimos(centesimos: number): string {
  return (centesimos / 100).toFixed(2);
}

/** Formato argentino con dos decimales y unidad opcional (ej.: "2,00 ml"). */
export function formatearCantidad(valor: string | number, unidad?: string): string {
  const texto = Number(valor).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return unidad ? `${texto} ${unidad}` : texto;
}
