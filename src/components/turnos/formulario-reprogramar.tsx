"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { CampoFormulario } from "@/components/comunes/campo-formulario";
import { FormularioDialogo } from "@/components/comunes/formulario-dialogo";
import { SelectOpciones } from "@/components/comunes/select-opciones";
import { Input } from "@/components/ui/input";
import { llamarApi } from "@/lib/cliente-api";
import { formatearFecha } from "@/lib/fechas";
import { mostrarErrorFormulario } from "@/lib/formularios";
import { esquemaReprogramarTurno, type DatosReprogramarTurno } from "@/schemas/turnos";
import type { TurnoDto } from "@/services/turnos";

/** Diálogo para reprogramar un turno activo: otro horario y/o otro operativo (F3). */
export function FormularioReprogramar({ turno, onCerrar, onGuardado }: {
  turno: TurnoDto;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const { register, control, handleSubmit, setError, formState } = useForm<DatosReprogramarTurno>({
    resolver: zodResolver(esquemaReprogramarTurno),
    defaultValues: { operativo_id: turno.operativo_id, horario: turno.horario },
  });

  async function guardar(datos: DatosReprogramarTurno) {
    try {
      await llamarApi(`/api/turnos/${turno.id}/reprogramar`, { metodo: "POST", cuerpo: datos });
      toast.success("Turno reprogramado. Se avisará al vecino por correo.");
      onGuardado();
    } catch (error) {
      mostrarErrorFormulario(error, setError, "No se pudo reprogramar el turno");
    }
  }

  const errores = formState.errors;
  return (
    <FormularioDialogo
      titulo={`Reprogramar turno de ${turno.animal}`}
      descripcion={`Actual: ${formatearFecha(turno.fecha)} a las ${turno.horario} en ${turno.lugar} (${turno.zona}).`}
      idFormulario="formulario-reprogramar"
      enviando={formState.isSubmitting}
      textoEnviar="Reprogramar"
      onCerrar={onCerrar}
    >
      <form id="formulario-reprogramar" onSubmit={handleSubmit(guardar)} className="grid gap-4" noValidate>
        <CampoFormulario id="operativo_id" etiqueta="Operativo" error={errores.operativo_id?.message}>
          <Controller
            control={control}
            name="operativo_id"
            render={({ field }) => (
              <SelectOpciones
                id="operativo_id"
                url="/api/operativos/opciones"
                valor={field.value}
                onCambiar={field.onChange}
                invalido={!!errores.operativo_id}
              />
            )}
          />
        </CampoFormulario>
        <CampoFormulario id="horario" etiqueta="Horario" error={errores.horario?.message}>
          <Input id="horario" type="time" {...register("horario")} />
        </CampoFormulario>
      </form>
    </FormularioDialogo>
  );
}
