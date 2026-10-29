"use client";

import { useState } from "react";
import { RotateCcw, Send } from "lucide-react";
import { toast } from "sonner";
import { AccionesFila } from "@/components/comunes/acciones-fila";
import { BadgeEnvio } from "@/components/comunes/badges-dominio";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FiltroSelect } from "@/components/comunes/filtro-select";
import { ListadoPaginado } from "@/components/comunes/listado-paginado";
import type { Columna } from "@/components/comunes/tabla-datos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useListado } from "@/hooks/use-listado";
import { llamarApi } from "@/lib/cliente-api";
import { ETIQUETAS_ESTADO_ENVIO, ETIQUETAS_TIPO_NOTIFICACION, opcionesDeEtiquetas } from "@/lib/etiquetas";
import { formatearFechaHora } from "@/lib/fechas";
import { mensajeDeError } from "@/lib/formularios";
import type { NotificacionDto, ResultadoProcesamiento } from "@/services/notificaciones";

/** Pantalla de F12: notificaciones por correo con filtros, envío a demanda y reintento de fallidas. */
export function GestionNotificaciones({ puedeGestionar }: { puedeGestionar: boolean }) {
  const listado = useListado<NotificacionDto>("/api/notificaciones", { tipo: "", estado: "", desde: "", hasta: "" });
  const [procesando, setProcesando] = useState(false);

  /** Envía ahora las notificaciones pendientes vencidas (además del envío automático cada minuto). */
  async function procesar() {
    setProcesando(true);
    try {
      const { enviadas, fallidas } = await llamarApi<ResultadoProcesamiento>("/api/notificaciones/procesar", {
        metodo: "POST",
      });
      toast.success(`Enviadas: ${enviadas} · Fallidas: ${fallidas}`);
      await listado.recargar();
    } catch (error) {
      toast.error(mensajeDeError(error, "No se pudieron procesar las notificaciones"));
    } finally {
      setProcesando(false);
    }
  }

  async function reintentar(notificacion: NotificacionDto) {
    try {
      await llamarApi(`/api/notificaciones/${notificacion.id}/reintentar`, { metodo: "POST" });
      toast.success("La notificación volvió a la cola de envío");
      await listado.recargar();
    } catch (error) {
      toast.error(mensajeDeError(error, "No se pudo reintentar la notificación"));
    }
  }

  const columnas: Columna<NotificacionDto>[] = [
    { titulo: "Programada", celda: (n) => formatearFechaHora(n.fecha_programada) },
    { titulo: "Tipo", celda: (n) => ETIQUETAS_TIPO_NOTIFICACION[n.tipo] },
    {
      titulo: "Vecino",
      celda: (n) => (
        <div>
          <div>{n.vecino}</div>
          <div className="text-xs text-muted-foreground">{n.email ?? "Sin email"}</div>
        </div>
      ),
    },
    {
      titulo: "Mensaje",
      celda: (n) => (
        <span className="line-clamp-2 max-w-xs text-xs whitespace-normal" title={n.mensaje}>{n.mensaje}</span>
      ),
    },
    { titulo: "Estado", celda: (n) => <BadgeEnvio estado={n.estado_envio} /> },
    { titulo: "Enviada", celda: (n) => (n.fecha_envio ? formatearFechaHora(n.fecha_envio) : "—") },
    ...(puedeGestionar
      ? [{
          titulo: "Acciones",
          className: "w-20 text-right",
          celda: (n: NotificacionDto) =>
            n.estado_envio === "fallido" && (
              <AccionesFila>
                <Button variant="ghost" size="icon-sm" aria-label="Reintentar" title="Reintentar" onClick={() => reintentar(n)}>
                  <RotateCcw />
                </Button>
              </AccionesFila>
            ),
        }]
      : []),
  ];

  return (
    <>
      <EncabezadoPagina
        titulo="Notificaciones"
        descripcion="Correos a los vecinos sobre sus turnos. Las pendientes se envían automáticamente cada minuto."
        acciones={
          puedeGestionar && (
            <Button onClick={procesar} disabled={procesando}>
              <Send /> {procesando ? "Procesando…" : "Procesar pendientes"}
            </Button>
          )
        }
      />
      <ListadoPaginado
        listado={listado}
        columnas={columnas}
        claveFila={(n) => n.id}
        placeholderBusqueda="Buscar por vecino o email"
        mensajeVacio="No hay notificaciones para mostrar"
        filtros={
          <>
            <FiltroSelect
              etiqueta="Tipo"
              valor={listado.filtros.tipo}
              opciones={opcionesDeEtiquetas(ETIQUETAS_TIPO_NOTIFICACION)}
              etiquetaTodos="Todos los tipos"
              onCambiar={(valor) => listado.filtrar("tipo", valor)}
            />
            <FiltroSelect
              etiqueta="Estado"
              valor={listado.filtros.estado}
              opciones={opcionesDeEtiquetas(ETIQUETAS_ESTADO_ENVIO)}
              etiquetaTodos="Todos los estados"
              onCambiar={(valor) => listado.filtrar("estado", valor)}
            />
            <Input
              type="date"
              aria-label="Desde"
              title="Programadas desde"
              className="w-auto"
              value={listado.filtros.desde}
              onChange={(evento) => listado.filtrar("desde", evento.target.value)}
            />
            <Input
              type="date"
              aria-label="Hasta"
              title="Programadas hasta"
              className="w-auto"
              value={listado.filtros.hasta}
              onChange={(evento) => listado.filtrar("hasta", evento.target.value)}
            />
          </>
        }
      />
    </>
  );
}
