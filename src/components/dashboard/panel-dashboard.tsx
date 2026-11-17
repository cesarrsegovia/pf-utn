import Link from "next/link";
import type { ReactNode } from "react";
import { BadgeTurno } from "@/components/comunes/badges-dominio";
import { TablaDatos, type Columna } from "@/components/comunes/tabla-datos";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatearCantidad } from "@/lib/cantidades";
import { ETIQUETAS_TIPO_PROCEDIMIENTO } from "@/lib/etiquetas";
import { formatearFecha, formatearFechaHora } from "@/lib/fechas";
import type { AvistamientoDto } from "@/services/avistamientos";
import type { ResumenDashboard } from "@/services/dashboard";
import type { InsumoDto } from "@/services/insumos";
import type { OperativoDto } from "@/services/operativos";
import type { TurnoDto } from "@/services/turnos";

/**
 * Inicio del panel (componente de servidor: recibe los datos ya calculados por
 * `resumenDashboard`, sin consultas desde el navegador).
 */

/** Tarjeta de una sección del inicio, con enlace opcional al módulo completo. */
function Seccion({ titulo, descripcion, href, children }: {
  titulo: string;
  descripcion?: string;
  href?: string;
  children: ReactNode;
}) {
  return (
    // La tabla ocupa el ancho completo de la tarjeta, sin borde propio ni margen inferior.
    <Card className="pb-0">
      <CardHeader>
        <CardTitle>{titulo}</CardTitle>
        {descripcion && <CardDescription>{descripcion}</CardDescription>}
        {href && (
          <CardAction>
            <Link href={href} className={buttonVariants({ variant: "outline", size: "sm" })}>Ver todos</Link>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="px-0">{children}</CardContent>
    </Card>
  );
}

/** Celda de la franja de totales: cifra destacada y, opcionalmente, su proporción. */
function Total({ titulo, valor, detalle }: { titulo: string; valor: number; detalle?: string }) {
  return (
    <div className="bg-card px-5 py-4">
      <p className="text-sm text-muted-foreground">{titulo}</p>
      <p className="mt-1 font-heading text-4xl leading-none font-semibold tabular-nums">{valor}</p>
      {detalle && <p className="mt-2 text-xs text-muted-foreground">{detalle}</p>}
    </div>
  );
}

/** Porcentaje entero de `parte` sobre `total` como texto ("32 % de los animales"); sin total no hay detalle. */
function proporcion(parte: number, total: number): string | undefined {
  if (total === 0) return undefined;
  return `${Math.round((parte / total) * 100)} % de los animales`;
}

const COLUMNAS_TURNOS: Columna<TurnoDto>[] = [
  { titulo: "Horario", celda: (t) => t.horario },
  { titulo: "Animal", celda: (t) => t.animal },
  { titulo: "Tutor", celda: (t) => t.tutor ?? "Sin tutor" },
  { titulo: "Procedimiento", celda: (t) => ETIQUETAS_TIPO_PROCEDIMIENTO[t.tipo_solicitado] },
  { titulo: "Lugar", celda: (t) => `${t.lugar} (${t.zona})` },
  { titulo: "Estado", celda: (t) => <BadgeTurno estado={t.estado} /> },
];

const COLUMNAS_OPERATIVOS: Columna<OperativoDto>[] = [
  {
    titulo: "Fecha",
    celda: (o) => (
      <Link href={`/operativos/${o.id}`} className="font-medium underline-offset-4 hover:underline">
        {formatearFecha(o.fecha)} {o.hora_inicio}–{o.hora_fin}
      </Link>
    ),
  },
  { titulo: "Zona", celda: (o) => o.zona },
  // El lugar es el texto más largo: puede ocupar dos líneas para que la tabla entre en la tarjeta.
  { titulo: "Lugar", className: "min-w-36 whitespace-normal", celda: (o) => o.lugar },
  { titulo: "Disponibles", className: "text-right", celda: (o) => `${o.disponibles} de ${o.cupo_maximo}` },
];

const COLUMNAS_INSUMOS: Columna<InsumoDto>[] = [
  {
    titulo: "Insumo",
    celda: (i) => (
      <Link href={`/insumos/${i.id}`} className="font-medium underline-offset-4 hover:underline">{i.nombre}</Link>
    ),
  },
  { titulo: "Stock", className: "text-right text-destructive", celda: (i) => formatearCantidad(i.stock_actual, i.unidad) },
  { titulo: "Mínimo", className: "text-right", celda: (i) => formatearCantidad(i.stock_minimo, i.unidad) },
];

const COLUMNAS_AVISTAMIENTOS: Columna<AvistamientoDto>[] = [
  { titulo: "Fecha", celda: (r) => formatearFechaHora(r.fecha) },
  { titulo: "Zona", celda: (r) => r.zona },
  { titulo: "Animales", className: "text-right", celda: (r) => r.cantidad_animales },
];

/** Turnos de hoy (común a todos los roles). */
function TurnosHoy({ turnos, descripcion }: { turnos: TurnoDto[]; descripcion: string }) {
  return (
    <Seccion titulo="Turnos de hoy" descripcion={descripcion}>
      <TablaDatos columnas={COLUMNAS_TURNOS} filas={turnos} claveFila={(t) => t.id} mensajeVacio="No hay turnos para hoy" integrada />
    </Seccion>
  );
}

/** Contenido del inicio según el rol del usuario en sesión. */
export function PanelDashboard({ resumen }: { resumen: ResumenDashboard }) {
  if (resumen.tipo === "veterinario") {
    return resumen.motivo ? (
      <p role="alert" className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">{resumen.motivo}</p>
    ) : (
      <TurnosHoy turnos={resumen.turnos_hoy} descripcion="Turnos de los operativos de hoy a los que está asignado/a." />
    );
  }

  const { totales } = resumen;
  return (
    <div className="grid gap-6">
      {/* Franja de totales: una sola pieza dividida por líneas finas (gap de 1px sobre el color de borde). */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border lg:grid-cols-4">
        <Total titulo="Vecinos activos" valor={totales.vecinos_activos} />
        <Total titulo="Animales registrados" valor={totales.animales} />
        <Total titulo="Castrados" valor={totales.castrados} detalle={proporcion(totales.castrados, totales.animales)} />
        <Total titulo="Chipeados" valor={totales.chipeados} detalle={proporcion(totales.chipeados, totales.animales)} />
      </div>
      <TurnosHoy turnos={resumen.turnos_hoy} descripcion="Turnos no cancelados de los operativos de hoy." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Seccion titulo="Próximos operativos con cupo" href="/operativos">
          <TablaDatos
            columnas={COLUMNAS_OPERATIVOS}
            filas={resumen.proximos_operativos}
            claveFila={(o) => o.id}
            integrada
            mensajeVacio="No hay operativos programados con cupo disponible"
          />
        </Seccion>
        <Seccion
          titulo="Insumos bajo el mínimo"
          descripcion={`${resumen.insumos_bajo_minimo.total} insumo(s) con stock en o por debajo del mínimo.`}
          href="/insumos"
        >
          <TablaDatos
            columnas={COLUMNAS_INSUMOS}
            filas={resumen.insumos_bajo_minimo.filas}
            claveFila={(i) => i.id}
            integrada
            mensajeVacio="Todos los insumos están sobre el mínimo"
          />
        </Seccion>
        <Seccion
          titulo="Avistamientos pendientes"
          descripcion={`${resumen.avistamientos_pendientes.total} reporte(s) sin atender.`}
          href="/avistamientos"
        >
          <TablaDatos
            columnas={COLUMNAS_AVISTAMIENTOS}
            filas={resumen.avistamientos_pendientes.filas}
            claveFila={(r) => r.id}
            integrada
            mensajeVacio="No hay avistamientos pendientes"
          />
        </Seccion>
      </div>
    </div>
  );
}
