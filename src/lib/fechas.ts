import { ZONA_HORARIA } from "./constantes";

/**
 * Fechas del dominio. Las fechas sin hora (operativos, bajas) se manejan como texto
 * YYYY-MM-DD en la zona horaria de Río Grande, independientemente de la del servidor.
 */

/** Fecha actual en Río Grande con formato YYYY-MM-DD. */
export function hoyLocal(): string {
  // El locale en-CA formatea las fechas como YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_HORARIA }).format(new Date());
}

/** Suma (o resta, con valores negativos) días a una fecha YYYY-MM-DD. */
export function sumarDias(fecha: string, dias: number): string {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  // Date.UTC normaliza los desbordes de día/mes (ej.: 32 de diciembre → 1 de enero).
  return new Date(Date.UTC(anio, mes - 1, dia + dias)).toISOString().slice(0, 10);
}

/** YYYY-MM-DD → DD/MM/AAAA, para mostrar en pantalla. */
export function formatearFecha(fecha: string): string {
  const [anio, mes, dia] = fecha.split("-");
  return `${dia}/${mes}/${anio}`;
}

/** Fecha y hora (ISO o Date) en la zona horaria de Río Grande, formato corto argentino. */
export function formatearFechaHora(valor: string | Date): string {
  return new Intl.DateTimeFormat("es-AR", { timeZone: ZONA_HORARIA, dateStyle: "short", timeStyle: "short" }).format(
    new Date(valor),
  );
}

/** Desfase de Río Grande respecto de UTC: UTC−3 todo el año (sin horario de verano). */
const DESFASE_LOCAL = "-03:00";

/** Milisegundos de una hora, para cálculos de anticipación (48 h, 24 h). */
export const MS_POR_HORA = 60 * 60 * 1000;

/** "09:30:00" o "09:30" → "09:30" (PostgreSQL devuelve las columnas TIME con segundos). */
export function horaCorta(hora: string): string {
  return hora.slice(0, 5);
}

/** Instante (Date) que corresponde a una fecha YYYY-MM-DD y una hora locales de Río Grande. */
export function instanteLocal(fecha: string, hora: string): Date {
  return new Date(`${fecha}T${horaCorta(hora)}:00${DESFASE_LOCAL}`);
}

/** Fecha (YYYY-MM-DD) y hora (HH:MM) de Río Grande que corresponden a un instante. */
export function partesLocales(valor: string | Date): { fecha: string; hora: string } {
  // Se desplaza el instante a UTC−3 y se leen sus componentes UTC (sin depender de la zona del servidor).
  const local = new Date(new Date(valor).getTime() - 3 * MS_POR_HORA).toISOString();
  return { fecha: local.slice(0, 10), hora: local.slice(11, 16) };
}

/** Límites [inicio, fin) de un rango de días locales completos: desde las 00:00 de `desde` hasta las 00:00 del día siguiente a `hasta`. */
export function limitesDelRango(desde: string, hasta: string): { inicio: Date; fin: Date } {
  return { inicio: instanteLocal(desde, "00:00"), fin: instanteLocal(sumarDias(hasta, 1), "00:00") };
}

/** Rango de los últimos `meses` meses calendario, incluido el actual: del día 1 de ese mes hasta hoy. */
export function rangoUltimosMeses(meses: number, hoy = hoyLocal()): { desde: string; hasta: string } {
  const [anio, mes] = hoy.split("-").map(Number);
  // Date.UTC normaliza los meses negativos (ej.: mes −2 de 2026 → octubre de 2025).
  const desde = new Date(Date.UTC(anio, mes - meses, 1)).toISOString().slice(0, 10);
  return { desde, hasta: hoy };
}

/** Meses (YYYY-MM) comprendidos entre dos fechas YYYY-MM-DD, ambos inclusive. */
export function mesesDelRango(desde: string, hasta: string): string[] {
  const [anio, mes] = desde.split("-").map(Number);
  const ultimo = hasta.slice(0, 7);
  const meses: string[] = [];
  for (let indice = 0; ; indice++) {
    const actual = new Date(Date.UTC(anio, mes - 1 + indice, 1)).toISOString().slice(0, 7);
    if (actual > ultimo) return meses;
    meses.push(actual);
  }
}

/** Abreviaturas de los meses para los gráficos (sin depender del ICU del entorno). */
const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

/** YYYY-MM → "Oct 2026". */
export function formatearMes(mes: string): string {
  const [anio, numero] = mes.split("-").map(Number);
  return `${MESES_CORTOS[numero - 1]} ${anio}`;
}
