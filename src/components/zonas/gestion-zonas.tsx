"use client";

import { Plus } from "lucide-react";
import { toast } from "sonner";
import { AccionesFila } from "@/components/comunes/acciones-fila";
import { ConfirmarDialogo } from "@/components/comunes/confirmar-dialogo";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { ListadoPaginado } from "@/components/comunes/listado-paginado";
import type { Columna } from "@/components/comunes/tabla-datos";
import { Button } from "@/components/ui/button";
import { useEdicion } from "@/hooks/use-edicion";
import { useListado } from "@/hooks/use-listado";
import { llamarApi } from "@/lib/cliente-api";
import { mensajeDeError } from "@/lib/formularios";
import type { ZonaDto } from "@/services/zonas";
import { FormularioZona } from "./formulario-zona";

/** Pantalla de F10: listado con búsqueda; alta, edición y baja solo para el administrador. */
export function GestionZonas({ puedeGestionar }: { puedeGestionar: boolean }) {
  const listado = useListado<ZonaDto>("/api/zonas");
  const edicion = useEdicion<ZonaDto>();

  async function eliminar() {
    if (!edicion.aEliminar) return;
    try {
      await llamarApi(`/api/zonas/${edicion.aEliminar.id}`, { metodo: "DELETE" });
      toast.success("Zona eliminada");
      edicion.cerrarEliminar();
      await listado.recargar();
    } catch (error) {
      toast.error(mensajeDeError(error, "No se pudo eliminar la zona"));
    }
  }

  const columnas: Columna<ZonaDto>[] = [
    { titulo: "Nombre", celda: (zona) => zona.nombre },
    { titulo: "Descripción", celda: (zona) => zona.descripcion ?? "—" },
    ...(puedeGestionar
      ? [{
          titulo: "Acciones",
          className: "w-28 text-right",
          celda: (zona: ZonaDto) => (
            <AccionesFila onEditar={() => edicion.abrirEdicion(zona)} onEliminar={() => edicion.pedirEliminar(zona)} />
          ),
        }]
      : []),
  ];

  return (
    <>
      <EncabezadoPagina
        titulo="Zonas"
        descripcion="Barrios que organizan vecinos, operativos y avistamientos."
        acciones={puedeGestionar && <Button onClick={edicion.abrirAlta}><Plus /> Nueva zona</Button>}
      />
      <ListadoPaginado listado={listado} columnas={columnas} claveFila={(zona) => zona.id} placeholderBusqueda="Buscar zona" />

      {edicion.formulario && (
        <FormularioZona
          zona={edicion.formulario.registro}
          onCerrar={edicion.cerrarFormulario}
          onGuardado={async () => {
            edicion.cerrarFormulario();
            await listado.recargar();
          }}
        />
      )}
      <ConfirmarDialogo
        abierto={edicion.aEliminar !== null}
        titulo="Eliminar zona"
        descripcion={`¿Eliminar la zona ${edicion.aEliminar?.nombre}? Solo es posible si no tiene vecinos, operativos ni reportes.`}
        textoConfirmar="Eliminar"
        onConfirmar={eliminar}
        onCerrar={edicion.cerrarEliminar}
      />
    </>
  );
}
