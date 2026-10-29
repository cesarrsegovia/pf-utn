"use client";

import useSWR from "swr";
import { Plus, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { AccionesFila } from "@/components/comunes/acciones-fila";
import { BadgeEstado } from "@/components/comunes/badge-estado";
import { ConfirmarDialogo } from "@/components/comunes/confirmar-dialogo";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FiltroSelect } from "@/components/comunes/filtro-select";
import { ListadoPaginado } from "@/components/comunes/listado-paginado";
import type { Columna } from "@/components/comunes/tabla-datos";
import { Button } from "@/components/ui/button";
import { useEdicion } from "@/hooks/use-edicion";
import { useListado } from "@/hooks/use-listado";
import { llamarApi, obtenerJson } from "@/lib/cliente-api";
import { OPCIONES_ESTADO } from "@/lib/etiquetas";
import { formatearFecha } from "@/lib/fechas";
import { mensajeDeError } from "@/lib/formularios";
import type { Opcion } from "@/schemas/comun";
import type { ResultadoBaja } from "@/services/comun";
import type { VecinoDto } from "@/services/vecinos";
import { FormularioVecino } from "./formulario-vecino";

/** Pantalla de F1: listado con filtros, alta, edición, baja (física o lógica) y reactivación. */
export function GestionVecinos({ puedeGestionar }: { puedeGestionar: boolean }) {
  const listado = useListado<VecinoDto>("/api/vecinos", { estado: "activos", zona_id: "" });
  const edicion = useEdicion<VecinoDto>();
  const { data: zonas } = useSWR<Opcion[]>("/api/zonas/opciones", obtenerJson);

  async function eliminar() {
    if (!edicion.aEliminar) return;
    try {
      const baja = await llamarApi<ResultadoBaja>(`/api/vecinos/${edicion.aEliminar.id}`, { metodo: "DELETE" });
      toast.success(
        baja.resultado === "eliminado"
          ? "Vecino eliminado"
          : `Vecino dado de baja. Turnos cancelados: ${baja.turnosCancelados ?? 0}`,
      );
      edicion.cerrarEliminar();
      await listado.recargar();
    } catch (error) {
      toast.error(mensajeDeError(error, "No se pudo dar de baja al vecino"));
    }
  }

  async function reactivar(vecino: VecinoDto) {
    try {
      await llamarApi(`/api/vecinos/${vecino.id}/reactivar`, { metodo: "POST" });
      toast.success("Vecino reactivado");
      await listado.recargar();
    } catch (error) {
      toast.error(mensajeDeError(error, "No se pudo reactivar al vecino"));
    }
  }

  const columnas: Columna<VecinoDto>[] = [
    { titulo: "Apellido y nombre", celda: (v) => `${v.apellido}, ${v.nombre}` },
    { titulo: "DNI", celda: (v) => v.dni },
    { titulo: "Teléfono", celda: (v) => v.telefono },
    { titulo: "Zona", celda: (v) => v.zona },
    {
      titulo: "Estado",
      celda: (v) => (
        <BadgeEstado texto={v.activo ? "Activo" : `Baja ${formatearFecha(v.fecha_baja!)}`} tono={v.activo ? "exito" : "neutro"} />
      ),
    },
    ...(puedeGestionar
      ? [{
          titulo: "Acciones",
          className: "w-32 text-right",
          celda: (v: VecinoDto) => (
            <AccionesFila
              onEditar={() => edicion.abrirEdicion(v)}
              onEliminar={v.activo ? () => edicion.pedirEliminar(v) : undefined}
              textoEliminar="Dar de baja"
            >
              {!v.activo && (
                <Button variant="ghost" size="icon-sm" aria-label="Reactivar" title="Reactivar" onClick={() => reactivar(v)}>
                  <RotateCcw />
                </Button>
              )}
            </AccionesFila>
          ),
        }]
      : []),
  ];

  return (
    <>
      <EncabezadoPagina
        titulo="Vecinos"
        descripcion="Vecinos solicitantes y tutores de animales."
        acciones={puedeGestionar && <Button onClick={edicion.abrirAlta}><Plus /> Nuevo vecino</Button>}
      />
      <ListadoPaginado
        listado={listado}
        columnas={columnas}
        claveFila={(v) => v.id}
        placeholderBusqueda="Buscar por nombre, apellido o DNI"
        filtros={
          <>
            <FiltroSelect
              etiqueta="Estado"
              valor={listado.filtros.estado}
              opciones={OPCIONES_ESTADO}
              onCambiar={(valor) => listado.filtrar("estado", valor)}
            />
            <FiltroSelect
              etiqueta="Zona"
              valor={listado.filtros.zona_id}
              opciones={(zonas ?? []).map((zona) => ({ valor: String(zona.id), etiqueta: zona.etiqueta }))}
              etiquetaTodos="Todas las zonas"
              onCambiar={(valor) => listado.filtrar("zona_id", valor)}
            />
          </>
        }
      />

      {edicion.formulario && (
        <FormularioVecino
          vecino={edicion.formulario.registro}
          onCerrar={edicion.cerrarFormulario}
          onGuardado={async () => {
            edicion.cerrarFormulario();
            await listado.recargar();
          }}
        />
      )}
      <ConfirmarDialogo
        abierto={edicion.aEliminar !== null}
        titulo="Dar de baja al vecino"
        descripcion={`¿Dar de baja a ${edicion.aEliminar?.nombre} ${edicion.aEliminar?.apellido}? Si no tiene registros asociados se elimina; si tiene animales u otros registros queda inactivo y se cancelan sus turnos pendientes o confirmados.`}
        textoConfirmar="Dar de baja"
        onConfirmar={eliminar}
        onCerrar={edicion.cerrarEliminar}
      />
    </>
  );
}
