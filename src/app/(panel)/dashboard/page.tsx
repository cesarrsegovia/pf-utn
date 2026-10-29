import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { PanelDashboard } from "@/components/dashboard/panel-dashboard";
import { ETIQUETAS_ROL } from "@/lib/etiquetas";
import { exigirPermisoPagina } from "@/lib/sesion";
import { resumenDashboard } from "@/services/dashboard";

/** Inicio del panel: panorama del programa (administrador y operador) o turnos del día (veterinario). */
export default async function PaginaDashboard() {
  const sesion = await exigirPermisoPagina("dashboard:ver");
  const resumen = await resumenDashboard(sesion);
  return (
    <>
      <EncabezadoPagina titulo={`Bienvenido/a, ${sesion.nombre}`} descripcion={`Ingresó como ${ETIQUETAS_ROL[sesion.rol]}.`} />
      <PanelDashboard resumen={resumen} />
    </>
  );
}
