"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { CampoFormulario } from "@/components/comunes/campo-formulario";
import { FormularioDialogo } from "@/components/comunes/formulario-dialogo";
import { SelectOpciones } from "@/components/comunes/select-opciones";
import { llamarApi } from "@/lib/cliente-api";
import { mostrarErrorFormulario } from "@/lib/formularios";
import { esquemaAtenderAvistamiento, type DatosAtenderAvistamiento } from "@/schemas/avistamientos";
import type { AvistamientoDto } from "@/services/avistamientos";

/**
 * Diálogo para marcar un reporte como atendido (F9). La fecha de atención es la actual;
 * el operativo es opcional y solo se ofrecen los no cancelados de la zona del reporte.
 */
export function FormularioAtenderAvistamiento({ reporte, onCerrar, onGuardado }: {
  reporte: AvistamientoDto;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const { control, handleSubmit, setError, formState } = useForm<DatosAtenderAvistamiento>({
    resolver: zodResolver(esquemaAtenderAvistamiento),
    defaultValues: { operativo_id: null },
  });

  async function guardar(datos: DatosAtenderAvistamiento) {
    try {
      await llamarApi(`/api/avistamientos/${reporte.id}/atender`, { metodo: "POST", cuerpo: datos });
      toast.success("Reporte marcado como atendido");
      onGuardado();
    } catch (error) {
      mostrarErrorFormulario(error, setError, "No se pudo atender el reporte");
    }
  }

  const error = formState.errors.operativo_id?.message;
  return (
    <FormularioDialogo
      titulo="Atender avistamiento"
      descripcion={`Zona ${reporte.zona} · ${reporte.cantidad_animales} animal(es). Se registra la fecha y hora actuales como atención.`}
      idFormulario="formulario-atender-avistamiento"
      enviando={formState.isSubmitting}
      textoEnviar="Marcar como atendido"
      onCerrar={onCerrar}
    >
      <form id="formulario-atender-avistamiento" onSubmit={handleSubmit(guardar)} className="grid gap-4" noValidate>
        <CampoFormulario id="operativo_id" etiqueta="Operativo que atendió la zona (opcional)" error={error}>
          <Controller
            control={control}
            name="operativo_id"
            render={({ field }) => (
              <SelectOpciones
                id="operativo_id"
                url={`/api/avistamientos/operativos?zona_id=${reporte.zona_id}`}
                valor={field.value}
                onCambiar={field.onChange}
                placeholder="Sin operativo asociado"
                invalido={!!error}
              />
            )}
          />
        </CampoFormulario>
      </form>
    </FormularioDialogo>
  );
}
