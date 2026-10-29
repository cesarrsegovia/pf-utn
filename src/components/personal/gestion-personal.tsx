"use client";

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
import { llamarApi } from "@/lib/cliente-api";
import { ETIQUETAS_TIPO_PERSONAL, OPCIONES_ESTADO, opcionesDeEtiquetas } from "@/lib/etiquetas";
import { mensajeDeError } from "@/lib/formularios";
import type { ResultadoBaja } from "@/services/comun";
import type { PersonalDto } from "@/services/personal";
import { FormularioPersonal } from "./formulario-personal";

/** Pantalla de F5: listado con búsqueda y filtros; gestión solo para el administrador. */
export function GestionPersonal({ puedeGestionar }: { puedeGestionar: boolean }) {
  const listado = useListado<PersonalDto>("/api/personal", { tipo: "", estado: "activos" });
  const edicion = useEdicion<PersonalDto>();

  async function eliminar() {
    if (!edicion.aEliminar) return;
    try {
      const { resultado } = await llamarApi<ResultadoBaja>(`/api/personal/${edicion.aEliminar.id}`, { metodo: "DELETE" });
      toast.success(
        resultado === "eliminado"
          ? "Registro de personal eliminado"
          : "Tiene operativos o procedimientos registrados: se desactivó en lugar de eliminarse",
      );
      edicion.cerrarEliminar();
      await listado.recargar();
    } catch (error) {
      toast.error(mensajeDeError(error, "No se pudo eliminar el registro de personal"));
    }
  }

  const columnas: Columna<PersonalDto>[] = [
    { titulo: "Apellido y nombre", celda: (p) => `${p.apellido}, ${p.nombre}` },
    { titulo: "Tipo", celda: (p) => ETIQUETAS_TIPO_PERSONAL[p.tipo] },
    { titulo: "Matrícula", celda: (p) => p.matricula ?? "—" },
    { titulo: "Cuenta de acceso", celda: (p) => p.usuario ?? "—" },
    { titulo: "Estado", celda: (p) => <BadgeEstado texto={p.activo ? "Activo" : "Inactivo"} tono={p.activo ? "exito" : "neutro"} /> },
    ...(puedeGestionar
      ? [{
          titulo: "Acciones",
          className: "w-28 text-right",
          celda: (p: PersonalDto) => (
            <AccionesFila onEditar={() => edicion.abrirEdicion(p)} onEliminar={() => edicion.pedirEliminar(p)} />
          ),
        }]
      : []),
  ];

  return (
    <>
      <EncabezadoPagina
        titulo="Personal actuante"
        descripcion="Veterinarios y auxiliares que participan de los operativos."
        acciones={puedeGestionar && <Button onClick={edicion.abrirAlta}><Plus /> Nuevo integrante</Button>}
      />
      <ListadoPaginado
        listado={listado}
        columnas={columnas}
        claveFila={(p) => p.id}
        placeholderBusqueda="Buscar por nombre, apellido o matrícula"
        filtros={
          <>
            <FiltroSelect
              etiqueta="Tipo"
              valor={listado.filtros.tipo}
              opciones={opcionesDeEtiquetas(ETIQUETAS_TIPO_PERSONAL)}
              etiquetaTodos="Todos los tipos"
              onCambiar={(valor) => listado.filtrar("tipo", valor)}
            />
            <FiltroSelect
              etiqueta="Estado"
              valor={listado.filtros.estado}
              opciones={OPCIONES_ESTADO}
              onCambiar={(valor) => listado.filtrar("estado", valor)}
            />
          </>
        }
      />

      {edicion.formulario && (
        <FormularioPersonal
          personal={edicion.formulario.registro}
          onCerrar={edicion.cerrarFormulario}
          onGuardado={async () => {
            edicion.cerrarFormulario();
            await listado.recargar();
          }}
        />
      )}
      <ConfirmarDialogo
        abierto={edicion.aEliminar !== null}
        titulo="Eliminar integrante del personal"
        descripcion={`¿Eliminar a ${edicion.aEliminar?.nombre} ${edicion.aEliminar?.apellido}? Si participó de operativos o tiene procedimientos se desactivará en lugar de eliminarse.`}
        textoConfirmar="Eliminar"
        onConfirmar={eliminar}
        onCerrar={edicion.cerrarEliminar}
      />
    </>
  );
}
