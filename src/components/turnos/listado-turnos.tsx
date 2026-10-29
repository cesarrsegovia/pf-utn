"use client";

import { useState } from "react";
import { CalendarClock, Check, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { AccionesFila } from "@/components/comunes/acciones-fila";
import { BadgeTurno } from "@/components/comunes/badges-dominio";
import { ConfirmarDialogo } from "@/components/comunes/confirmar-dialogo";
import { FiltroSelect } from "@/components/comunes/filtro-select";
import { ListadoPaginado } from "@/components/comunes/listado-paginado";
import type { Columna } from "@/components/comunes/tabla-datos";
import { Button } from "@/components/ui/button";
import { useListado } from "@/hooks/use-listado";
import { llamarApi } from "@/lib/cliente-api";
import { esTurnoActivo } from "@/lib/constantes";
import { ETIQUETAS_ESTADO_TURNO, ETIQUETAS_TIPO_PROCEDIMIENTO, opcionesDeEtiquetas } from "@/lib/etiquetas";
import { formatearFecha } from "@/lib/fechas";
import { mensajeDeError } from "@/lib/formularios";
import type { TurnoDto } from "@/services/turnos";
import { FormularioCancelarTurno } from "./formulario-cancelar-turno";
import { FormularioReprogramar } from "./formulario-reprogramar";
import { FormularioTurno } from "./formulario-turno";

/**
 * Listado de turnos con sus acciones (F3): confirmar, reprogramar y cancelar.
 * Se usa en la página de turnos y, filtrado por `operativoId`, en el detalle de un operativo;
 * `onCambio` avisa a la pantalla contenedora para refrescar datos dependientes (ej.: el cupo).
 */
export function ListadoTurnos({ operativoId, puedeGestionar, permitirAlta = true, onCambio }: {
  operativoId?: number;
  puedeGestionar: boolean;
  /** Muestra "Nuevo turno" (en el detalle, solo si el operativo admite turnos). */
  permitirAlta?: boolean;
  onCambio?: () => void;
}) {
  const listado = useListado<TurnoDto>("/api/turnos", {
    estado: "",
    operativo_id: operativoId ? String(operativoId) : "",
  });
  const [nuevo, setNuevo] = useState(false);
  const [aConfirmar, setAConfirmar] = useState<TurnoDto | null>(null);
  const [aReprogramar, setAReprogramar] = useState<TurnoDto | null>(null);
  const [aCancelar, setACancelar] = useState<TurnoDto | null>(null);

  /** Refresca el listado y avisa a la pantalla contenedora. */
  async function actualizar() {
    await listado.recargar();
    onCambio?.();
  }

  async function confirmar() {
    if (!aConfirmar) return;
    try {
      await llamarApi(`/api/turnos/${aConfirmar.id}/confirmar`, { metodo: "POST" });
      toast.success("Turno confirmado. Se avisará al vecino por correo.");
      setAConfirmar(null);
      await actualizar();
    } catch (error) {
      toast.error(mensajeDeError(error, "No se pudo confirmar el turno"));
    }
  }

  /** Cierra un diálogo de edición y refresca. */
  function alGuardar(cerrar: () => void) {
    return async () => {
      cerrar();
      await actualizar();
    };
  }

  const columnas: Columna<TurnoDto>[] = [
    { titulo: "Fecha y hora", celda: (t) => `${formatearFecha(t.fecha)} ${t.horario}` },
    { titulo: "Animal", celda: (t) => t.animal },
    { titulo: "Tutor", celda: (t) => t.tutor ?? "Sin tutor" },
    { titulo: "Procedimiento", celda: (t) => ETIQUETAS_TIPO_PROCEDIMIENTO[t.tipo_solicitado] },
    // En el detalle de un operativo el lugar es siempre el mismo: la columna se omite.
    ...(operativoId ? [] : [{ titulo: "Lugar", celda: (t: TurnoDto) => `${t.lugar} (${t.zona})` }]),
    {
      titulo: "Estado",
      celda: (t) => (
        <span title={t.motivo_cancelacion ?? undefined}>
          <BadgeTurno estado={t.estado} />
        </span>
      ),
    },
    ...(puedeGestionar
      ? [{
          titulo: "Acciones",
          className: "w-32 text-right",
          celda: (t: TurnoDto) =>
            esTurnoActivo(t.estado) && (
              <AccionesFila>
                {t.estado === "pendiente" && (
                  <Button variant="ghost" size="icon-sm" aria-label="Confirmar" title="Confirmar" onClick={() => setAConfirmar(t)}>
                    <Check />
                  </Button>
                )}
                <Button variant="ghost" size="icon-sm" aria-label="Reprogramar" title="Reprogramar" onClick={() => setAReprogramar(t)}>
                  <CalendarClock />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label="Cancelar turno" title="Cancelar turno" onClick={() => setACancelar(t)}>
                  <X />
                </Button>
              </AccionesFila>
            ),
        }]
      : []),
  ];

  return (
    <>
      <ListadoPaginado
        listado={listado}
        columnas={columnas}
        claveFila={(t) => t.id}
        placeholderBusqueda="Buscar por animal o tutor (apellido o DNI)"
        mensajeVacio="No hay turnos para mostrar"
        filtros={
          <>
            <FiltroSelect
              etiqueta="Estado"
              valor={listado.filtros.estado}
              opciones={opcionesDeEtiquetas(ETIQUETAS_ESTADO_TURNO)}
              etiquetaTodos="Todos los estados"
              onCambiar={(valor) => listado.filtrar("estado", valor)}
            />
            {puedeGestionar && permitirAlta && (
              <Button className="ml-auto" onClick={() => setNuevo(true)}><Plus /> Nuevo turno</Button>
            )}
          </>
        }
      />

      {nuevo && (
        <FormularioTurno operativoId={operativoId} onCerrar={() => setNuevo(false)} onGuardado={alGuardar(() => setNuevo(false))} />
      )}
      {aReprogramar && (
        <FormularioReprogramar
          turno={aReprogramar}
          onCerrar={() => setAReprogramar(null)}
          onGuardado={alGuardar(() => setAReprogramar(null))}
        />
      )}
      {aCancelar && (
        <FormularioCancelarTurno
          turno={aCancelar}
          onCerrar={() => setACancelar(null)}
          onGuardado={alGuardar(() => setACancelar(null))}
        />
      )}
      <ConfirmarDialogo
        abierto={aConfirmar !== null}
        titulo="Confirmar turno"
        descripcion={`¿Confirmar el turno de ${aConfirmar?.animal}? Se enviará la confirmación por correo y un recordatorio 24 h antes.`}
        textoConfirmar="Confirmar"
        onConfirmar={confirmar}
        onCerrar={() => setAConfirmar(null)}
      />
    </>
  );
}
