"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AreaTexto } from "@/components/comunes/area-texto";
import { CampoFormulario } from "@/components/comunes/campo-formulario";
import { FormularioDialogo } from "@/components/comunes/formulario-dialogo";
import { SelectOpciones } from "@/components/comunes/select-opciones";
import { Input } from "@/components/ui/input";
import { llamarApi } from "@/lib/cliente-api";
import { hoyLocal, partesLocales } from "@/lib/fechas";
import { mostrarErrorFormulario } from "@/lib/formularios";
import { esquemaAvistamiento, type DatosAvistamiento } from "@/schemas/avistamientos";
import type { AvistamientoDto } from "@/services/avistamientos";

/** Valores iniciales: los del reporte en edición o, en un alta, la fecha y hora actuales. */
function valoresIniciales(reporte: AvistamientoDto | null): DatosAvistamiento {
  if (!reporte) {
    return {
      ...partesLocales(new Date()),
      descripcion: "",
      cantidad_animales: 1,
      direccion_referencia: "",
      // null hasta que se elige (el esquema responde "Seleccione una zona").
      zona_id: null as unknown as number,
      vecino_id: null,
    };
  }
  return {
    ...partesLocales(reporte.fecha),
    descripcion: reporte.descripcion,
    cantidad_animales: reporte.cantidad_animales,
    direccion_referencia: reporte.direccion_referencia ?? "",
    zona_id: reporte.zona_id,
    vecino_id: reporte.vecino_id,
  };
}

/** Diálogo de alta/edición de un reporte de avistamiento (F9). Valida con el mismo esquema que la API. */
export function FormularioAvistamiento({ reporte, onCerrar, onGuardado }: {
  reporte: AvistamientoDto | null;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const { register, control, handleSubmit, setError, formState } = useForm<DatosAvistamiento>({
    resolver: zodResolver(esquemaAvistamiento),
    defaultValues: valoresIniciales(reporte),
  });

  async function guardar(datos: DatosAvistamiento) {
    try {
      await llamarApi(reporte ? `/api/avistamientos/${reporte.id}` : "/api/avistamientos", {
        metodo: reporte ? "PUT" : "POST",
        cuerpo: datos,
      });
      toast.success(reporte ? "Reporte actualizado" : "Reporte registrado");
      onGuardado();
    } catch (error) {
      mostrarErrorFormulario(error, setError, "No se pudo guardar el reporte");
    }
  }

  // En edición se incluye al vecino actual aunque esté dado de baja.
  const urlVecinos = reporte?.vecino_id ? `/api/vecinos/opciones?incluirId=${reporte.vecino_id}` : "/api/vecinos/opciones";
  const errores = formState.errors;
  return (
    <FormularioDialogo
      titulo={reporte ? "Editar avistamiento" : "Nuevo avistamiento"}
      descripcion="Aviso de animales sueltos por zona (sin GPS). El vecino que avisó es opcional."
      idFormulario="formulario-avistamiento"
      enviando={formState.isSubmitting}
      amplio
      onCerrar={onCerrar}
    >
      <form id="formulario-avistamiento" onSubmit={handleSubmit(guardar)} className="grid gap-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-3">
          <CampoFormulario id="fecha" etiqueta="Fecha" error={errores.fecha?.message}>
            <Input id="fecha" type="date" max={hoyLocal()} {...register("fecha")} />
          </CampoFormulario>
          <CampoFormulario id="hora" etiqueta="Hora" error={errores.hora?.message}>
            <Input id="hora" type="time" {...register("hora")} />
          </CampoFormulario>
          <CampoFormulario id="cantidad_animales" etiqueta="Cantidad de animales" error={errores.cantidad_animales?.message}>
            <Input
              id="cantidad_animales"
              type="number"
              min={1}
              {...register("cantidad_animales", { valueAsNumber: true })}
            />
          </CampoFormulario>
        </div>
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
        <CampoFormulario
          id="direccion_referencia"
          etiqueta="Dirección o referencia (opcional)"
          error={errores.direccion_referencia?.message}
        >
          <Input id="direccion_referencia" {...register("direccion_referencia")} />
        </CampoFormulario>
        <CampoFormulario id="vecino_id" etiqueta="Vecino que dio el aviso (opcional)" error={errores.vecino_id?.message}>
          <Controller
            control={control}
            name="vecino_id"
            render={({ field }) => (
              <SelectOpciones
                id="vecino_id"
                url={urlVecinos}
                valor={field.value}
                onCambiar={field.onChange}
                placeholder="Anónimo / sin identificar"
              />
            )}
          />
        </CampoFormulario>
        <CampoFormulario id="descripcion" etiqueta="Descripción" error={errores.descripcion?.message}>
          <AreaTexto id="descripcion" aria-invalid={!!errores.descripcion || undefined} {...register("descripcion")} />
        </CampoFormulario>
      </form>
    </FormularioDialogo>
  );
}
