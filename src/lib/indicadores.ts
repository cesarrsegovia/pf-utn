/** Cálculos comunes de los indicadores estadísticos (F13) y del dashboard. */

/** Porcentaje con un decimal (ej.: 2 de 3 → 66.7). Sin casos en el denominador devuelve null. */
export function porcentaje(parte: number, total: number): number | null {
  if (total === 0) return null;
  return Math.round((parte * 1000) / total) / 10;
}

/** Porcentaje para mostrar ("66,7 %"), o "—" si no hay datos para calcularlo. */
export function formatearPorcentaje(valor: number | null): string {
  return valor === null ? "—" : `${valor.toLocaleString("es-AR")} %`;
}

/** Promedio redondeado a un decimal de un valor numérico que PostgreSQL devuelve como texto (o null). */
export function promedioDeTexto(valor: string | null): number | null {
  return valor === null ? null : Math.round(Number(valor) * 10) / 10;
}
