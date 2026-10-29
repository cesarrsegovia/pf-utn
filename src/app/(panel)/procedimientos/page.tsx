import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { TurnosParaAtender } from "@/components/procedimientos/turnos-para-atender";
import { exigirPermisoPagina } from "@/lib/sesion";

/** F7 — Registro de procedimientos (solo veterinarios). */
export default async function PaginaProcedimientos() {
  await exigirPermisoPagina("procedimientos:registrar");
  return (
    <>
      <EncabezadoPagina
        titulo="Registrar procedimientos"
        descripcion="Turnos confirmados de los operativos en curso a los que está asignado."
      />
      <TurnosParaAtender />
    </>
  );
}
