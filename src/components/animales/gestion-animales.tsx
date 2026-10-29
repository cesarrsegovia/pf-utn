"use client";

import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";
import { toast } from "sonner";
import { AccionesFila } from "@/components/comunes/acciones-fila";
import { BadgeEstado } from "@/components/comunes/badge-estado";
import { ConfirmarDialogo } from "@/components/comunes/confirmar-dialogo";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FiltroSelect } from "@/components/comunes/filtro-select";
import { ListadoPaginado } from "@/components/comunes/listado-paginado";
import type { Columna } from "@/components/comunes/tabla-datos";
import { Button, buttonVariants } from "@/components/ui/button";
import { useEdicion } from "@/hooks/use-edicion";
import { useListado } from "@/hooks/use-listado";
import { llamarApi } from "@/lib/cliente-api";
import { ETIQUETAS_CONDICION, ETIQUETAS_SEXO, opcionesDeEtiquetas } from "@/lib/etiquetas";
import { mensajeDeError } from "@/lib/formularios";
import type { AnimalDto } from "@/services/animales";
import { FormularioAnimal } from "./formulario-animal";

/** Pantalla de F2: listado con búsqueda (también por tutor y chip), alta, edición y baja. */
export function GestionAnimales({ puedeGestionar }: { puedeGestionar: boolean }) {
  const listado = useListado<AnimalDto>("/api/animales", { condicion: "" });
  const edicion = useEdicion<AnimalDto>();

  async function eliminar() {
    if (!edicion.aEliminar) return;
    try {
      await llamarApi(`/api/animales/${edicion.aEliminar.id}`, { metodo: "DELETE" });
      toast.success("Animal eliminado");
      edicion.cerrarEliminar();
      await listado.recargar();
    } catch (error) {
      toast.error(mensajeDeError(error, "No se pudo eliminar el animal"));
    }
  }

  const columnas: Columna<AnimalDto>[] = [
    { titulo: "Nombre", celda: (a) => a.nombre ?? "Sin nombre" },
    { titulo: "Sexo", celda: (a) => ETIQUETAS_SEXO[a.sexo] },
    { titulo: "Condición", celda: (a) => ETIQUETAS_CONDICION[a.condicion] },
    { titulo: "Tutor", celda: (a) => a.tutor ?? "—" },
    { titulo: "Chip", celda: (a) => a.numero_chip ?? "—" },
    { titulo: "Castrado", celda: (a) => <BadgeEstado texto={a.castrado ? "Sí" : "No"} tono={a.castrado ? "exito" : "neutro"} /> },
    {
      titulo: "Historial",
      className: "w-20 text-center",
      celda: (a) => (
        <Link
          href={`/historial?animal=${a.id}`}
          className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
          aria-label="Ver historial clínico"
          title="Ver historial clínico"
        >
          <ClipboardList />
        </Link>
      ),
    },
    ...(puedeGestionar
      ? [{
          titulo: "Acciones",
          className: "w-28 text-right",
          celda: (a: AnimalDto) => (
            <AccionesFila onEditar={() => edicion.abrirEdicion(a)} onEliminar={() => edicion.pedirEliminar(a)} />
          ),
        }]
      : []),
  ];

  return (
    <>
      <EncabezadoPagina
        titulo="Animales"
        descripcion="Caninos con tutor, callejeros y asilvestrados."
        acciones={puedeGestionar && <Button onClick={edicion.abrirAlta}><Plus /> Nuevo animal</Button>}
      />
      <ListadoPaginado
        listado={listado}
        columnas={columnas}
        claveFila={(a) => a.id}
        placeholderBusqueda="Buscar por nombre, raza, chip o tutor (apellido o DNI)"
        filtros={
          <FiltroSelect
            etiqueta="Condición"
            valor={listado.filtros.condicion}
            opciones={opcionesDeEtiquetas(ETIQUETAS_CONDICION)}
            etiquetaTodos="Todas las condiciones"
            onCambiar={(valor) => listado.filtrar("condicion", valor)}
          />
        }
      />

      {edicion.formulario && (
        <FormularioAnimal
          animal={edicion.formulario.registro}
          onCerrar={edicion.cerrarFormulario}
          onGuardado={async () => {
            edicion.cerrarFormulario();
            await listado.recargar();
          }}
        />
      )}
      <ConfirmarDialogo
        abierto={edicion.aEliminar !== null}
        titulo="Eliminar animal"
        descripcion={`¿Eliminar a ${edicion.aEliminar?.nombre ?? "este animal"}? Solo es posible si no tiene turnos registrados.`}
        textoConfirmar="Eliminar"
        onConfirmar={eliminar}
        onCerrar={edicion.cerrarEliminar}
      />
    </>
  );
}
