"use client";

import { useState, type ReactNode } from "react";
import useSWR from "swr";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FiltroFecha } from "@/components/comunes/filtro-fecha";
import { FiltroZona } from "@/components/comunes/filtro-zona";
import { TablaDatos, type Columna } from "@/components/comunes/tabla-datos";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { obtenerJson } from "@/lib/cliente-api";
import { formatearFecha, formatearMes, rangoUltimosMeses } from "@/lib/fechas";
import { formatearPorcentaje } from "@/lib/indicadores";
import type {
  AvistamientosMes, OcupacionOperativo, ProcedimientosZona, ReporteEstadistico,
} from "@/services/reportes";
import { COLORES_GRAFICO, GraficoBarras } from "./grafico-barras";

/** Fila de los indicadores de dos categorías (cumplimiento y asistencia). */
interface FilaCategoria {
  categoria: string;
  cantidad: number;
}

/** Columnas de las tablas de dos categorías. */
const columnasCategoria = (titulo: string): Columna<FilaCategoria>[] => [
  { titulo: "Categoría", celda: (fila) => fila.categoria },
  { titulo, className: "text-right", celda: (fila) => fila.cantidad },
];

/** Tarjeta de un indicador: título, fórmula, valor destacado (opcional), gráfico y tabla. */
function TarjetaIndicador({ titulo, descripcion, valor, children }: {
  titulo: string;
  descripcion: string;
  valor?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{titulo}</CardTitle>
        <CardDescription>{descripcion}</CardDescription>
        {valor && <p className="text-2xl font-semibold tracking-tight">{valor}</p>}
      </CardHeader>
      <CardContent className="grid gap-4">{children}</CardContent>
    </Card>
  );
}

/** Castraciones y chipeos por zona. */
function IndicadorProcedimientos({ filas }: { filas: ProcedimientosZona[] }) {
  const castraciones = filas.reduce((total, fila) => total + fila.castraciones, 0);
  const chipeos = filas.reduce((total, fila) => total + fila.chipeos, 0);
  const columnas: Columna<ProcedimientosZona>[] = [
    { titulo: "Zona", celda: (fila) => fila.zona },
    { titulo: "Castraciones", className: "text-right", celda: (fila) => fila.castraciones },
    { titulo: "Chipeos", className: "text-right", celda: (fila) => fila.chipeos },
  ];
  return (
    <TarjetaIndicador
      titulo="Castraciones y chipeos por zona"
      descripcion="Procedimientos registrados en el período, según la zona del operativo. «Castración y chipeo» suma a ambos."
      valor={`${castraciones} castraciones · ${chipeos} chipeos`}
    >
      <GraficoBarras
        datos={filas}
        claveX="zona"
        series={[
          { clave: "castraciones", nombre: "Castraciones", color: COLORES_GRAFICO.azul },
          { clave: "chipeos", nombre: "Chipeos", color: COLORES_GRAFICO.verde },
        ]}
      />
      <TablaDatos columnas={columnas} filas={filas} claveFila={(fila) => fila.zona_id} mensajeVacio="Sin procedimientos en el período" />
    </TarjetaIndicador>
  );
}

/** Cumplimiento de operativos. */
function IndicadorCumplimiento({ cumplimiento }: { cumplimiento: ReporteEstadistico["cumplimiento"] }) {
  const filas: FilaCategoria[] = [
    { categoria: "Realizados", cantidad: cumplimiento.realizados },
    { categoria: "Cancelados", cantidad: cumplimiento.cancelados },
  ];
  return (
    <TarjetaIndicador
      titulo="Cumplimiento de operativos"
      descripcion={
        "Realizados / (realizados + cancelados), sobre los operativos con fecha ya pasada. " +
        `Sin cerrar (programados o en curso con fecha pasada, no entran en el cálculo): ${cumplimiento.sin_cerrar}.`
      }
      valor={formatearPorcentaje(cumplimiento.porcentaje)}
    >
      <GraficoBarras
        datos={filas}
        claveX="categoria"
        series={[{ clave: "cantidad", nombre: "Operativos", color: COLORES_GRAFICO.azul }]}
      />
      <TablaDatos columnas={columnasCategoria("Operativos")} filas={filas} claveFila={(fila) => fila.categoria} />
    </TarjetaIndicador>
  );
}

/** Ocupación de cupo por operativo. */
function IndicadorOcupacion({ ocupacion }: { ocupacion: ReporteEstadistico["ocupacion"] }) {
  // Etiqueta corta del eje: DD/MM del operativo.
  const datos = ocupacion.operativos.map((operativo) => ({ ...operativo, dia: formatearFecha(operativo.fecha).slice(0, 5) }));
  const columnas: Columna<OcupacionOperativo>[] = [
    { titulo: "Fecha", celda: (o) => formatearFecha(o.fecha) },
    { titulo: "Lugar", celda: (o) => o.lugar },
    { titulo: "Zona", celda: (o) => o.zona },
    { titulo: "Asignados / cupo", className: "text-right", celda: (o) => `${o.asignados} / ${o.cupo_maximo}` },
    { titulo: "Ocupación", className: "text-right", celda: (o) => formatearPorcentaje(o.porcentaje) },
  ];
  return (
    <TarjetaIndicador
      titulo="Ocupación de cupo por operativo"
      descripcion="Turnos asignados (no cancelados) / cupo máximo, en los operativos no cancelados del período. El valor destacado es la ocupación total."
      valor={formatearPorcentaje(ocupacion.porcentaje)}
    >
      <GraficoBarras
        datos={datos}
        claveX="dia"
        porcentaje
        series={[{ clave: "porcentaje", nombre: "Ocupación (%)", color: COLORES_GRAFICO.azul }]}
      />
      <TablaDatos
        columnas={columnas}
        filas={ocupacion.operativos}
        claveFila={(o) => o.id}
        mensajeVacio="Sin operativos en el período"
      />
    </TarjetaIndicador>
  );
}

/** Asistencia a los turnos. */
function IndicadorAsistencia({ asistencia }: { asistencia: ReporteEstadistico["asistencia"] }) {
  const filas: FilaCategoria[] = [
    { categoria: "Asistieron (completados)", cantidad: asistencia.completados },
    { categoria: "No se presentaron", cantidad: asistencia.ausentes },
  ];
  return (
    <TarjetaIndicador
      titulo="Asistencia a los turnos"
      descripcion="Completados / (completados + cancelados con motivo «No se presentó»)."
      valor={formatearPorcentaje(asistencia.porcentaje)}
    >
      <GraficoBarras
        datos={filas}
        claveX="categoria"
        series={[{ clave: "cantidad", nombre: "Turnos", color: COLORES_GRAFICO.verde }]}
      />
      <TablaDatos columnas={columnasCategoria("Turnos")} filas={filas} claveFila={(fila) => fila.categoria} />
    </TarjetaIndicador>
  );
}

/** Evolución mensual de avistamientos y tiempo promedio de atención. */
function IndicadorAvistamientos({ avistamientos }: { avistamientos: ReporteEstadistico["avistamientos"] }) {
  const datos = avistamientos.meses.map((mes) => ({ ...mes, etiqueta: formatearMes(mes.mes) }));
  const promedio = avistamientos.promedio_dias;
  const columnas: Columna<AvistamientosMes>[] = [
    { titulo: "Mes", celda: (m) => formatearMes(m.mes) },
    { titulo: "Pendientes", className: "text-right", celda: (m) => m.pendientes },
    { titulo: "Atendidos", className: "text-right", celda: (m) => m.atendidos },
    {
      titulo: "Días promedio de atención",
      className: "text-right",
      celda: (m) => (m.promedio_dias === null ? "—" : m.promedio_dias.toLocaleString("es-AR")),
    },
  ];
  return (
    <TarjetaIndicador
      titulo="Avistamientos por mes"
      descripcion="Reportes del período según su estado actual. Tiempo de atención: días entre el aviso y la atención."
      valor={promedio === null ? "Sin reportes atendidos" : `${promedio.toLocaleString("es-AR")} días promedio de atención`}
    >
      <GraficoBarras
        datos={datos}
        claveX="etiqueta"
        apiladas
        series={[
          { clave: "pendientes", nombre: "Pendientes", color: COLORES_GRAFICO.ambar },
          { clave: "atendidos", nombre: "Atendidos", color: COLORES_GRAFICO.verde },
        ]}
      />
      <TablaDatos columnas={columnas} filas={avistamientos.meses} claveFila={(m) => m.mes} />
    </TarjetaIndicador>
  );
}

/**
 * Pantalla de F13: filtros de zona y período (por defecto, los últimos 12 meses) y un
 * gráfico más una tabla por cada indicador. Todo se calcula en el servidor.
 */
export function ReportesEstadisticos() {
  const [filtros, setFiltros] = useState(() => ({ zona_id: "", ...rangoUltimosMeses(12) }));
  const rangoValido = filtros.desde !== "" && filtros.hasta !== "" && filtros.desde <= filtros.hasta;

  const parametros = new URLSearchParams({ desde: filtros.desde, hasta: filtros.hasta });
  if (filtros.zona_id) parametros.set("zona_id", filtros.zona_id);
  // Con un rango inválido no se consulta (la API respondería 400).
  const { data, isLoading } = useSWR<ReporteEstadistico>(
    rangoValido ? `/api/reportes?${parametros}` : null,
    obtenerJson,
    { keepPreviousData: true },
  );

  const cambiar = (clave: keyof typeof filtros) => (valor: string) =>
    setFiltros((anteriores) => ({ ...anteriores, [clave]: valor }));

  return (
    <>
      <EncabezadoPagina
        titulo="Reportes estadísticos"
        descripcion="Indicadores del programa por zona y período. Cada indicador se muestra en un gráfico y en una tabla."
      />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <FiltroZona valor={filtros.zona_id} onCambiar={cambiar("zona_id")} />
        <FiltroFecha etiqueta="Desde" valor={filtros.desde} onCambiar={cambiar("desde")} />
        <FiltroFecha etiqueta="Hasta" valor={filtros.hasta} onCambiar={cambiar("hasta")} />
        {!rangoValido && (
          <p role="alert" className="text-sm text-destructive">Elija un rango válido: «desde» no puede ser posterior a «hasta».</p>
        )}
      </div>
      {!data ? (
        <p className="text-sm text-muted-foreground">{isLoading ? "Calculando indicadores…" : "Sin datos para mostrar"}</p>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <IndicadorProcedimientos filas={data.procedimientos} />
          <IndicadorCumplimiento cumplimiento={data.cumplimiento} />
          <IndicadorOcupacion ocupacion={data.ocupacion} />
          <IndicadorAsistencia asistencia={data.asistencia} />
          <IndicadorAvistamientos avistamientos={data.avistamientos} />
        </div>
      )}
    </>
  );
}
