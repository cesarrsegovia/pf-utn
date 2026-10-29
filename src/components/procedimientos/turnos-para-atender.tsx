"use client";

import { useState } from "react";
import useSWR from "swr";
import { Syringe } from "lucide-react";
import { TablaDatos, type Columna } from "@/components/comunes/tabla-datos";
import { Button } from "@/components/ui/button";
import { obtenerJson } from "@/lib/cliente-api";
import { ETIQUETAS_TIPO_PROCEDIMIENTO } from "@/lib/etiquetas";
import type { TurnosParaAtender as DatosTurnosParaAtender } from "@/services/procedimientos";
import type { TurnoDto } from "@/services/turnos";
import { FormularioProcedimiento } from "./formulario-procedimiento";

/** Turnos confirmados de los operativos en curso del veterinario, con el registro de procedimiento (F7). */
export function TurnosParaAtender() {
  const { data, isLoading, mutate } = useSWR<DatosTurnosParaAtender>("/api/procedimientos/turnos", obtenerJson);
  const [aRegistrar, setARegistrar] = useState<TurnoDto | null>(null);

  if (data && !data.habilitado) {
    return <p className="rounded-lg border p-4 text-sm text-muted-foreground">{data.motivo}</p>;
  }

  const columnas: Columna<TurnoDto>[] = [
    { titulo: "Hora", celda: (t) => t.horario },
    { titulo: "Animal", celda: (t) => t.animal },
    { titulo: "Tutor", celda: (t) => t.tutor ?? "Sin tutor" },
    { titulo: "Solicitado", celda: (t) => ETIQUETAS_TIPO_PROCEDIMIENTO[t.tipo_solicitado] },
    { titulo: "Lugar", celda: (t) => `${t.lugar} (${t.zona})` },
    {
      titulo: "Acción",
      className: "w-36 text-right",
      celda: (t) => (
        <Button size="sm" onClick={() => setARegistrar(t)}>
          <Syringe /> Registrar
        </Button>
      ),
    },
  ];

  return (
    <>
      <TablaDatos
        columnas={columnas}
        filas={data?.turnos}
        claveFila={(t) => t.id}
        cargando={isLoading}
        mensajeVacio="No tiene turnos confirmados en operativos en curso"
      />
      {aRegistrar && (
        <FormularioProcedimiento
          turno={aRegistrar}
          onCerrar={() => setARegistrar(null)}
          onGuardado={async () => {
            setARegistrar(null);
            await mutate();
          }}
        />
      )}
    </>
  );
}
