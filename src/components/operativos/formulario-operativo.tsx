"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { CampoFormulario } from "@/components/comunes/campo-formulario";
import { FormularioDialogo } from "@/components/comunes/formulario-dialogo";
import { SelectOpciones } from "@/components/comunes/select-opciones";
import { Input } from "@/components/ui/input";
import { llamarApi } from "@/lib/cliente-api";
import { mostrarErrorFormulario } from "@/lib/formularios";
import { esquemaOperativo, type DatosOperativo } from "@/schemas/operativos";
import type { OperativoDto } from "@/services/operativos";

/** Valores del formulario: franja 09:00–13:00 y cupo 20 para un alta; los del operativo para edición. */
function valoresIniciales(operativo: OperativoDto | null): DatosOperativo {
  return {
    fecha: operativo?.fecha ?? "",
    hora_inicio: operativo?.hora_inicio ?? "09:00",
    hora_fin: operativo?.hora_fin ?? "13:00",
    lugar: operativo?.lugar ?? "",
    cupo_maximo: operativo?.cupo_maximo ?? 20,
    // null hasta que se elige una zona (el esquema responde "Seleccione una zona").
    zona_id: operativo?.zona_id ?? (null as unknown as number),
  };
}

/** Diálogo de alta/edición de operativo (F4). */
export function FormularioOperativo({ operativo, onCerrar, onGuardado }: {
  operativo: OperativoDto | null;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const { register, control, handleSubmit, setError, formState } = useForm<DatosOperativo>({
    resolver: zodResolver(esquemaOperativo),
    defaultValues: valoresIniciales(operativo),
  });

  async function guardar(datos: DatosOperativo) {
    try {
      await llamarApi(operativo ? `/api/operativos/${operativo.id}` : "/api/operativos", {
        metodo: operativo ? "PUT" : "POST",
        cuerpo: datos,
      });
      toast.success(operativo ? "Operativo actualizado" : "Operativo creado");
      onGuardado();
    } catch (error) {
      mostrarErrorFormulario(error, setError, "No se pudo guardar el operativo");
    }
  }

  const errores = formState.errors;
  return (
    <FormularioDialogo
      titulo={operativo ? "Editar operativo" : "Nuevo operativo"}
      descripcion={
        operativo
          ? "Si cambia la fecha, el horario o el lugar, se avisa por correo a los vecinos con turno."
          : "La fecha y hora de inicio deben ser futuras."
      }
      idFormulario="formulario-operativo"
      enviando={formState.isSubmitting}
      amplio
      onCerrar={onCerrar}
    >
      <form id="formulario-operativo" onSubmit={handleSubmit(guardar)} className="grid gap-4 sm:grid-cols-2" noValidate>
        <CampoFormulario id="fecha" etiqueta="Fecha" error={errores.fecha?.message}>
          <Input id="fecha" type="date" {...register("fecha")} />
        </CampoFormulario>
        <CampoFormulario id="zona_id" etiqueta="Zona" error={errores.zona_id?.message}>
          <Controller
            control={control}
            name="zona_id"
            render={({ field }) => (
              <SelectOpciones
                id="zona_id"
                url="/api/zonas/opciones"
                valor={field.value}
                onCambiar={field.onChange}
                invalido={!!errores.zona_id}
              />
            )}
          />
        </CampoFormulario>
        <CampoFormulario id="hora_inicio" etiqueta="Hora de inicio" error={errores.hora_inicio?.message}>
          <Input id="hora_inicio" type="time" {...register("hora_inicio")} />
        </CampoFormulario>
        <CampoFormulario id="hora_fin" etiqueta="Hora de fin" error={errores.hora_fin?.message}>
          <Input id="hora_fin" type="time" {...register("hora_fin")} />
        </CampoFormulario>
        <CampoFormulario id="lugar" etiqueta="Lugar" error={errores.lugar?.message}>
          <Input id="lugar" placeholder="SUM, centro vecinal, escuela…" {...register("lugar")} />
        </CampoFormulario>
        <CampoFormulario id="cupo_maximo" etiqueta="Cupo máximo de turnos" error={errores.cupo_maximo?.message}>
          <Input id="cupo_maximo" type="number" min={1} {...register("cupo_maximo", { valueAsNumber: true })} />
        </CampoFormulario>
      </form>
    </FormularioDialogo>
  );
}
