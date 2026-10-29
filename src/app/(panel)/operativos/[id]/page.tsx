import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DetalleOperativo } from "@/components/operativos/detalle-operativo";
import { tienePermiso } from "@/lib/permisos";
import { exigirPermisoPagina } from "@/lib/sesion";
import { esquemaId } from "@/schemas/comun";

export const metadata: Metadata = { title: "Detalle de operativo" };

/** F4 — Detalle de un operativo: personal, estado, cancelación (solo administrador) y turnos. */
export default async function PaginaDetalleOperativo({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await exigirPermisoPagina("operativos:ver");
  const id = esquemaId.safeParse((await params).id);
  if (!id.success) notFound();
  return (
    <DetalleOperativo
      id={id.data}
      puedeGestionar={tienePermiso(sesion.rol, "operativos:gestionar")}
      puedeCancelar={tienePermiso(sesion.rol, "operativos:cancelar")}
      puedeGestionarTurnos={tienePermiso(sesion.rol, "turnos:gestionar")}
    />
  );
}
