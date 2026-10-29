import { QueryTypes } from "sequelize";
import {
  ESTADOS_TURNO_CON_CUPO, incluyeCastracion, incluyeChipeo, MOTIVOS_CANCELACION, TIPOS_PROCEDIMIENTO, ZONA_HORARIA,
} from "@/lib/constantes";
import { sequelize } from "@/lib/db";
import { hoyLocal, limitesDelRango, mesesDelRango } from "@/lib/fechas";
import { porcentaje, promedioDeTexto } from "@/lib/indicadores";
import type { FiltrosReportes } from "@/schemas/reportes";

/**
 * Reportes estadísticos (F13). No tienen tablas propias: se calculan con consultas de
 * agregación sobre operativo, turno, procedimiento y reporte_avistamiento (Fase 2, §6).
 * Las consultas usan SQL con parámetros nombrados (`:zonaId`); los valores nunca se
 * concatenan al texto de la consulta.
 */

/** Castraciones y chipeos realizados en los operativos de una zona. */
export interface ProcedimientosZona {
  zona_id: number;
  zona: string;
  castraciones: number;
  chipeos: number;
}

/** Cumplimiento de los operativos ya ocurridos: realizados / (realizados + cancelados). */
export interface CumplimientoOperativos {
  realizados: number;
  cancelados: number;
  /** Operativos de fecha pasada que siguen programados o en curso (no entran en la fórmula). */
  sin_cerrar: number;
  porcentaje: number | null;
}

/** Ocupación del cupo de un operativo: turnos asignados (no cancelados) / cupo máximo. */
export interface OcupacionOperativo {
  id: number;
  /** YYYY-MM-DD */
  fecha: string;
  lugar: string;
  zona: string;
  cupo_maximo: number;
  asignados: number;
  porcentaje: number;
}

/** Asistencia: completados / (completados + cancelados por "No se presentó"). */
export interface Asistencia {
  completados: number;
  ausentes: number;
  porcentaje: number | null;
}

/** Avistamientos de un mes según su estado actual y tiempo promedio de atención. */
export interface AvistamientosMes {
  /** YYYY-MM */
  mes: string;
  pendientes: number;
  atendidos: number;
  /** Días promedio entre el aviso y la atención de los atendidos del mes. */
  promedio_dias: number | null;
}

/** Resultado completo de los reportes para los filtros indicados. */
export interface ReporteEstadistico {
  procedimientos: ProcedimientosZona[];
  cumplimiento: CumplimientoOperativos;
  ocupacion: {
    operativos: OcupacionOperativo[];
    /** Ocupación total del período: suma de asignados / suma de cupos. */
    porcentaje: number | null;
  };
  asistencia: Asistencia;
  avistamientos: {
    meses: AvistamientosMes[];
    /** Promedio de días de atención de todos los atendidos del período. */
    promedio_dias: number | null;
  };
}

/** Parámetros nombrados comunes a todas las consultas. */
interface Parametros {
  /** Zona elegida o null (todas). `:zonaId IS NULL` desactiva el filtro. */
  zonaId: number | null;
  /** Días del período (columnas DATE del operativo). */
  desde: string;
  hasta: string;
  /** Instantes del período (columnas TIMESTAMPTZ): [inicio, fin). */
  inicio: Date;
  fin: Date;
}

/** Ejecuta una consulta de lectura con parámetros nombrados. */
function consultar<T extends object>(sql: string, replacements: Record<string, unknown>): Promise<T[]> {
  return sequelize.query<T>(sql, { replacements, type: QueryTypes.SELECT });
}

/** Castraciones y chipeos por zona del operativo (castración y chipeo suma a ambos). */
async function procedimientosPorZona(parametros: Parametros): Promise<ProcedimientosZona[]> {
  const filas = await consultar<{ zona_id: number; zona: string; castraciones: string; chipeos: string }>(
    `SELECT z.id AS zona_id, z.nombre AS zona,
            COUNT(*) FILTER (WHERE p.tipo IN (:conCastracion)) AS castraciones,
            COUNT(*) FILTER (WHERE p.tipo IN (:conChipeo)) AS chipeos
       FROM procedimiento p
       JOIN turno t ON t.id = p.turno_id
       JOIN operativo o ON o.id = t.operativo_id
       JOIN zona z ON z.id = o.zona_id
      WHERE p.fecha >= :inicio AND p.fecha < :fin
        AND (:zonaId IS NULL OR o.zona_id = :zonaId)
      GROUP BY z.id, z.nombre
      ORDER BY z.nombre`,
    {
      ...parametros,
      // Los tipos se derivan de las reglas de dominio, no de literales repetidos.
      conCastracion: TIPOS_PROCEDIMIENTO.filter(incluyeCastracion),
      conChipeo: TIPOS_PROCEDIMIENTO.filter(incluyeChipeo),
    },
  );
  return filas.map((fila) => ({
    zona_id: fila.zona_id,
    zona: fila.zona,
    castraciones: Number(fila.castraciones),
    chipeos: Number(fila.chipeos),
  }));
}

/** Cumplimiento sobre los operativos del período cuya fecha ya pasó. */
async function cumplimientoOperativos(parametros: Parametros): Promise<CumplimientoOperativos> {
  const [fila] = await consultar<{ realizados: string; cancelados: string; sin_cerrar: string }>(
    `SELECT COUNT(*) FILTER (WHERE o.estado = 'realizado') AS realizados,
            COUNT(*) FILTER (WHERE o.estado = 'cancelado') AS cancelados,
            COUNT(*) FILTER (WHERE o.estado IN ('programado', 'en_curso')) AS sin_cerrar
       FROM operativo o
      WHERE o.fecha BETWEEN :desde AND :hasta
        AND o.fecha < :hoy
        AND (:zonaId IS NULL OR o.zona_id = :zonaId)`,
    { ...parametros, hoy: hoyLocal() },
  );
  const realizados = Number(fila.realizados);
  const cancelados = Number(fila.cancelados);
  return {
    realizados,
    cancelados,
    sin_cerrar: Number(fila.sin_cerrar),
    porcentaje: porcentaje(realizados, realizados + cancelados),
  };
}

/** Ocupación de cada operativo no cancelado del período, en orden cronológico. */
async function ocupacionPorOperativo(parametros: Parametros): Promise<ReporteEstadistico["ocupacion"]> {
  const filas = await consultar<{
    id: number; fecha: string; lugar: string; zona: string; cupo_maximo: number; asignados: string;
  }>(
    `SELECT o.id, to_char(o.fecha, 'YYYY-MM-DD') AS fecha, o.lugar, z.nombre AS zona, o.cupo_maximo,
            (SELECT COUNT(*) FROM turno t WHERE t.operativo_id = o.id AND t.estado IN (:conCupo)) AS asignados
       FROM operativo o
       JOIN zona z ON z.id = o.zona_id
      WHERE o.estado <> 'cancelado'
        AND o.fecha BETWEEN :desde AND :hasta
        AND (:zonaId IS NULL OR o.zona_id = :zonaId)
      ORDER BY o.fecha, o.hora_inicio, o.id`,
    { ...parametros, conCupo: ESTADOS_TURNO_CON_CUPO },
  );
  const operativos = filas.map((fila) => {
    const asignados = Number(fila.asignados);
    return {
      id: fila.id,
      fecha: fila.fecha,
      lugar: fila.lugar,
      zona: fila.zona,
      cupo_maximo: fila.cupo_maximo,
      asignados,
      // El cupo es siempre mayor a 0 (ck_operativo_cupo): el porcentaje nunca es null.
      porcentaje: porcentaje(asignados, fila.cupo_maximo) ?? 0,
    };
  });
  const totalAsignados = operativos.reduce((suma, operativo) => suma + operativo.asignados, 0);
  const totalCupo = operativos.reduce((suma, operativo) => suma + operativo.cupo_maximo, 0);
  return { operativos, porcentaje: porcentaje(totalAsignados, totalCupo) };
}

/** Asistencia a los turnos de los operativos del período. */
async function asistencia(parametros: Parametros): Promise<Asistencia> {
  const [fila] = await consultar<{ completados: string; ausentes: string }>(
    `SELECT COUNT(*) FILTER (WHERE t.estado = 'completado') AS completados,
            COUNT(*) FILTER (WHERE t.estado = 'cancelado' AND t.motivo_cancelacion = :noSePresento) AS ausentes
       FROM turno t
       JOIN operativo o ON o.id = t.operativo_id
      WHERE o.fecha BETWEEN :desde AND :hasta
        AND (:zonaId IS NULL OR o.zona_id = :zonaId)`,
    { ...parametros, noSePresento: MOTIVOS_CANCELACION.noSePresento },
  );
  const completados = Number(fila.completados);
  const ausentes = Number(fila.ausentes);
  return { completados, ausentes, porcentaje: porcentaje(completados, completados + ausentes) };
}

/** Evolución mensual de los avistamientos del período (todos los meses, aunque no tengan reportes). */
async function avistamientosPorMes(parametros: Parametros): Promise<ReporteEstadistico["avistamientos"]> {
  // Días transcurridos entre el aviso y la atención (EPOCH está en segundos).
  const diasDeAtencion = "EXTRACT(EPOCH FROM (r.fecha_atencion - r.fecha)) / 86400";
  const condiciones = `r.fecha >= :inicio AND r.fecha < :fin AND (:zonaId IS NULL OR r.zona_id = :zonaId)`;
  const reemplazos = { ...parametros, zonaHoraria: ZONA_HORARIA };

  const filas = await consultar<{ mes: string; pendientes: string; atendidos: string; promedio_dias: string | null }>(
    `SELECT to_char(r.fecha AT TIME ZONE :zonaHoraria, 'YYYY-MM') AS mes,
            COUNT(*) FILTER (WHERE r.estado = 'pendiente') AS pendientes,
            COUNT(*) FILTER (WHERE r.estado = 'atendido') AS atendidos,
            AVG(${diasDeAtencion}) FILTER (WHERE r.estado = 'atendido') AS promedio_dias
       FROM reporte_avistamiento r
      WHERE ${condiciones}
      GROUP BY 1`,
    reemplazos,
  );
  const [total] = await consultar<{ promedio_dias: string | null }>(
    `SELECT AVG(${diasDeAtencion}) AS promedio_dias
       FROM reporte_avistamiento r
      WHERE r.estado = 'atendido' AND ${condiciones}`,
    reemplazos,
  );

  const porMes = new Map(filas.map((fila) => [fila.mes, fila]));
  return {
    meses: mesesDelRango(parametros.desde, parametros.hasta).map((mes) => {
      const fila = porMes.get(mes);
      return {
        mes,
        pendientes: Number(fila?.pendientes ?? 0),
        atendidos: Number(fila?.atendidos ?? 0),
        promedio_dias: promedioDeTexto(fila?.promedio_dias ?? null),
      };
    }),
    promedio_dias: promedioDeTexto(total.promedio_dias),
  };
}

/** Calcula todos los indicadores de F13 para la zona (o todas) y el rango de fechas. */
export async function generarReportes(filtros: FiltrosReportes): Promise<ReporteEstadistico> {
  const parametros: Parametros = {
    zonaId: filtros.zona_id ?? null,
    desde: filtros.desde,
    hasta: filtros.hasta,
    ...limitesDelRango(filtros.desde, filtros.hasta),
  };
  const [procedimientos, cumplimiento, ocupacion, asistenciaTurnos, avistamientos] = await Promise.all([
    procedimientosPorZona(parametros),
    cumplimientoOperativos(parametros),
    ocupacionPorOperativo(parametros),
    asistencia(parametros),
    avistamientosPorMes(parametros),
  ]);
  return { procedimientos, cumplimiento, ocupacion, asistencia: asistenciaTurnos, avistamientos };
}
