"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { CampoFormulario } from "@/components/comunes/campo-formulario";
import { FormularioDialogo } from "@/components/comunes/formulario-dialogo";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { llamarApi } from "@/lib/cliente-api";
import { mostrarErrorFormulario } from "@/lib/formularios";
import { esquemaCancelarOperativo, type DatosCancelarOperativo } from "@/schemas/operativos";
import type { OperativoDto, ResultadoCambioEstado } from "@/services/operativos";

/** Diálogo de cancelación de operativo (F4, solo administrador): motivo y casilla de fuerza mayor. */
export function FormularioCancelarOperativo({ operativo, onCerrar, onCancelado }: {
  operativo: OperativoDto;
  onCerrar: () => void;
  onCancelado: () => void;
}) {
  const { register, control, handleSubmit, setError, formState } = useForm<DatosCancelarOperativo>({
    resolver: zodResolver(esquemaCancelarOperativo),
    defaultValues: { motivo: "", fuerza_mayor: false },
  });

  async function cancelar(datos: DatosCancelarOperativo) {
    try {
      const { turnosCancelados } = await llamarApi<ResultadoCambioEstado>(`/api/operativos/${operativo.id}/cancelar`, {
        metodo: "POST",
        cuerpo: datos,
      });
      toast.success(`Operativo cancelado. Turnos cancelados: ${turnosCancelados}`);
      onCancelado();
    } catch (error) {
      mostrarErrorFormulario(error, setError, "No se pudo cancelar el operativo");
    }
  }

  return (
    <FormularioDialogo
      titulo="Cancelar operativo"
      descripcion="Se cancelarán los turnos pendientes y confirmados y se avisará por correo a los vecinos. Requiere 48 h de anticipación, salvo fuerza mayor."
      idFormulario="formulario-cancelar-operativo"
      enviando={formState.isSubmitting}
      textoEnviar="Cancelar operativo"
      onCerrar={onCerrar}
    >
      <form id="formulario-cancelar-operativo" onSubmit={handleSubmit(cancelar)} className="grid gap-4" noValidate>
        <CampoFormulario id="motivo" etiqueta="Motivo" error={formState.errors.motivo?.message}>
          <Input id="motivo" {...register("motivo")} />
        </CampoFormulario>
        <Controller
          control={control}
          name="fuerza_mayor"
          render={({ field }) => (
            <div className="flex items-start gap-2">
              <Checkbox id="fuerza_mayor" checked={field.value} onCheckedChange={(marcado) => field.onChange(marcado === true)} />
              <Label htmlFor="fuerza_mayor" className="leading-snug">
                Fuerza mayor: permite cancelar con menos de 48 h (antes del inicio). Justifíquela en el motivo.
              </Label>
            </div>
          )}
        />
      </form>
    </FormularioDialogo>
  );
}
