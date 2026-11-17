"use client";

import { Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from "recharts";

/**
 * Colores de las series, tomados de la paleta del tema (`--chart-*` en globals.css):
 * cambian solos entre modo claro y oscuro. Los nombres describen el tono, no un valor fijo.
 */
export const COLORES_GRAFICO = {
  azul: "var(--chart-2)",
  verde: "var(--chart-1)",
  ambar: "var(--chart-3)",
  rojo: "var(--chart-4)",
  calafate: "var(--chart-5)",
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
      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
      <XAxis dataKey={claveX} tick={ticks} stroke="var(--border)" />
      <YAxis
        allowDecimals={false}
        width={44}
        domain={porcentaje ? [0, 100] : undefined}
        unit={porcentaje ? "%" : undefined}
        tick={ticks}
        stroke="var(--border)"
      />
      <Tooltip
        contentStyle={{
          backgroundColor: "var(--popover)",
          borderColor: "var(--border)",
          color: "var(--popover-foreground)",
          borderRadius: 8,
        }}
        cursor={{ fill: "var(--muted)" }}
      />
      <Legend wrapperStyle={{ fontSize: 13 }} />
      {series.map((serie) => (
        <Bar
          key={serie.clave}
          dataKey={serie.clave}
          name={serie.nombre}
          fill={serie.color}
          radius={apiladas ? 0 : [3, 3, 0, 0]}
          maxBarSize={48}
          stackId={apiladas ? "total" : undefined}
        />
      ))}
    </BarChart>
  );
}
