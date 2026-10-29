"use client";

import { Controller, useForm, useWatch } from "react-hook-form";
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
import { CONDICIONES_ANIMAL, SEXOS_ANIMAL } from "@/lib/constantes";
import { ETIQUETAS_CONDICION, ETIQUETAS_SEXO } from "@/lib/etiquetas";
import { mostrarErrorFormulario, numeroONulo } from "@/lib/formularios";
import { esquemaAnimal, type DatosAnimal } from "@/schemas/animales";
import type { AnimalDto } from "@/services/animales";

/** Valores del formulario: vacíos para alta, los del animal para edición. */
function valoresIniciales(animal: AnimalDto | null): DatosAnimal {
  return {
    nombre: animal?.nombre ?? "",
    raza: animal?.raza ?? "",
    sexo: animal?.sexo ?? "M",
    edad_estimada: animal?.edad_estimada ?? null,
    condicion: animal?.condicion ?? "con_tutor",
    vecino_id: animal?.vecino_id ?? null,
    numero_chip: animal?.numero_chip ?? "",
    castrado: animal?.castrado ?? false,
  };
}

/** Diálogo de alta/edición de animal (F2). El tutor solo se pide si la condición es "con tutor". */
export function FormularioAnimal({ animal, onCerrar, onGuardado }: {
  animal: AnimalDto | null;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const { register, control, handleSubmit, setError, formState } = useForm<DatosAnimal>({
    resolver: zodResolver(esquemaAnimal),
    defaultValues: valoresIniciales(animal),
  });
  const condicion = useWatch({ control, name: "condicion" });

  async function guardar(datos: DatosAnimal) {
    try {
      await llamarApi(animal ? `/api/animales/${animal.id}` : "/api/animales", {
        metodo: animal ? "PUT" : "POST",
        cuerpo: datos,
      });
      toast.success(animal ? "Animal actualizado" : "Animal registrado");
      onGuardado();
    } catch (error) {
      mostrarErrorFormulario(error, setError, "No se pudo guardar el animal");
    }
  }

  // En edición se ofrece también el tutor actual, aunque haya sido dado de baja.
  const urlTutores = `/api/vecinos/opciones${animal?.vecino_id ? `?incluirId=${animal.vecino_id}` : ""}`;
  const errores = formState.errors;
  return (
    <FormularioDialogo
      titulo={animal ? "Editar animal" : "Nuevo animal"}
      idFormulario="formulario-animal"
      enviando={formState.isSubmitting}
      amplio
      onCerrar={onCerrar}
    >
      <form id="formulario-animal" onSubmit={handleSubmit(guardar)} className="grid gap-4 sm:grid-cols-2" noValidate>
        <CampoFormulario id="nombre" etiqueta="Nombre (opcional)" error={errores.nombre?.message}>
          <Input id="nombre" {...register("nombre")} />
        </CampoFormulario>
        <CampoFormulario id="raza" etiqueta="Raza (opcional)" error={errores.raza?.message}>
          <Input id="raza" {...register("raza")} />
        </CampoFormulario>
        <CampoFormulario id="sexo" etiqueta="Sexo" error={errores.sexo?.message}>
          <NativeSelect id="sexo" className="w-full" {...register("sexo")}>
            {SEXOS_ANIMAL.map((sexo) => (
              <NativeSelectOption key={sexo} value={sexo}>{ETIQUETAS_SEXO[sexo]}</NativeSelectOption>
            ))}
          </NativeSelect>
        </CampoFormulario>
        <CampoFormulario id="edad_estimada" etiqueta="Edad estimada en años (opcional)" error={errores.edad_estimada?.message}>
          <Input id="edad_estimada" type="number" min={0} {...register("edad_estimada", { setValueAs: numeroONulo })} />
        </CampoFormulario>
        <CampoFormulario id="condicion" etiqueta="Condición" error={errores.condicion?.message}>
          <NativeSelect id="condicion" className="w-full" {...register("condicion")}>
            {CONDICIONES_ANIMAL.map((valor) => (
              <NativeSelectOption key={valor} value={valor}>{ETIQUETAS_CONDICION[valor]}</NativeSelectOption>
            ))}
          </NativeSelect>
        </CampoFormulario>
        {condicion === "con_tutor" && (
          <CampoFormulario id="vecino_id" etiqueta="Tutor" error={errores.vecino_id?.message}>
            <Controller
              control={control}
              name="vecino_id"
              render={({ field }) => (
                <SelectOpciones
                  id="vecino_id"
                  url={urlTutores}
                  valor={field.value}
                  onCambiar={field.onChange}
                  invalido={!!errores.vecino_id}
                />
              )}
            />
          </CampoFormulario>
        )}
        <CampoFormulario id="numero_chip" etiqueta="Número de chip (opcional, 15 dígitos)" error={errores.numero_chip?.message}>
          <Input id="numero_chip" inputMode="numeric" {...register("numero_chip")} />
        </CampoFormulario>
        <Controller
          control={control}
          name="castrado"
          render={({ field }) => (
            <div className="flex items-center gap-2 self-end pb-2">
              <Checkbox id="castrado" checked={field.value} onCheckedChange={(marcado) => field.onChange(marcado === true)} />
              <Label htmlFor="castrado">Castrado</Label>
            </div>
          )}
        />
      </form>
    </FormularioDialogo>
  );
}
