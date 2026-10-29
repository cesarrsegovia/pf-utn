"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { CampoFormulario } from "@/components/comunes/campo-formulario";
import { FormularioDialogo } from "@/components/comunes/formulario-dialogo";
import { SelectOpciones } from "@/components/comunes/select-opciones";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { llamarApi } from "@/lib/cliente-api";
import { TIPOS_PERSONAL } from "@/lib/constantes";
import { ETIQUETAS_TIPO_PERSONAL } from "@/lib/etiquetas";
import { mostrarErrorFormulario } from "@/lib/formularios";
import { esquemaPersonal, type DatosPersonal } from "@/schemas/personal";
import type { PersonalDto } from "@/services/personal";

/** Valores del formulario: vacíos para alta, los del registro para edición. */
function valoresIniciales(personal: PersonalDto | null): DatosPersonal {
  return {
    tipo: personal?.tipo ?? "veterinario",
    nombre: personal?.nombre ?? "",
    apellido: personal?.apellido ?? "",
    matricula: personal?.matricula ?? "",
    especialidad: personal?.especialidad ?? "",
    telefono: personal?.telefono ?? "",
    activo: personal?.activo ?? true,
    usuario_id: personal?.usuario_id ?? null,
  };
}

/** Diálogo de alta/edición de personal actuante (F5). */
export function FormularioPersonal({ personal, onCerrar, onGuardado }: {
  personal: PersonalDto | null;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const { register, control, handleSubmit, setError, formState } = useForm<DatosPersonal>({
    resolver: zodResolver(esquemaPersonal),
    defaultValues: valoresIniciales(personal),
  });

  async function guardar(datos: DatosPersonal) {
    try {
      await llamarApi(personal ? `/api/personal/${personal.id}` : "/api/personal", {
        metodo: personal ? "PUT" : "POST",
        cuerpo: datos,
      });
      toast.success(personal ? "Personal actualizado" : "Personal registrado");
      onGuardado();
    } catch (error) {
      mostrarErrorFormulario(error, setError, "No se pudo guardar el registro de personal");
    }
  }

  // En edición se ofrece también el usuario ya vinculado a este registro.
  const urlUsuarios = `/api/personal/usuarios-disponibles${personal ? `?personalId=${personal.id}` : ""}`;
  const errores = formState.errors;
  return (
    <FormularioDialogo
      titulo={personal ? "Editar personal" : "Nuevo integrante del personal"}
      descripcion="La matrícula es obligatoria para veterinarios. La cuenta de acceso es necesaria para registrar procedimientos."
      idFormulario="formulario-personal"
      enviando={formState.isSubmitting}
      amplio
      onCerrar={onCerrar}
    >
      <form id="formulario-personal" onSubmit={handleSubmit(guardar)} className="grid gap-4 sm:grid-cols-2" noValidate>
        <CampoFormulario id="tipo" etiqueta="Tipo" error={errores.tipo?.message}>
          <NativeSelect id="tipo" className="w-full" {...register("tipo")}>
            {TIPOS_PERSONAL.map((tipo) => (
              <NativeSelectOption key={tipo} value={tipo}>{ETIQUETAS_TIPO_PERSONAL[tipo]}</NativeSelectOption>
            ))}
          </NativeSelect>
        </CampoFormulario>
        <CampoFormulario id="matricula" etiqueta="Matrícula" error={errores.matricula?.message}>
          <Input id="matricula" {...register("matricula")} />
        </CampoFormulario>
        <CampoFormulario id="nombre" etiqueta="Nombre" error={errores.nombre?.message}>
          <Input id="nombre" {...register("nombre")} />
        </CampoFormulario>
        <CampoFormulario id="apellido" etiqueta="Apellido" error={errores.apellido?.message}>
          <Input id="apellido" {...register("apellido")} />
        </CampoFormulario>
        <CampoFormulario id="especialidad" etiqueta="Especialidad (opcional)" error={errores.especialidad?.message}>
          <Input id="especialidad" {...register("especialidad")} />
        </CampoFormulario>
        <CampoFormulario id="telefono" etiqueta="Teléfono (opcional)" error={errores.telefono?.message}>
          <Input id="telefono" {...register("telefono")} />
        </CampoFormulario>
        <div className="sm:col-span-2">
          <CampoFormulario id="usuario_id" etiqueta="Cuenta de acceso (opcional)" error={errores.usuario_id?.message}>
            <Controller
              control={control}
              name="usuario_id"
              render={({ field }) => (
                <SelectOpciones
                  id="usuario_id"
                  url={urlUsuarios}
                  valor={field.value}
                  onCambiar={field.onChange}
                  placeholder="Sin cuenta vinculada"
                  invalido={!!errores.usuario_id}
                />
              )}
            />
          </CampoFormulario>
        </div>
        <Controller
          control={control}
          name="activo"
          render={({ field }) => (
            <div className="flex items-center gap-2">
              <Checkbox id="activo" checked={field.value} onCheckedChange={(marcado) => field.onChange(marcado === true)} />
              <Label htmlFor="activo">Activo</Label>
            </div>
          )}
        />
      </form>
    </FormularioDialogo>
  );
}
