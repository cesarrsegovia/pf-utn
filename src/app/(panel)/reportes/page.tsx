import { ReportesEstadisticos } from "@/components/reportes/reportes-estadisticos";
import { exigirPermisoPagina } from "@/lib/sesion";

/** F13 — Reportes estadísticos (administrador y operador). */
export default async function PaginaReportes() {
  await exigirPermisoPagina("reportes:ver");
  return <ReportesEstadisticos />;
}
