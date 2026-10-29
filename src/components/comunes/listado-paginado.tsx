"use client";

import type { ReactNode } from "react";
import { Buscador } from "@/components/comunes/buscador";
import { Paginacion } from "@/components/comunes/paginacion";
import { TablaDatos, type Columna } from "@/components/comunes/tabla-datos";
import type { EstadoListado } from "@/hooks/use-listado";

/**
 * Listado completo de un módulo: buscador, filtros opcionales, tabla y paginación,
 * conectado al estado de `useListado`. Sin `placeholderBusqueda` no muestra el buscador.
 */
export function ListadoPaginado<T>({ listado, columnas, claveFila, placeholderBusqueda, filtros, mensajeVacio }: {
  listado: EstadoListado<T>;
  columnas: Columna<T>[];
  claveFila: (fila: T) => string | number;
  placeholderBusqueda?: string;
  filtros?: ReactNode;
  mensajeVacio?: string;
}) {
  return (
    <>
      {(placeholderBusqueda || filtros) && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {placeholderBusqueda && <Buscador onBuscar={listado.buscar} placeholder={placeholderBusqueda} />}
          {filtros}
        </div>
      )}
      <TablaDatos
        columnas={columnas}
        filas={listado.datos?.filas}
        claveFila={claveFila}
        cargando={listado.cargando}
        mensajeVacio={mensajeVacio}
      />
      {listado.datos && (
        <Paginacion
          pagina={listado.pagina}
          tamanio={listado.tamanio}
          total={listado.datos.total}
          onCambiar={listado.setPagina}
        />
      )}
    </>
  );
}
