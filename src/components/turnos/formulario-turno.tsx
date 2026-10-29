"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { CampoFormulario } from "@/components/comunes/campo-formulario";
import { FormularioDialogo } from "@/components/comunes/formulario-dialogo";
import { SelectOpciones } from "@/components/comunes/select-opciones";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { llamarApi } from "@/lib/cliente-api";
import { TIPOS_PROCEDIMIENTO } from "@/lib/constantes";
import { ETIQUETAS_TIPO_PROCEDIMIENTO } from "@/lib/etiquetas";
import { mostrarErrorFormulario } from "@/lib/formularios";
import { esquemaSolicitarTurno, type DatosSolicitarTurno } from "@/schemas/turnos";

/** Diálogo de solicitud de turno (F3). Desde el detalle de un operativo, llega preseleccionado. */
export function FormularioTurno({ operativoId, onCerrar, onGuardado }: {
  operativoId?: number;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const { register, control, handleSubmit, setError, formState } = useForm<DatosSolicitarTurno>({
    resolver: zodResolver(esquemaSolicitarTurno),
    defaultValues: {
      // null hasta que se elige (el esquema responde "Seleccione …").
      animal_id: null as unknown as number,
      operativo_id: operativoId ?? (null as unknown as number),
      horario: "",
      tipo_solicitado: "castracion_y_chipeo",
    },
  });

  async function guardar(datos: DatosSolicitarTurno) {
    try {
      await llamarApi("/api/turnos", { metodo: "POST", cuerpo: datos });
      toast.success("Turno solicitado: queda pendiente de confirmación");
      onGuardado();
    } catch (error) {
      mostrarErrorFormulario(error, setError, "No se pudo solicitar el turno");
    }
  }

  const errores = formState.errors;
  return (
    <FormularioDialogo
      titulo="Nuevo turno"
      descripcion="Solo se listan los animales sin tutor o con tutor activo y los operativos programados."
      idFormulario="formulario-turno"
      enviando={formState.isSubmitting}
      amplio
      onCerrar={onCerrar}
    >
      <form id="formulario-turno" onSubmit={handleSubmit(guardar)} className="grid gap-4" noValidate>
        <CampoFormulario id="animal_id" etiqueta="Animal" error={errores.animal_id?.message}>
          <Controller
            control={control}
            name="animal_id"
            render={({ field }) => (
              <SelectOpciones
                id="animal_id"
                url="/api/animales/opciones"
                valor={field.value}
                onCambiar={field.onChange}
                invalido={!!errores.animal_id}
              />
            )}
          />
        </CampoFormulario>
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
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoFormulario id="horario" etiqueta="Horario" error={errores.horario?.message}>
            <Input id="horario" type="time" {...register("horario")} />
          </CampoFormulario>
          <CampoFormulario id="tipo_solicitado" etiqueta="Procedimiento" error={errores.tipo_solicitado?.message}>
            <NativeSelect id="tipo_solicitado" className="w-full" {...register("tipo_solicitado")}>
              {TIPOS_PROCEDIMIENTO.map((tipo) => (
                <NativeSelectOption key={tipo} value={tipo}>{ETIQUETAS_TIPO_PROCEDIMIENTO[tipo]}</NativeSelectOption>
              ))}
            </NativeSelect>
          </CampoFormulario>
        </div>
      </form>
    </FormularioDialogo>
  );
}
