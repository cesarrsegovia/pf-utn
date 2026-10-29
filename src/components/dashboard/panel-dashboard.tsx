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
    <Card>
      <CardHeader>
        <CardTitle>{titulo}</CardTitle>
        {descripcion && <CardDescription>{descripcion}</CardDescription>}
        {href && (
          <CardAction>
            <Link href={href} className={buttonVariants({ variant: "outline", size: "sm" })}>Ver todos</Link>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** Tarjeta con un total destacado. */
function Total({ titulo, valor }: { titulo: string; valor: number }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{titulo}</CardDescription>
        <CardTitle className="text-3xl tabular-nums">{valor}</CardTitle>
      </CardHeader>
    </Card>
  );
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
  { titulo: "Lugar", celda: (o) => o.lugar },
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
      <TablaDatos columnas={COLUMNAS_TURNOS} filas={turnos} claveFila={(t) => t.id} mensajeVacio="No hay turnos para hoy" />
    </Seccion>
  );
}

/** Contenido del inicio según el rol del usuario en sesión. */
export function PanelDashboard({ resumen }: { resumen: ResumenDashboard }) {
  if (resumen.tipo === "veterinario") {
    return resumen.motivo ? (
      <p role="alert" className="rounded-lg border p-4 text-sm text-muted-foreground">{resumen.motivo}</p>
    ) : (
      <TurnosHoy turnos={resumen.turnos_hoy} descripcion="Turnos de los operativos de hoy a los que está asignado/a." />
    );
  }

  const { totales } = resumen;
  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Total titulo="Vecinos activos" valor={totales.vecinos_activos} />
        <Total titulo="Animales registrados" valor={totales.animales} />
        <Total titulo="Animales castrados" valor={totales.castrados} />
        <Total titulo="Animales chipeados" valor={totales.chipeados} />
      </div>
      <TurnosHoy turnos={resumen.turnos_hoy} descripcion="Turnos no cancelados de los operativos de hoy." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Seccion titulo="Próximos operativos con cupo" href="/operativos">
          <TablaDatos
            columnas={COLUMNAS_OPERATIVOS}
            filas={resumen.proximos_operativos}
            claveFila={(o) => o.id}
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
            mensajeVacio="No hay avistamientos pendientes"
          />
        </Seccion>
      </div>
    </div>
  );
}
