"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { SelectOpciones } from "@/components/comunes/select-opciones";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { llamarApi } from "@/lib/cliente-api";
import { ETIQUETAS_TIPO_PERSONAL } from "@/lib/etiquetas";
import { mensajeDeError } from "@/lib/formularios";
import type { OperativoDetalleDto } from "@/services/operativos";

/** Personal asignado a un operativo, con alta y retiro (F4). */
export function PersonalOperativo({ operativo, puedeGestionar, onCambio }: {
  operativo: OperativoDetalleDto;
  puedeGestionar: boolean;
  onCambio: () => Promise<unknown>;
}) {
  const [seleccionado, setSeleccionado] = useState<number | null>(null);
  const [procesando, setProcesando] = useState(false);

  /** Asigna (POST) o quita (DELETE) a un integrante y refresca el detalle. */
  async function modificar(metodo: "POST" | "DELETE", veterinarioId: number) {
    setProcesando(true);
    try {
      await llamarApi(`/api/operativos/${operativo.id}/personal`, { metodo, cuerpo: { veterinario_id: veterinarioId } });
      toast.success(metodo === "POST" ? "Personal asignado" : "Personal quitado");
      setSeleccionado(null);
      await onCambio();
    } catch (error) {
      toast.error(mensajeDeError(error, "No se pudo modificar el personal"));
    } finally {
      setProcesando(false);
    }
  }

  return (
    <section className="rounded-lg border p-4">
      <h2 className="mb-3 text-lg font-semibold">Personal asignado</h2>
      {operativo.personal.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin personal asignado.</p>
      ) : (
        <ul className="grid gap-2">
          {operativo.personal.map((persona) => (
            <li key={persona.id} className="flex items-center justify-between gap-2 text-sm">
              <span>
                {persona.nombre}
                <span className="text-muted-foreground">
                  {" · "}{ETIQUETAS_TIPO_PERSONAL[persona.tipo]}{persona.matricula ? ` · Mat. ${persona.matricula}` : ""}
                </span>
              </span>
              {puedeGestionar && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Quitar"
                  title="Quitar"
                  disabled={procesando}
                  onClick={() => modificar("DELETE", persona.id)}
                >
                  <X />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {puedeGestionar && (
        <div className="mt-4 flex gap-2">
          <Label htmlFor="veterinario_id" className="sr-only">Personal a asignar</Label>
          <SelectOpciones
            id="veterinario_id"
            url="/api/personal/opciones"
            valor={seleccionado}
            onCambiar={setSeleccionado}
            placeholder="Agregar personal…"
          />
          <Button
            disabled={seleccionado === null || procesando}
            onClick={() => seleccionado !== null && modificar("POST", seleccionado)}
          >
            <Plus /> Asignar
          </Button>
        </div>
      )}
    </section>
  );
}
