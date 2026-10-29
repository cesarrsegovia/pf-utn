"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { CampoFormulario } from "@/components/comunes/campo-formulario";
import { FormularioDialogo } from "@/components/comunes/formulario-dialogo";
import { Input } from "@/components/ui/input";
import { llamarApi } from "@/lib/cliente-api";
import { mostrarErrorFormulario } from "@/lib/formularios";
import { esquemaCancelarTurno, type DatosCancelarTurno } from "@/schemas/turnos";
import type { TurnoDto } from "@/services/turnos";

/** Diálogo de cancelación de un turno: el motivo es obligatorio y viaja en el correo al vecino. */
export function FormularioCancelarTurno({ turno, onCerrar, onGuardado }: {
  turno: TurnoDto;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const { register, handleSubmit, setError, formState } = useForm<DatosCancelarTurno>({
    resolver: zodResolver(esquemaCancelarTurno),
    defaultValues: { motivo: "" },
  });

  async function cancelar(datos: DatosCancelarTurno) {
    try {
      await llamarApi(`/api/turnos/${turno.id}/cancelar`, { metodo: "POST", cuerpo: datos });
      toast.success("Turno cancelado");
      onGuardado();
    } catch (error) {
      mostrarErrorFormulario(error, setError, "No se pudo cancelar el turno");
    }
  }

  return (
    <FormularioDialogo
      titulo={`Cancelar turno de ${turno.animal}`}
      descripcion="Se anulará el recordatorio y se avisará al vecino por correo."
      idFormulario="formulario-cancelar-turno"
      enviando={formState.isSubmitting}
      textoEnviar="Cancelar turno"
      onCerrar={onCerrar}
    >
      <form id="formulario-cancelar-turno" onSubmit={handleSubmit(cancelar)} className="grid gap-4" noValidate>
        <CampoFormulario id="motivo" etiqueta="Motivo" error={formState.errors.motivo?.message}>
          <Input id="motivo" {...register("motivo")} />
        </CampoFormulario>
      </form>
    </FormularioDialogo>
  );
}
