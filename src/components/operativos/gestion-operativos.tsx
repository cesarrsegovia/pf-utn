"use client";

import Link from "next/link";
import { Eye, Plus } from "lucide-react";
import { AccionesFila } from "@/components/comunes/acciones-fila";
import { BadgeOperativo } from "@/components/comunes/badges-dominio";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FiltroSelect } from "@/components/comunes/filtro-select";
import { ListadoPaginado } from "@/components/comunes/listado-paginado";
import type { Columna } from "@/components/comunes/tabla-datos";
import { Button, buttonVariants } from "@/components/ui/button";
import { useEdicion } from "@/hooks/use-edicion";
import { useListado } from "@/hooks/use-listado";
import type { EstadoOperativo } from "@/lib/constantes";
import { ETIQUETAS_ESTADO_OPERATIVO, opcionesDeEtiquetas, type OpcionTexto } from "@/lib/etiquetas";
import { formatearFecha } from "@/lib/fechas";
import type { OperativoDto } from "@/services/operativos";
import { FormularioOperativo } from "./formulario-operativo";

const OPCIONES_PERIODO: OpcionTexto[] = [
  { valor: "proximos", etiqueta: "Próximos" },
  { valor: "pasados", etiqueta: "Pasados" },
  { valor: "todos", etiqueta: "Todos" },
];

/** Un operativo admite cambios mientras está programado o en curso. */
export function esVigente(estado: EstadoOperativo): boolean {
  return estado === "programado" || estado === "en_curso";
}

/** Cupo en texto: ocupados sobre el máximo y lugares libres. */
export function textoCupo(operativo: OperativoDto): string {
  return `${operativo.ocupados}/${operativo.cupo_maximo} (${operativo.disponibles} libres)`;
}

/** Pantalla de F4: listado de operativos con cupo disponible, alta y edición. La fecha abre el detalle. */
export function GestionOperativos({ puedeGestionar }: { puedeGestionar: boolean }) {
  const listado = useListado<OperativoDto>("/api/operativos", { periodo: "proximos", estado: "" });
  const edicion = useEdicion<OperativoDto>();

  const columnas: Columna<OperativoDto>[] = [
    {
      titulo: "Fecha",
      celda: (o) => (
        <Link href={`/operativos/${o.id}`} className="font-medium underline-offset-4 hover:underline">
          {formatearFecha(o.fecha)}
        </Link>
      ),
    },
    { titulo: "Horario", celda: (o) => `${o.hora_inicio} a ${o.hora_fin}` },
    { titulo: "Zona", celda: (o) => o.zona },
    { titulo: "Lugar", celda: (o) => o.lugar },
    { titulo: "Cupo", celda: textoCupo },
    { titulo: "Estado", celda: (o) => <BadgeOperativo estado={o.estado} /> },
    {
      titulo: "Acciones",
      className: "w-28 text-right",
      celda: (o) => (
        <AccionesFila onEditar={puedeGestionar && esVigente(o.estado) ? () => edicion.abrirEdicion(o) : undefined}>
          <Link
            href={`/operativos/${o.id}`}
            className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
            aria-label="Ver detalle"
            title="Ver detalle"
          >
            <Eye />
          </Link>
        </AccionesFila>
      ),
    },
  ];

  return (
    <>
      <EncabezadoPagina
        titulo="Operativos"
        descripcion="Jornadas de castración y chipeo por zona, con su cupo de turnos."
        acciones={puedeGestionar && <Button onClick={edicion.abrirAlta}><Plus /> Nuevo operativo</Button>}
      />
      <ListadoPaginado
        listado={listado}
        columnas={columnas}
        claveFila={(o) => o.id}
        placeholderBusqueda="Buscar por lugar o zona"
        filtros={
          <>
            <FiltroSelect
              etiqueta="Período"
              valor={listado.filtros.periodo}
              opciones={OPCIONES_PERIODO}
              onCambiar={(valor) => listado.filtrar("periodo", valor)}
            />
            <FiltroSelect
              etiqueta="Estado"
              valor={listado.filtros.estado}
              opciones={opcionesDeEtiquetas(ETIQUETAS_ESTADO_OPERATIVO)}
              etiquetaTodos="Todos los estados"
              onCambiar={(valor) => listado.filtrar("estado", valor)}
            />
          </>
        }
      />

      {edicion.formulario && (
        <FormularioOperativo
          operativo={edicion.formulario.registro}
          onCerrar={edicion.cerrarFormulario}
          onGuardado={async () => {
            edicion.cerrarFormulario();
            await listado.recargar();
          }}
        />
      )}
    </>
  );
}
