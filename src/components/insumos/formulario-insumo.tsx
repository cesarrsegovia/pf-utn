"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { CampoFormulario } from "@/components/comunes/campo-formulario";
import { FormularioDialogo } from "@/components/comunes/formulario-dialogo";
import { Input } from "@/components/ui/input";
import { llamarApi } from "@/lib/cliente-api";
import { mostrarErrorFormulario } from "@/lib/formularios";
import { esquemaCrearInsumo, type DatosCrearInsumo } from "@/schemas/insumos";
import type { InsumoDto } from "@/services/insumos";

/**
 * Diálogo de alta/edición de insumo (F6). En edición el stock inicial no se muestra
 * (queda en 0 y la API de edición lo descarta): el stock solo cambia por movimientos.
 */
export function FormularioInsumo({ insumo, onCerrar, onGuardado }: {
  insumo: InsumoDto | null;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const { register, handleSubmit, setError, formState } = useForm<DatosCrearInsumo>({
    resolver: zodResolver(esquemaCrearInsumo),
    defaultValues: {
      nombre: insumo?.nombre ?? "",
      unidad: insumo?.unidad ?? "",
      stock_minimo: insumo ? Number(insumo.stock_minimo) : 0,
      stock_inicial: 0,
    },
  });

  async function guardar(datos: DatosCrearInsumo) {
    try {
      await llamarApi(insumo ? `/api/insumos/${insumo.id}` : "/api/insumos", {
        metodo: insumo ? "PUT" : "POST",
        cuerpo: datos,
      });
      toast.success(insumo ? "Insumo actualizado" : "Insumo creado");
      onGuardado();
    } catch (error) {
      mostrarErrorFormulario(error, setError, "No se pudo guardar el insumo");
    }
  }

  const errores = formState.errors;
  return (
    <FormularioDialogo
      titulo={insumo ? "Editar insumo" : "Nuevo insumo"}
      descripcion={insumo ? "El stock actual se modifica registrando movimientos." : undefined}
      idFormulario="formulario-insumo"
      enviando={formState.isSubmitting}
      onCerrar={onCerrar}
    >
      <form id="formulario-insumo" onSubmit={handleSubmit(guardar)} className="grid gap-4" noValidate>
        <CampoFormulario id="nombre" etiqueta="Nombre" error={errores.nombre?.message}>
          <Input id="nombre" {...register("nombre")} />
        </CampoFormulario>
        <CampoFormulario id="unidad" etiqueta="Unidad (ml, comprimidos, unidades…)" error={errores.unidad?.message}>
          <Input id="unidad" {...register("unidad")} />
        </CampoFormulario>
        <div className="grid grid-cols-2 gap-4">
          {!insumo && (
            <CampoFormulario id="stock_inicial" etiqueta="Stock inicial" error={errores.stock_inicial?.message}>
              <Input id="stock_inicial" type="number" step="0.01" min={0} {...register("stock_inicial", { valueAsNumber: true })} />
            </CampoFormulario>
          )}
          <CampoFormulario id="stock_minimo" etiqueta="Stock mínimo" error={errores.stock_minimo?.message}>
            <Input id="stock_minimo" type="number" step="0.01" min={0} {...register("stock_minimo", { valueAsNumber: true })} />
          </CampoFormulario>
        </div>
      </form>
    </FormularioDialogo>
  );
}
