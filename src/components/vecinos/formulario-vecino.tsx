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
import { esquemaVecino, type DatosVecino } from "@/schemas/vecinos";
import type { VecinoDto } from "@/services/vecinos";

/** Diálogo de alta/edición de vecino (F1). La zona es un número; null hasta que se elige. */
export function FormularioVecino({ vecino, onCerrar, onGuardado }: {
  vecino: VecinoDto | null;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const { register, control, handleSubmit, setError, formState } = useForm<DatosVecino>({
    resolver: zodResolver(esquemaVecino),
    defaultValues: {
      nombre: vecino?.nombre ?? "",
      apellido: vecino?.apellido ?? "",
      dni: vecino?.dni ?? "",
      telefono: vecino?.telefono ?? "",
      email: vecino?.email ?? "",
      direccion: vecino?.direccion ?? "",
      // null hasta que se elige una zona (el esquema responde "Seleccione una zona").
      zona_id: vecino?.zona_id ?? (null as unknown as number),
    },
  });

  async function guardar(datos: DatosVecino) {
    try {
      await llamarApi(vecino ? `/api/vecinos/${vecino.id}` : "/api/vecinos", {
        metodo: vecino ? "PUT" : "POST",
        cuerpo: datos,
      });
      toast.success(vecino ? "Vecino actualizado" : "Vecino registrado");
      onGuardado();
    } catch (error) {
      mostrarErrorFormulario(error, setError, "No se pudo guardar el vecino");
    }
  }

  const errores = formState.errors;
  return (
    <FormularioDialogo
      titulo={vecino ? "Editar vecino" : "Nuevo vecino"}
      descripcion="El email es opcional; sin email el vecino no recibe notificaciones."
      idFormulario="formulario-vecino"
      enviando={formState.isSubmitting}
      amplio
      onCerrar={onCerrar}
    >
      <form id="formulario-vecino" onSubmit={handleSubmit(guardar)} className="grid gap-4 sm:grid-cols-2" noValidate>
        <CampoFormulario id="nombre" etiqueta="Nombre" error={errores.nombre?.message}>
          <Input id="nombre" {...register("nombre")} />
        </CampoFormulario>
        <CampoFormulario id="apellido" etiqueta="Apellido" error={errores.apellido?.message}>
          <Input id="apellido" {...register("apellido")} />
        </CampoFormulario>
        <CampoFormulario id="dni" etiqueta="DNI (sin puntos)" error={errores.dni?.message}>
          <Input id="dni" inputMode="numeric" {...register("dni")} />
        </CampoFormulario>
        <CampoFormulario id="telefono" etiqueta="Teléfono" error={errores.telefono?.message}>
          <Input id="telefono" {...register("telefono")} />
        </CampoFormulario>
        <CampoFormulario id="email" etiqueta="Email (opcional)" error={errores.email?.message}>
          <Input id="email" type="email" {...register("email")} />
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
        <div className="sm:col-span-2">
          <CampoFormulario id="direccion" etiqueta="Dirección" error={errores.direccion?.message}>
            <Input id="direccion" {...register("direccion")} />
          </CampoFormulario>
        </div>
      </form>
    </FormularioDialogo>
  );
}
