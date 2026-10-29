"use client";

import { Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from "recharts";

/** Colores de las series: contrastan sobre fondo claro y oscuro (el tema base es en grises). */
export const COLORES_GRAFICO = {
  azul: "#0284c7",
  verde: "#059669",
  ambar: "#d97706",
  rojo: "#dc2626",
} as const;

/** Serie de un gráfico de barras: propiedad del dato, nombre en la leyenda y color. */
export interface SerieGrafico<T> {
  clave: Extract<keyof T, string>;
  nombre: string;
  color: string;
}

/**
 * Gráfico de barras de Recharts para los reportes (F13). `responsive` ajusta el ancho al
 * contenedor (Recharts 3, sin ResponsiveContainer). Sin datos no dibuja nada: la tabla
 * del indicador ya muestra el mensaje de lista vacía.
 */
export function GraficoBarras<T extends object>({ datos, claveX, series, apiladas, porcentaje, alto = 260 }: {
  datos: T[];
  /** Propiedad que se muestra en el eje horizontal. */
  claveX: Extract<keyof T, string>;
  series: SerieGrafico<T>[];
  /** Apila las series en una sola barra (ej.: pendientes + atendidos). */
  apiladas?: boolean;
  /** Eje vertical de 0 a 100 con el sufijo "%". */
  porcentaje?: boolean;
  alto?: number;
}) {
  if (datos.length === 0) return null;
  const ticks = { fontSize: 12, fill: "var(--muted-foreground)" };
  return (
    <BarChart
      responsive
      data={datos}
      style={{ width: "100%", height: alto }}
      margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
    >
      <CartesianGrid strokeDasharray="3 3" vertical={false} />
      <XAxis dataKey={claveX} tick={ticks} />
      <YAxis
        allowDecimals={false}
        width={44}
        domain={porcentaje ? [0, 100] : undefined}
        unit={porcentaje ? "%" : undefined}
        tick={ticks}
      />
      <Tooltip
        contentStyle={{
          backgroundColor: "var(--popover)",
          borderColor: "var(--border)",
          color: "var(--popover-foreground)",
        }}
      />
      <Legend />
      {series.map((serie) => (
        <Bar
          key={serie.clave}
          dataKey={serie.clave}
          name={serie.nombre}
          fill={serie.color}
          stackId={apiladas ? "total" : undefined}
        />
      ))}
    </BarChart>
  );
}
