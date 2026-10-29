"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ArrowLeft, Ban, CheckCircle2, Pencil, Play } from "lucide-react";
import { toast } from "sonner";
import { BadgeOperativo } from "@/components/comunes/badges-dominio";
import { ConfirmarDialogo } from "@/components/comunes/confirmar-dialogo";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { ListadoTurnos } from "@/components/turnos/listado-turnos";
import { Button, buttonVariants } from "@/components/ui/button";
import { llamarApi, obtenerJson } from "@/lib/cliente-api";
import { formatearFecha } from "@/lib/fechas";
import { mensajeDeError } from "@/lib/formularios";
import type { OperativoDetalleDto, ResultadoCambioEstado } from "@/services/operativos";
import { FormularioCancelarOperativo } from "./formulario-cancelar-operativo";
import { FormularioOperativo } from "./formulario-operativo";
import { esVigente, textoCupo } from "./gestion-operativos";
import { PersonalOperativo } from "./personal-operativo";

/** Detalle de un operativo (F4): datos, cupo, personal, cambios de estado, cancelación y turnos. */
export function DetalleOperativo({ id, puedeGestionar, puedeCancelar, puedeGestionarTurnos }: {
  id: number;
  puedeGestionar: boolean;
  puedeCancelar: boolean;
  puedeGestionarTurnos: boolean;
}) {
  const { data: operativo, error, mutate } = useSWR<OperativoDetalleDto>(`/api/operativos/${id}`, obtenerJson);
  const [editando, setEditando] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [nuevoEstado, setNuevoEstado] = useState<"en_curso" | "realizado" | null>(null);

  const volver = (
    <Link href="/operativos" className={buttonVariants({ variant: "outline" })}>
      <ArrowLeft /> Volver
    </Link>
  );
  if (error) return <EncabezadoPagina titulo="Operativo no encontrado" descripcion={error.message} acciones={volver} />;
  if (!operativo) return <p className="text-sm text-muted-foreground">Cargando…</p>;

  /** Inicia o finaliza el operativo, según el estado elegido en la confirmación. */
  async function cambiarEstado() {
    if (!nuevoEstado) return;
    try {
      const { turnosCancelados } = await llamarApi<ResultadoCambioEstado>(`/api/operativos/${id}/estado`, {
        metodo: "POST",
        cuerpo: { estado: nuevoEstado },
      });
      toast.success(
        nuevoEstado === "en_curso"
          ? "Operativo iniciado"
          : `Operativo finalizado. Turnos sin presentarse: ${turnosCancelados}`,
      );
      setNuevoEstado(null);
      await mutate();
    } catch (error) {
      toast.error(mensajeDeError(error, "No se pudo cambiar el estado del operativo"));
    }
  }

  const vigente = esVigente(operativo.estado);
  return (
    <>
      <EncabezadoPagina
        titulo={`Operativo del ${formatearFecha(operativo.fecha)}`}
        descripcion={`${operativo.hora_inicio} a ${operativo.hora_fin} · ${operativo.lugar} (${operativo.zona}) · Cupo: ${textoCupo(operativo)}`}
        acciones={
          <>
            {volver}
            {puedeGestionar && vigente && (
              <Button variant="outline" onClick={() => setEditando(true)}><Pencil /> Editar</Button>
            )}
            {puedeGestionar && operativo.estado === "programado" && (
              <Button onClick={() => setNuevoEstado("en_curso")}><Play /> Iniciar</Button>
            )}
            {puedeGestionar && operativo.estado === "en_curso" && (
              <Button onClick={() => setNuevoEstado("realizado")}><CheckCircle2 /> Finalizar</Button>
            )}
            {puedeCancelar && operativo.estado === "programado" && (
              <Button variant="destructive" onClick={() => setCancelando(true)}><Ban /> Cancelar</Button>
            )}
          </>
        }
      />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <BadgeOperativo estado={operativo.estado} />
        {operativo.motivo_cancelacion && (
          <span className="text-sm text-muted-foreground">Motivo de cancelación: {operativo.motivo_cancelacion}</span>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <PersonalOperativo operativo={operativo} puedeGestionar={puedeGestionar && vigente} onCambio={mutate} />
        <section>
          <h2 className="mb-3 text-lg font-semibold">Turnos</h2>
          <ListadoTurnos
            operativoId={id}
            puedeGestionar={puedeGestionarTurnos}
            permitirAlta={operativo.estado === "programado"}
            onCambio={() => void mutate()}
          />
        </section>
      </div>

      {editando && (
        <FormularioOperativo
          operativo={operativo}
          onCerrar={() => setEditando(false)}
          onGuardado={async () => {
            setEditando(false);
            await mutate();
          }}
        />
      )}
      {cancelando && (
        <FormularioCancelarOperativo
          operativo={operativo}
          onCerrar={() => setCancelando(false)}
          onCancelado={async () => {
            setCancelando(false);
            await mutate();
          }}
        />
      )}
      <ConfirmarDialogo
        abierto={nuevoEstado !== null}
        titulo={nuevoEstado === "en_curso" ? "Iniciar operativo" : "Finalizar operativo"}
        descripcion={
          nuevoEstado === "en_curso"
            ? "El operativo pasará a estar en curso (solo es posible el día programado)."
            : "El operativo pasará a realizado. Los turnos que sigan pendientes o confirmados se cancelarán con el motivo \"No se presentó\"."
        }
        textoConfirmar={nuevoEstado === "en_curso" ? "Iniciar" : "Finalizar"}
        onConfirmar={cambiarEstado}
        onCerrar={() => setNuevoEstado(null)}
      />
    </>
  );
}
