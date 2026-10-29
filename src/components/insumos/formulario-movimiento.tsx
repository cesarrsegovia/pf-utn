"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { CampoFormulario } from "@/components/comunes/campo-formulario";
import { FormularioDialogo } from "@/components/comunes/formulario-dialogo";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { llamarApi } from "@/lib/cliente-api";
import { TIPOS_MOVIMIENTO } from "@/lib/constantes";
import { ETIQUETAS_TIPO_MOVIMIENTO } from "@/lib/etiquetas";
import { mostrarErrorFormulario } from "@/lib/formularios";
import { esquemaMovimiento, type DatosMovimiento } from "@/schemas/insumos";
import type { InsumoDto } from "@/services/insumos";

/** Diálogo para registrar un ingreso o egreso manual de stock (F6). */
export function FormularioMovimiento({ insumo, onCerrar, onGuardado }: {
  insumo: InsumoDto;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const { register, handleSubmit, setError, formState } = useForm<DatosMovimiento>({
    resolver: zodResolver(esquemaMovimiento),
    defaultValues: { tipo: "ingreso", motivo: "" },
  });

  async function guardar(datos: DatosMovimiento) {
    try {
      await llamarApi(`/api/insumos/${insumo.id}/movimientos`, { metodo: "POST", cuerpo: datos });
      toast.success("Movimiento registrado");
      onGuardado();
    } catch (error) {
      mostrarErrorFormulario(error, setError, "No se pudo registrar el movimiento");
    }
  }

  const errores = formState.errors;
  return (
    <FormularioDialogo
      titulo={`Movimiento de ${insumo.nombre}`}
      descripcion="Un egreso no puede superar el stock disponible."
      idFormulario="formulario-movimiento"
      enviando={formState.isSubmitting}
      onCerrar={onCerrar}
    >
      <form id="formulario-movimiento" onSubmit={handleSubmit(guardar)} className="grid gap-4" noValidate>
        <div className="grid grid-cols-2 gap-4">
          <CampoFormulario id="tipo" etiqueta="Tipo" error={errores.tipo?.message}>
            <NativeSelect id="tipo" className="w-full" {...register("tipo")}>
              {TIPOS_MOVIMIENTO.map((tipo) => (
                <NativeSelectOption key={tipo} value={tipo}>{ETIQUETAS_TIPO_MOVIMIENTO[tipo]}</NativeSelectOption>
              ))}
            </NativeSelect>
          </CampoFormulario>
          <CampoFormulario id="cantidad" etiqueta={`Cantidad (${insumo.unidad})`} error={errores.cantidad?.message}>
            <Input id="cantidad" type="number" step="0.01" min={0} {...register("cantidad", { valueAsNumber: true })} />
          </CampoFormulario>
        </div>
        <CampoFormulario id="motivo" etiqueta="Motivo" error={errores.motivo?.message}>
          <Input id="motivo" placeholder="Compra, vencimiento, ajuste de inventario…" {...register("motivo")} />
        </CampoFormulario>
      </form>
    </FormularioDialogo>
  );
}
