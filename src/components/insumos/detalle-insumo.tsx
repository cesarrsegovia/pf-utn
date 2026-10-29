"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ArrowLeft, ArrowLeftRight } from "lucide-react";
import { BadgeEstado } from "@/components/comunes/badge-estado";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { ListadoPaginado } from "@/components/comunes/listado-paginado";
import type { Columna } from "@/components/comunes/tabla-datos";
import { Button, buttonVariants } from "@/components/ui/button";
import { useListado } from "@/hooks/use-listado";
import { formatearCantidad } from "@/lib/cantidades";
import { obtenerJson } from "@/lib/cliente-api";
import { ETIQUETAS_TIPO_MOVIMIENTO } from "@/lib/etiquetas";
import { formatearFechaHora } from "@/lib/fechas";
import type { InsumoDto, MovimientoDto } from "@/services/insumos";
import { FormularioMovimiento } from "./formulario-movimiento";
import { BadgeStock } from "./gestion-insumos";

/** Detalle de un insumo (F6): stock, alerta y movimientos, con registro de ingresos y egresos. */
export function DetalleInsumo({ id, puedeGestionar }: { id: number; puedeGestionar: boolean }) {
  const { data: insumo, error, mutate } = useSWR<InsumoDto>(`/api/insumos/${id}`, obtenerJson);
  const movimientos = useListado<MovimientoDto>(`/api/insumos/${id}/movimientos`);
  const [registrando, setRegistrando] = useState(false);

  const volver = (
    <Link href="/insumos" className={buttonVariants({ variant: "outline" })}>
      <ArrowLeft /> Volver
    </Link>
  );
  if (error) return <EncabezadoPagina titulo="Insumo no encontrado" descripcion={error.message} acciones={volver} />;
  if (!insumo) return <p className="text-sm text-muted-foreground">Cargando…</p>;

  const columnas: Columna<MovimientoDto>[] = [
    { titulo: "Fecha", celda: (m) => formatearFechaHora(m.fecha) },
    {
      titulo: "Tipo",
      celda: (m) => <BadgeEstado texto={ETIQUETAS_TIPO_MOVIMIENTO[m.tipo]} tono={m.tipo === "ingreso" ? "exito" : "alerta"} />,
    },
    { titulo: "Cantidad", celda: (m) => formatearCantidad(m.cantidad, insumo.unidad) },
    { titulo: "Motivo", celda: (m) => m.motivo ?? "—" },
    { titulo: "Origen", celda: (m) => (m.procedimiento_id ? `Procedimiento #${m.procedimiento_id}` : "Manual") },
    { titulo: "Registró", celda: (m) => m.usuario },
  ];

  return (
    <>
      <EncabezadoPagina
        titulo={insumo.nombre}
        descripcion={`Stock actual: ${formatearCantidad(insumo.stock_actual, insumo.unidad)} · Mínimo: ${formatearCantidad(insumo.stock_minimo, insumo.unidad)}`}
        acciones={
          <>
            {volver}
            {puedeGestionar && (
              <Button onClick={() => setRegistrando(true)}><ArrowLeftRight /> Registrar movimiento</Button>
            )}
          </>
        }
      />
      <div className="mb-4"><BadgeStock insumo={insumo} /></div>
      <ListadoPaginado
        listado={movimientos}
        columnas={columnas}
        claveFila={(m) => m.id}
        mensajeVacio="El insumo no tiene movimientos registrados"
      />

      {registrando && (
        <FormularioMovimiento
          insumo={insumo}
          onCerrar={() => setRegistrando(false)}
          onGuardado={async () => {
            setRegistrando(false);
            await Promise.all([mutate(), movimientos.recargar()]);
          }}
        />
      )}
    </>
  );
}
