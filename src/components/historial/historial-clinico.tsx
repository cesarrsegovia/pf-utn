"use client";

import Link from "next/link";
import useSWR from "swr";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FiltroFecha } from "@/components/comunes/filtro-fecha";
import { FiltroSelect } from "@/components/comunes/filtro-select";
import { ListadoPaginado } from "@/components/comunes/listado-paginado";
import type { Columna } from "@/components/comunes/tabla-datos";
import { buttonVariants } from "@/components/ui/button";
import { useListado } from "@/hooks/use-listado";
import { obtenerJson } from "@/lib/cliente-api";
import { ETIQUETAS_TIPO_PROCEDIMIENTO, nombreAnimal, opcionesDeEtiquetas } from "@/lib/etiquetas";
import { formatearFechaHora } from "@/lib/fechas";
import type { AnimalDto } from "@/services/animales";
import type { HistorialDto } from "@/services/historial";

/**
 * Consulta del historial clínico (F8, solo lectura). Con `animalId` muestra la vida clínica
 * de ese animal en orden cronológico; sin él, todas las entradas de la más reciente a la más antigua.
 */
export function HistorialClinico({ animalId }: { animalId?: number }) {
  const listado = useListado<HistorialDto>("/api/historial", {
    animal_id: animalId ? String(animalId) : "",
    tipo: "",
    desde: "",
    hasta: "",
  });
  const { data: animal } = useSWR<AnimalDto>(animalId ? `/api/animales/${animalId}` : null, obtenerJson);

  const columnas: Columna<HistorialDto>[] = [
    { titulo: "Fecha", celda: (h) => formatearFechaHora(h.fecha) },
    ...(animalId
      ? []
      : [{
          titulo: "Animal",
          celda: (h: HistorialDto) => (
            <Link href={`/historial?animal=${h.animal_id}`} className="font-medium underline-offset-4 hover:underline">
              {h.animal}
            </Link>
          ),
        }]),
    { titulo: "Procedimiento", celda: (h) => ETIQUETAS_TIPO_PROCEDIMIENTO[h.tipo] },
    { titulo: "Veterinario/a", celda: (h) => h.veterinario },
    {
      titulo: "Descripción",
      celda: (h) => <span className="block max-w-md text-sm whitespace-normal">{h.descripcion}</span>,
    },
  ];

  return (
    <>
      <EncabezadoPagina
        titulo={animal ? `Historial clínico de ${nombreAnimal(animal)}` : "Historial clínico"}
        descripcion={
          animal
            ? `Chip: ${animal.numero_chip ?? "sin chip"} · Tutor: ${animal.tutor ?? "sin tutor"}. Orden cronológico.`
            : "Procedimientos registrados (solo consulta). Elija un animal para ver su historial completo."
        }
        acciones={
          animalId && (
            <Link href="/historial" className={buttonVariants({ variant: "outline" })}>Ver todos</Link>
          )
        }
      />
      <ListadoPaginado
        listado={listado}
        columnas={columnas}
        claveFila={(h) => h.id}
        placeholderBusqueda={animalId ? undefined : "Buscar por animal, chip o veterinario/a"}
        mensajeVacio="No hay procedimientos registrados"
        filtros={
          <>
            <FiltroSelect
              etiqueta="Procedimiento"
              valor={listado.filtros.tipo}
              opciones={opcionesDeEtiquetas(ETIQUETAS_TIPO_PROCEDIMIENTO)}
              etiquetaTodos="Todos los procedimientos"
              onCambiar={(valor) => listado.filtrar("tipo", valor)}
            />
            <FiltroFecha etiqueta="Desde" valor={listado.filtros.desde} onCambiar={(valor) => listado.filtrar("desde", valor)} />
            <FiltroFecha etiqueta="Hasta" valor={listado.filtros.hasta} onCambiar={(valor) => listado.filtrar("hasta", valor)} />
          </>
        }
      />
    </>
  );
}
