"use client";

import { useState } from "react";
import { CircleCheck, Plus } from "lucide-react";
import { toast } from "sonner";
import { AccionesFila } from "@/components/comunes/acciones-fila";
import { BadgeAvistamiento } from "@/components/comunes/badges-dominio";
import { ConfirmarDialogo } from "@/components/comunes/confirmar-dialogo";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FiltroFecha } from "@/components/comunes/filtro-fecha";
import { FiltroSelect } from "@/components/comunes/filtro-select";
import { FiltroZona } from "@/components/comunes/filtro-zona";
import { ListadoPaginado } from "@/components/comunes/listado-paginado";
import type { Columna } from "@/components/comunes/tabla-datos";
import { Button } from "@/components/ui/button";
import { useEdicion } from "@/hooks/use-edicion";
import { useListado } from "@/hooks/use-listado";
import { llamarApi } from "@/lib/cliente-api";
import { ETIQUETAS_ESTADO_AVISTAMIENTO, opcionesDeEtiquetas } from "@/lib/etiquetas";
import { formatearFechaHora } from "@/lib/fechas";
import { mensajeDeError } from "@/lib/formularios";
import type { AvistamientoDto } from "@/services/avistamientos";
import { FormularioAtenderAvistamiento } from "./formulario-atender-avistamiento";
import { FormularioAvistamiento } from "./formulario-avistamiento";

/**
 * Pantalla de F9: listado con búsqueda y filtros. Administrador y operador cargan, editan,
 * eliminan y atienden los reportes pendientes; el veterinario solo consulta.
 */
export function GestionAvistamientos({ puedeGestionar }: { puedeGestionar: boolean }) {
  const listado = useListado<AvistamientoDto>("/api/avistamientos", { estado: "", zona_id: "", desde: "", hasta: "" });
  const edicion = useEdicion<AvistamientoDto>();
  const [aAtender, setAAtender] = useState<AvistamientoDto | null>(null);

  async function eliminar() {
    if (!edicion.aEliminar) return;
    try {
      await llamarApi(`/api/avistamientos/${edicion.aEliminar.id}`, { metodo: "DELETE" });
      toast.success("Reporte eliminado");
      edicion.cerrarEliminar();
      await listado.recargar();
    } catch (error) {
      toast.error(mensajeDeError(error, "No se pudo eliminar el reporte"));
    }
  }

  const columnas: Columna<AvistamientoDto>[] = [
    { titulo: "Fecha", celda: (r) => formatearFechaHora(r.fecha) },
    { titulo: "Zona", celda: (r) => r.zona },
    { titulo: "Animales", className: "text-right", celda: (r) => r.cantidad_animales },
    {
      titulo: "Descripción",
      celda: (r) => (
        <div className="max-w-sm whitespace-normal">
          <p className="text-sm">{r.descripcion}</p>
          {r.direccion_referencia && <p className="text-xs text-muted-foreground">{r.direccion_referencia}</p>}
        </div>
      ),
    },
    { titulo: "Aviso de", celda: (r) => r.vecino ?? "Anónimo" },
    {
      titulo: "Estado",
      celda: (r) => (
        <div className="grid justify-items-start gap-0.5">
          <BadgeAvistamiento estado={r.estado} />
          {r.fecha_atencion && (
            <span className="text-xs text-muted-foreground">
              {formatearFechaHora(r.fecha_atencion)}
              {r.operativo && ` · ${r.operativo}`}
            </span>
          )}
        </div>
      ),
    },
    ...(puedeGestionar
      ? [{
          titulo: "Acciones",
          className: "w-32 text-right",
          // Los reportes atendidos quedan cerrados: no tienen acciones.
          celda: (r: AvistamientoDto) =>
            r.estado === "pendiente" && (
              <AccionesFila onEditar={() => edicion.abrirEdicion(r)} onEliminar={() => edicion.pedirEliminar(r)}>
                <Button variant="ghost" size="icon-sm" aria-label="Atender" title="Atender" onClick={() => setAAtender(r)}>
                  <CircleCheck />
                </Button>
              </AccionesFila>
            ),
        }]
      : []),
  ];

  return (
    <>
      <EncabezadoPagina
        titulo="Avistamientos"
        descripcion="Avisos de animales sueltos por zona, cargados por el personal municipal."
        acciones={puedeGestionar && <Button onClick={edicion.abrirAlta}><Plus /> Nuevo avistamiento</Button>}
      />
      <ListadoPaginado
        listado={listado}
        columnas={columnas}
        claveFila={(r) => r.id}
        placeholderBusqueda="Buscar por descripción, dirección o zona"
        mensajeVacio="No hay reportes de avistamiento"
        filtros={
          <>
            <FiltroSelect
              etiqueta="Estado"
              valor={listado.filtros.estado}
              opciones={opcionesDeEtiquetas(ETIQUETAS_ESTADO_AVISTAMIENTO)}
              etiquetaTodos="Todos los estados"
              onCambiar={(valor) => listado.filtrar("estado", valor)}
            />
            <FiltroZona valor={listado.filtros.zona_id} onCambiar={(valor) => listado.filtrar("zona_id", valor)} />
            <FiltroFecha etiqueta="Desde" valor={listado.filtros.desde} onCambiar={(valor) => listado.filtrar("desde", valor)} />
            <FiltroFecha etiqueta="Hasta" valor={listado.filtros.hasta} onCambiar={(valor) => listado.filtrar("hasta", valor)} />
          </>
        }
      />

      {edicion.formulario && (
        <FormularioAvistamiento
          reporte={edicion.formulario.registro}
          onCerrar={edicion.cerrarFormulario}
          onGuardado={async () => {
            edicion.cerrarFormulario();
            await listado.recargar();
          }}
        />
      )}
      {aAtender && (
        <FormularioAtenderAvistamiento
          reporte={aAtender}
          onCerrar={() => setAAtender(null)}
          onGuardado={async () => {
            setAAtender(null);
            await listado.recargar();
          }}
        />
      )}
      <ConfirmarDialogo
        abierto={edicion.aEliminar !== null}
        titulo="Eliminar reporte"
        descripcion="¿Eliminar este reporte de avistamiento? Solo es posible mientras está pendiente."
        textoConfirmar="Eliminar"
        onConfirmar={eliminar}
        onCerrar={edicion.cerrarEliminar}
      />
    </>
  );
}
