"use client";

import { useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AreaTexto } from "@/components/comunes/area-texto";
import { CampoFormulario } from "@/components/comunes/campo-formulario";
import { ConfirmarDialogo } from "@/components/comunes/confirmar-dialogo";
import { FormularioDialogo } from "@/components/comunes/formulario-dialogo";
import { SelectOpciones } from "@/components/comunes/select-opciones";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { llamarApi } from "@/lib/cliente-api";
import { incluyeChipeo, TIPOS_PROCEDIMIENTO, tipoIncluido } from "@/lib/constantes";
import { ETIQUETAS_TIPO_PROCEDIMIENTO } from "@/lib/etiquetas";
import { mostrarErrorFormulario } from "@/lib/formularios";
import { esquemaProcedimiento, type DatosProcedimiento } from "@/schemas/procedimientos";
import type { TurnoDto } from "@/services/turnos";

/**
 * Registro de procedimiento (F7). Solo ofrece los tipos incluidos en lo solicitado, pide el
 * chip si corresponde y una lista de insumos usados. Antes de enviar pide confirmación,
 * porque la operación no se puede deshacer.
 */
export function FormularioProcedimiento({ turno, onCerrar, onGuardado }: {
  turno: TurnoDto;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const { register, control, handleSubmit, setError, formState } = useForm<DatosProcedimiento>({
    resolver: zodResolver(esquemaProcedimiento),
    defaultValues: {
      turno_id: turno.id,
      tipo: turno.tipo_solicitado,
      numero_chip_colocado: "",
      observaciones: "",
      insumos: [],
    },
  });
  const insumos = useFieldArray({ control, name: "insumos" });
  const tipo = useWatch({ control, name: "tipo" });
  const [porConfirmar, setPorConfirmar] = useState<DatosProcedimiento | null>(null);

  /** Envía los datos ya validados y confirmados. */
  async function registrar() {
    if (!porConfirmar) return;
    try {
      await llamarApi("/api/procedimientos", { metodo: "POST", cuerpo: porConfirmar });
      toast.success("Procedimiento registrado: el turno quedó completado");
      setPorConfirmar(null);
      onGuardado();
    } catch (error) {
      setPorConfirmar(null);
      mostrarErrorFormulario(error, setError, "No se pudo registrar el procedimiento");
    }
  }

  const tiposPermitidos = TIPOS_PROCEDIMIENTO.filter((valor) => tipoIncluido(valor, turno.tipo_solicitado));
  const errores = formState.errors;
  return (
    <>
      <FormularioDialogo
        titulo={`Procedimiento de ${turno.animal}`}
        descripcion={`Solicitado: ${ETIQUETAS_TIPO_PROCEDIMIENTO[turno.tipo_solicitado]} · ${turno.horario} · ${turno.lugar}`}
        idFormulario="formulario-procedimiento"
        enviando={porConfirmar !== null}
        textoEnviar="Registrar"
        amplio
        onCerrar={onCerrar}
      >
        <form
          id="formulario-procedimiento"
          onSubmit={handleSubmit((datos) => setPorConfirmar(datos))}
          className="grid gap-4"
          noValidate
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoFormulario id="tipo" etiqueta="Procedimiento realizado" error={errores.tipo?.message}>
              <NativeSelect id="tipo" className="w-full" {...register("tipo")}>
                {tiposPermitidos.map((valor) => (
                  <NativeSelectOption key={valor} value={valor}>{ETIQUETAS_TIPO_PROCEDIMIENTO[valor]}</NativeSelectOption>
                ))}
              </NativeSelect>
            </CampoFormulario>
            {incluyeChipeo(tipo) && (
              <CampoFormulario id="numero_chip_colocado" etiqueta="Chip colocado (15 dígitos)" error={errores.numero_chip_colocado?.message}>
                <Input id="numero_chip_colocado" inputMode="numeric" {...register("numero_chip_colocado")} />
              </CampoFormulario>
            )}
          </div>

          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">Insumos usados</legend>
            {insumos.fields.length === 0 && (
              <p className="text-sm text-muted-foreground">Sin insumos. Agregue los que se usaron.</p>
            )}
            {insumos.fields.map((campo, indice) => (
              <div key={campo.id} className="grid grid-cols-[minmax(0,1fr)_8rem_auto] items-start gap-2">
                <div className="grid gap-1">
                  <Controller
                    control={control}
                    name={`insumos.${indice}.insumo_id`}
                    render={({ field }) => (
                      <SelectOpciones
                        id={`insumo-${indice}`}
                        url="/api/insumos/opciones"
                        valor={field.value}
                        onCambiar={field.onChange}
                        placeholder="Insumo…"
                        invalido={!!errores.insumos?.[indice]?.insumo_id}
                      />
                    )}
                  />
                  {errores.insumos?.[indice]?.insumo_id && (
                    <p className="text-sm text-destructive" role="alert">{errores.insumos[indice]?.insumo_id?.message}</p>
                  )}
                </div>
                <div className="grid gap-1">
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    aria-label="Cantidad"
                    placeholder="Cantidad"
                    {...register(`insumos.${indice}.cantidad`, { valueAsNumber: true })}
                  />
                  {errores.insumos?.[indice]?.cantidad && (
                    <p className="text-sm text-destructive" role="alert">{errores.insumos[indice]?.cantidad?.message}</p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Quitar insumo"
                  title="Quitar insumo"
                  onClick={() => insumos.remove(indice)}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
            {(errores.insumos?.message ?? errores.insumos?.root?.message) && (
              <p className="text-sm text-destructive" role="alert">
                {errores.insumos?.message ?? errores.insumos?.root?.message}
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              className="justify-self-start"
              onClick={() => insumos.append({ insumo_id: null as unknown as number, cantidad: undefined as unknown as number })}
            >
              <Plus /> Agregar insumo
            </Button>
          </fieldset>

          <CampoFormulario id="observaciones" etiqueta="Observaciones (opcional)" error={errores.observaciones?.message}>
            <AreaTexto id="observaciones" {...register("observaciones")} />
          </CampoFormulario>
        </form>
      </FormularioDialogo>

      <ConfirmarDialogo
        abierto={porConfirmar !== null}
        titulo="Confirmar registro"
        descripcion="Se descontará el stock de los insumos, el turno quedará completado y se creará la entrada del historial clínico. Esta operación no se puede deshacer."
        textoConfirmar="Registrar"
        onConfirmar={registrar}
        onCerrar={() => setPorConfirmar(null)}
      />
    </>
  );
}
