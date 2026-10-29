import { HistorialClinico } from "@/components/historial/historial-clinico";
import { exigirPermisoPagina } from "@/lib/sesion";
import { esquemaId } from "@/schemas/comun";

/** F8 — Historial clínico (consulta para todos los roles). `?animal=ID` filtra por animal. */
export default async function PaginaHistorial({ searchParams }: { searchParams: Promise<{ animal?: string }> }) {
  await exigirPermisoPagina("historial:ver");
  const animal = esquemaId.safeParse((await searchParams).animal);
  const animalId = animal.success ? animal.data : undefined;
  // La clave reinicia los filtros al cambiar de animal.
  return <HistorialClinico key={animalId ?? "todos"} animalId={animalId} />;
}
