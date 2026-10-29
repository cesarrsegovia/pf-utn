import { notFound } from "next/navigation";
import { DetalleInsumo } from "@/components/insumos/detalle-insumo";
import { tienePermiso } from "@/lib/permisos";
import { exigirPermisoPagina } from "@/lib/sesion";
import { esquemaId } from "@/schemas/comun";

/** F6 — Detalle de un insumo con sus movimientos de stock. */
export default async function PaginaDetalleInsumo({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await exigirPermisoPagina("insumos:ver");
  const id = esquemaId.safeParse((await params).id);
  if (!id.success) notFound();
  return <DetalleInsumo id={id.data} puedeGestionar={tienePermiso(sesion.rol, "insumos:gestionar")} />;
}
