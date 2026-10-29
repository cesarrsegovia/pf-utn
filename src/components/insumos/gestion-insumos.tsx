"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
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
import { formatearCantidad } from "@/lib/cantidades";
import { llamarApi } from "@/lib/cliente-api";
import { mensajeDeError } from "@/lib/formularios";
import type { InsumoDto } from "@/services/insumos";
import { FormularioInsumo } from "./formulario-insumo";

/** Badge de alerta de stock: rojo si el stock actual está en o por debajo del mínimo. */
export function BadgeStock({ insumo }: { insumo: InsumoDto }) {
  return <BadgeEstado texto={insumo.bajo_minimo ? "Bajo mínimo" : "Normal"} tono={insumo.bajo_minimo ? "peligro" : "exito"} />;
}

/** Pantalla de F6: listado con alerta de stock bajo, alta, edición y baja. El nombre abre el detalle. */
export function GestionInsumos({ puedeGestionar }: { puedeGestionar: boolean }) {
  const listado = useListado<InsumoDto>("/api/insumos", { stock: "todos" });
  const edicion = useEdicion<InsumoDto>();

  async function eliminar() {
    if (!edicion.aEliminar) return;
    try {
      await llamarApi(`/api/insumos/${edicion.aEliminar.id}`, { metodo: "DELETE" });
      toast.success("Insumo eliminado");
      edicion.cerrarEliminar();
      await listado.recargar();
    } catch (error) {
      toast.error(mensajeDeError(error, "No se pudo eliminar el insumo"));
    }
  }

  const columnas: Columna<InsumoDto>[] = [
    {
      titulo: "Nombre",
      celda: (i) => <Link href={`/insumos/${i.id}`} className="font-medium underline-offset-4 hover:underline">{i.nombre}</Link>,
    },
    { titulo: "Stock actual", celda: (i) => formatearCantidad(i.stock_actual, i.unidad) },
    { titulo: "Stock mínimo", celda: (i) => formatearCantidad(i.stock_minimo, i.unidad) },
    { titulo: "Estado", celda: (i) => <BadgeStock insumo={i} /> },
    ...(puedeGestionar
      ? [{
          titulo: "Acciones",
          className: "w-28 text-right",
          celda: (i: InsumoDto) => (
            <AccionesFila onEditar={() => edicion.abrirEdicion(i)} onEliminar={() => edicion.pedirEliminar(i)} />
          ),
        }]
      : []),
  ];

  return (
    <>
      <EncabezadoPagina
        titulo="Insumos"
        descripcion="Stock de insumos veterinarios. Abra un insumo para ver o registrar movimientos."
        acciones={puedeGestionar && <Button onClick={edicion.abrirAlta}><Plus /> Nuevo insumo</Button>}
      />
      <ListadoPaginado
        listado={listado}
        columnas={columnas}
        claveFila={(i) => i.id}
        placeholderBusqueda="Buscar insumo"
        filtros={
          <FiltroSelect
            etiqueta="Stock"
            valor={listado.filtros.stock}
            opciones={[
              { valor: "todos", etiqueta: "Todos" },
              { valor: "bajo_minimo", etiqueta: "Bajo mínimo" },
            ]}
            onCambiar={(valor) => listado.filtrar("stock", valor)}
          />
        }
      />

      {edicion.formulario && (
        <FormularioInsumo
          insumo={edicion.formulario.registro}
          onCerrar={edicion.cerrarFormulario}
          onGuardado={async () => {
            edicion.cerrarFormulario();
            await listado.recargar();
          }}
        />
      )}
      <ConfirmarDialogo
        abierto={edicion.aEliminar !== null}
        titulo="Eliminar insumo"
        descripcion={`¿Eliminar ${edicion.aEliminar?.nombre}? Solo es posible si no tiene movimientos de stock ni usos en procedimientos.`}
        textoConfirmar="Eliminar"
        onConfirmar={eliminar}
        onCerrar={edicion.cerrarEliminar}
      />
    </>
  );
}
