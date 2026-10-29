import { Op, type Includeable, type Transaction } from "sequelize";
import type { EstadoAvistamiento } from "@/lib/constantes";
import { condicionBusqueda } from "@/lib/busqueda";
import { Operativo, ReporteAvistamiento, sequelize, Vecino, Zona } from "@/lib/db";
import { ReglaNegocioError, ValidacionError } from "@/lib/errores";
import { formatearFecha, instanteLocal } from "@/lib/fechas";
import type { ResultadoPaginado } from "@/schemas/comun";
import type {
  DatosAtenderAvistamiento, DatosAvistamiento, ParametrosListadoAvistamientos,
} from "@/schemas/avistamientos";
import { buscarPorId, condicionDiasLocales, exigirReferencia, nuloSiVacio, paginacion } from "./comun";

/** Representación pública de un reporte de avistamiento (F9). */
export interface AvistamientoDto {
  id: number;
  /** Fecha y hora del avistamiento en ISO 8601. */
  fecha: string;
  descripcion: string;
  cantidad_animales: number;
  direccion_referencia: string | null;
  estado: EstadoAvistamiento;
  /** Fecha y hora de la atención en ISO 8601 (null mientras está pendiente). */
  fecha_atencion: string | null;
  zona_id: number;
  zona: string;
  vecino_id: number | null;
  /** "Apellido, Nombre" del vecino que dio el aviso, o null si es anónimo. */
  vecino: string | null;
  /** "Nombre Apellido" de quien cargó el reporte. */
  usuario: string;
  operativo_id: number | null;
  /** Fecha y lugar del operativo que atendió la zona, si se indicó. */
  operativo: string | null;
}

/** Asociaciones que necesita el DTO. Vecino y operativo son opcionales (LEFT JOIN). */
const INCLUIR_DETALLE: Includeable[] = [
  { association: "zona", attributes: ["id", "nombre"] },
  { association: "vecino", attributes: ["id", "nombre", "apellido"], required: false },
  { association: "usuario", attributes: ["id", "nombre", "apellido"] },
  { association: "operativo", attributes: ["id", "fecha", "lugar"], required: false },
];

/** Convierte el modelo (con sus asociaciones) al DTO público. */
function aDto(reporte: ReporteAvistamiento): AvistamientoDto {
  return {
    id: reporte.id,
    fecha: reporte.fecha.toISOString(),
    descripcion: reporte.descripcion,
    cantidad_animales: reporte.cantidad_animales,
    direccion_referencia: reporte.direccion_referencia,
    estado: reporte.estado,
    fecha_atencion: reporte.fecha_atencion ? reporte.fecha_atencion.toISOString() : null,
    zona_id: reporte.zona_id,
    zona: reporte.zona!.nombre,
    vecino_id: reporte.vecino_id,
    vecino: reporte.vecino ? `${reporte.vecino.apellido}, ${reporte.vecino.nombre}` : null,
    usuario: `${reporte.usuario!.nombre} ${reporte.usuario!.apellido}`,
    operativo_id: reporte.operativo_id,
    operativo: reporte.operativo ? `${formatearFecha(reporte.operativo.fecha)} · ${reporte.operativo.lugar}` : null,
  };
}

/** Obtiene el DTO de un reporte (404 si no existe). */
async function obtenerDto(id: number, transaction?: Transaction): Promise<AvistamientoDto> {
  const reporte = await buscarPorId(ReporteAvistamiento, id, "El reporte de avistamiento no existe", {
    include: INCLUIR_DETALLE,
    transaction,
  });
  return aDto(reporte);
}

/** Bloquea la fila del reporte antes de modificarlo (sin include: no se combina con lock). */
function bloquearReporte(id: number, transaction: Transaction): Promise<ReporteAvistamiento> {
  return buscarPorId(ReporteAvistamiento, id, "El reporte de avistamiento no existe", {
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
}

/** Un reporte atendido queda cerrado: no se edita, elimina ni vuelve a atender (preserva los indicadores de F13). */
function exigirPendiente(reporte: ReporteAvistamiento, accion: string): void {
  if (reporte.estado !== "pendiente") {
    throw new ReglaNegocioError(`No se puede ${accion} un reporte ya atendido`);
  }
}

/**
 * Valida el formulario contra la base (zona y vecino existentes, fecha y hora no futuras)
 * y devuelve los atributos listos para guardar.
 */
async function aAtributos(datos: DatosAvistamiento, transaction: Transaction) {
  await exigirReferencia(Zona, datos.zona_id, "zona_id", "La zona seleccionada no existe", transaction);
  if (datos.vecino_id !== null) {
    await exigirReferencia(Vecino, datos.vecino_id, "vecino_id", "El vecino seleccionado no existe", transaction);
  }
  const fecha = instanteLocal(datos.fecha, datos.hora);
  if (fecha > new Date()) {
    throw new ValidacionError("Revise los datos ingresados", { fecha: "La fecha y hora no pueden ser futuras" });
  }
  return {
    fecha,
    descripcion: datos.descripcion,
    cantidad_animales: datos.cantidad_animales,
    direccion_referencia: nuloSiVacio(datos.direccion_referencia),
    zona_id: datos.zona_id,
    vecino_id: datos.vecino_id,
  };
}

/** Listado paginado (más recientes primero) con búsqueda y filtros de estado, zona y fechas. */
export async function listarAvistamientos(
  parametros: ParametrosListadoAvistamientos,
): Promise<ResultadoPaginado<AvistamientoDto>> {
  const { rows, count } = await ReporteAvistamiento.findAndCountAll({
    where: {
      [Op.and]: [
        condicionBusqueda(
          ["ReporteAvistamiento.descripcion", "ReporteAvistamiento.direccion_referencia", "zona.nombre"],
          parametros.busqueda,
        ),
        parametros.estado ? { estado: parametros.estado } : {},
        parametros.zona_id ? { zona_id: parametros.zona_id } : {},
        condicionDiasLocales("fecha", parametros.desde, parametros.hasta),
      ],
    },
    include: INCLUIR_DETALLE,
    order: [["fecha", "DESC"], ["id", "DESC"]],
    ...paginacion(parametros),
  });
  return { filas: rows.map(aDto), total: count, pagina: parametros.pagina, tamanio: parametros.tamanio };
}

/** Obtiene un reporte por id (404 si no existe). */
export function obtenerAvistamiento(id: number): Promise<AvistamientoDto> {
  return obtenerDto(id);
}

/** Alta de un reporte: lo carga el usuario en sesión y queda pendiente. */
export async function crearAvistamiento(datos: DatosAvistamiento, usuarioId: number): Promise<AvistamientoDto> {
  return sequelize.transaction(async (transaction) => {
    const atributos = await aAtributos(datos, transaction);
    const reporte = await ReporteAvistamiento.create({ ...atributos, usuario_id: usuarioId }, { transaction });
    return obtenerDto(reporte.id, transaction);
  });
}

/** Modificación de un reporte pendiente (conserva el usuario que lo cargó). */
export async function actualizarAvistamiento(id: number, datos: DatosAvistamiento): Promise<AvistamientoDto> {
  return sequelize.transaction(async (transaction) => {
    const reporte = await bloquearReporte(id, transaction);
    exigirPendiente(reporte, "editar");
    await reporte.update(await aAtributos(datos, transaction), { transaction });
    return obtenerDto(id, transaction);
  });
}

/** Baja física de un reporte pendiente (por ejemplo, cargado por error). */
export async function eliminarAvistamiento(id: number): Promise<void> {
  await sequelize.transaction(async (transaction) => {
    const reporte = await bloquearReporte(id, transaction);
    exigirPendiente(reporte, "eliminar");
    await reporte.destroy({ transaction });
  });
}

/**
 * Atención de un reporte: pendiente → atendido, con la fecha de atención actual y,
 * opcionalmente, el operativo que atendió la zona (de la misma zona y no cancelado).
 */
export async function atenderAvistamiento(id: number, datos: DatosAtenderAvistamiento): Promise<AvistamientoDto> {
  return sequelize.transaction(async (transaction) => {
    const reporte = await bloquearReporte(id, transaction);
    exigirPendiente(reporte, "atender");
    if (datos.operativo_id !== null) {
      const operativo = await exigirReferencia(
        Operativo, datos.operativo_id, "operativo_id", "El operativo seleccionado no existe", transaction,
      );
      if (operativo.zona_id !== reporte.zona_id) {
        throw new ValidacionError("Revise los datos ingresados", {
          operativo_id: "El operativo debe ser de la misma zona que el reporte",
        });
      }
      if (operativo.estado === "cancelado") {
        throw new ValidacionError("Revise los datos ingresados", {
          operativo_id: "No se puede asociar un operativo cancelado",
        });
      }
    }
    await reporte.update(
      { estado: "atendido", fecha_atencion: new Date(), operativo_id: datos.operativo_id },
      { transaction },
    );
    return obtenerDto(id, transaction);
  });
}
