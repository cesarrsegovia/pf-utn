"use client";

import { useCallback, useState } from "react";
import useSWR from "swr";
import { obtenerJson } from "@/lib/cliente-api";
import type { ResultadoPaginado } from "@/schemas/comun";

/**
 * Estado de un listado paginado de la API: página, texto de búsqueda y filtros.
 * Arma la URL (omitiendo los filtros vacíos) y consulta con SWR, conservando los datos
 * anteriores mientras carga la página siguiente. Buscar o filtrar vuelve a la página 1.
 */
export function useListado<T>(url: string, filtrosIniciales: Record<string, string> = {}, tamanio = 10) {
  const [pagina, setPagina] = useState(1);
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState(filtrosIniciales);

  const parametros = new URLSearchParams({ pagina: String(pagina), tamanio: String(tamanio) });
  if (busqueda) parametros.set("busqueda", busqueda);
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor) parametros.set(clave, valor);
  }

  const { data, isLoading, mutate } = useSWR<ResultadoPaginado<T>>(`${url}?${parametros}`, obtenerJson, {
    keepPreviousData: true,
  });

  const buscar = useCallback((texto: string) => {
    setBusqueda(texto);
    setPagina(1);
  }, []);

  const filtrar = useCallback((clave: string, valor: string) => {
    setFiltros((anteriores) => ({ ...anteriores, [clave]: valor }));
    setPagina(1);
  }, []);

  return {
    datos: data,
    cargando: isLoading,
    /** Vuelve a consultar la página actual (después de crear, editar o eliminar). */
    recargar: mutate,
    pagina,
    setPagina,
    tamanio,
    filtros,
    buscar,
    filtrar,
  };
}

/** Valor devuelto por `useListado`, para pasarlo a `ListadoPaginado`. */
export type EstadoListado<T> = ReturnType<typeof useListado<T>>;
