"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { CampoFormulario } from "@/components/comunes/campo-formulario";
import { FormularioDialogo } from "@/components/comunes/formulario-dialogo";
import { Input } from "@/components/ui/input";
import { llamarApi } from "@/lib/cliente-api";
import { mostrarErrorFormulario } from "@/lib/formularios";
import { esquemaZona, type DatosZona } from "@/schemas/zonas";
import type { ZonaDto } from "@/services/zonas";

/** Diálogo de alta/edición de zona (F10). Valida con el mismo esquema que la API. */
export function FormularioZona({ zona, onCerrar, onGuardado }: {
  zona: ZonaDto | null;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const { register, handleSubmit, setError, formState } = useForm<DatosZona>({
    resolver: zodResolver(esquemaZona),
    defaultValues: { nombre: zona?.nombre ?? "", descripcion: zona?.descripcion ?? "" },
  });

  async function guardar(datos: DatosZona) {
    try {
      await llamarApi(zona ? `/api/zonas/${zona.id}` : "/api/zonas", { metodo: zona ? "PUT" : "POST", cuerpo: datos });
      toast.success(zona ? "Zona actualizada" : "Zona creada");
      onGuardado();
    } catch (error) {
      mostrarErrorFormulario(error, setError, "No se pudo guardar la zona");
    }
  }

  const errores = formState.errors;
  return (
    <FormularioDialogo
      titulo={zona ? "Editar zona" : "Nueva zona"}
      idFormulario="formulario-zona"
      enviando={formState.isSubmitting}
      onCerrar={onCerrar}
    >
      <form id="formulario-zona" onSubmit={handleSubmit(guardar)} className="grid gap-4" noValidate>
        <CampoFormulario id="nombre" etiqueta="Nombre" error={errores.nombre?.message}>
          <Input id="nombre" {...register("nombre")} />
        </CampoFormulario>
        <CampoFormulario id="descripcion" etiqueta="Descripción (opcional)" error={errores.descripcion?.message}>
          <Input id="descripcion" {...register("descripcion")} />
        </CampoFormulario>
      </form>
    </FormularioDialogo>
  );
}
