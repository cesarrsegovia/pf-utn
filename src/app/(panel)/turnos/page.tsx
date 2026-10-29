import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { ListadoTurnos } from "@/components/turnos/listado-turnos";
import { tienePermiso } from "@/lib/permisos";
import { exigirPermisoPagina } from "@/lib/sesion";

/** F3 — Turnos (gestión: administrador y operador; consulta: veterinario). */
export default async function PaginaTurnos() {
  const sesion = await exigirPermisoPagina("turnos:ver");
  return (
    <>
      <EncabezadoPagina
        titulo="Turnos"
        descripcion="Solicitud, confirmación, reprogramación y cancelación. Los cambios se avisan al vecino por correo."
      />
      <ListadoTurnos puedeGestionar={tienePermiso(sesion.rol, "turnos:gestionar")} />
    </>
  );
}
