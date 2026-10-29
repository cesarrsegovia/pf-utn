import type { Metadata } from "next";
import { ReportesEstadisticos } from "@/components/reportes/reportes-estadisticos";
import { exigirPermisoPagina } from "@/lib/sesion";

export const metadata: Metadata = { title: "Reportes" };

/** F13 — Reportes estadísticos (administrador y operador). */
export default async function PaginaReportes() {
  await exigirPermisoPagina("reportes:ver");
  return <ReportesEstadisticos />;
}
