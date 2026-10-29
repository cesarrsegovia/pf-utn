import { Op, type Transaction } from "sequelize";
import type { TipoMovimiento } from "@/lib/constantes";
import { condicionBusqueda } from "@/lib/busqueda";
import { aCentesimos, deCentesimos, formatearCantidad } from "@/lib/cantidades";
import { Insumo, MovimientoInsumo, ProcedimientoInsumo, sequelize } from "@/lib/db";
import { ReglaNegocioError, ValidacionError } from "@/lib/errores";
import type { Opcion, ParametrosListado, ResultadoPaginado } from "@/schemas/comun";
import type {
  DatosCrearInsumo, DatosEditarInsumo, DatosMovimiento, ParametrosListadoInsumos,
} from "@/schemas/insumos";
import { buscarPorId, enumerarAsociados, exigirValorUnico, paginacion } from "./comun";

/** Representación pública de un insumo (F6). Las cantidades viajan como texto con 2 decimales. */
export interface InsumoDto {
  id: number;
  nombre: string;
  unidad: string;
  stock_actual: string;
  stock_minimo: string;
  /** Alerta visual: stock actual en o por debajo del mínimo. */
  bajo_minimo: boolean;
}

/** Movimiento de stock tal como se muestra en el detalle del insumo. */
export interface MovimientoDto {
  id: number;
  tipo: TipoMovimiento;
  cantidad: string;
  /** Fecha y hora en ISO 8601. */
  fecha: string;
  motivo: string | null;
  /** "Nombre Apellido" de quien registró el movimiento. */
  usuario: string;
  /** Presente en los egresos generados por un procedimiento (F7). */
  procedimiento_id: number | null;
}

/** Convierte el modelo al DTO público. */
function aDto(insumo: Insumo): InsumoDto {
  return {
    id: insumo.id,
    nombre: insumo.nombre,
    unidad: insumo.unidad,
    stock_actual: deCentesimos(aCentesimos(insumo.stock_actual)),
    stock_minimo: deCentesimos(aCentesimos(insumo.stock_minimo)),
    bajo_minimo: aCentesimos(insumo.stock_actual) <= aCentesimos(insumo.stock_minimo),
  };
}

/** Listado paginado con búsqueda por nombre y filtro de stock bajo el mínimo. */
export async function listarInsumos(parametros: ParametrosListadoInsumos): Promise<ResultadoPaginado<InsumoDto>> {
  const { rows, count } = await Insumo.findAndCountAll({
    where: {
      [Op.and]: [
        condicionBusqueda(["Insumo.nombre"], parametros.busqueda),
        parametros.stock === "bajo_minimo" ? { stock_actual: { [Op.lte]: sequelize.col("stock_minimo") } } : {},
      ],
    },
    order: [["nombre", "ASC"]],
    ...paginacion(parametros),
  });
  return { filas: rows.map(aDto), total: count, pagina: parametros.pagina, tamanio: parametros.tamanio };
}

/** Insumos con stock disponible, para el formulario de procedimientos (F7). */
export async function opcionesInsumos(): Promise<Opcion[]> {
  const insumos = await Insumo.findAll({
    where: { stock_actual: { [Op.gt]: 0 } },
    order: [["nombre", "ASC"]],
  });
  return insumos.map((insumo) => ({
    id: insumo.id,
    etiqueta: `${insumo.nombre} (disponible: ${formatearCantidad(insumo.stock_actual, insumo.unidad)})`,
  }));
}

/** Obtiene un insumo por id (404 si no existe). */
export async function obtenerInsumo(id: number): Promise<InsumoDto> {
  return aDto(await buscarPorId(Insumo, id, "El insumo no existe"));
}

/**
 * Aplica un ingreso o egreso al stock de un insumo ya bloqueado (`lock`) dentro de la
 * transacción. Un egreso no puede superar el stock disponible. Se reutiliza en F7.
 */
export async function ajustarStock(
  insumo: Insumo,
  tipo: TipoMovimiento,
  cantidad: number,
  transaction: Transaction,
): Promise<void> {
  const disponible = aCentesimos(insumo.stock_actual);
  const solicitada = aCentesimos(cantidad);
  if (tipo === "egreso" && solicitada > disponible) {
    throw new ReglaNegocioError(
      `Stock insuficiente de ${insumo.nombre}: disponible ${formatearCantidad(insumo.stock_actual, insumo.unidad)}, ` +
        `requerido ${formatearCantidad(cantidad, insumo.unidad)}`,
    );
  }
  const nuevo = tipo === "ingreso" ? disponible + solicitada : disponible - solicitada;
  await insumo.update({ stock_actual: deCentesimos(nuevo) }, { transaction });
}

/**
 * Descuenta los insumos usados en un procedimiento (F7) dentro de su transacción: bloquea
 * las filas por id ascendente (orden fijo para evitar interbloqueos), verifica y descuenta
 * el stock, registra el uso (procedimiento_insumo) y un egreso con el procedimiento y el
 * usuario. Devuelve el detalle legible ("Ketamina 2,50 ml") para el historial clínico.
 */
export async function descontarPorProcedimiento(
  usos: Array<{ insumo_id: number; cantidad: number }>,
  procedimientoId: number,
  usuarioId: number,
  transaction: Transaction,
): Promise<string[]> {
  if (usos.length === 0) return [];
  const insumos = await Insumo.findAll({
    where: { id: usos.map((uso) => uso.insumo_id) },
    order: [["id", "ASC"]],
    lock: transaction.LOCK.UPDATE,
    transaction,
  });
  const porId = new Map(insumos.map((insumo) => [insumo.id, insumo]));

  const detalle: string[] = [];
  for (const uso of usos) {
    const insumo = porId.get(uso.insumo_id);
    if (!insumo) {
      throw new ValidacionError("Revise los datos ingresados", { insumos: "Uno de los insumos seleccionados no existe" });
    }
    // Lanza "Stock insuficiente de …" si el egreso supera el disponible.
    await ajustarStock(insumo, "egreso", uso.cantidad, transaction);
    const cantidad = deCentesimos(aCentesimos(uso.cantidad));
    await ProcedimientoInsumo.create(
      { procedimiento_id: procedimientoId, insumo_id: insumo.id, cantidad_usada: cantidad },
      { transaction },
    );
    await MovimientoInsumo.create(
      {
        tipo: "egreso",
        cantidad,
        motivo: `Procedimiento #${procedimientoId}`,
        insumo_id: insumo.id,
        usuario_id: usuarioId,
        procedimiento_id: procedimientoId,
      },
      { transaction },
    );
    detalle.push(`${insumo.nombre} ${formatearCantidad(cantidad, insumo.unidad)}`);
  }
  return detalle;
}

/** Alta de insumo. Si el stock inicial es mayor a 0 se registra como ingreso "Stock inicial". */
export async function crearInsumo(datos: DatosCrearInsumo, usuarioId: number): Promise<InsumoDto> {
  return sequelize.transaction(async (transaction) => {
    await exigirValorUnico(Insumo, "nombre", datos.nombre, "Ya existe un insumo con ese nombre", {
      sinMayusculas: true,
      transaction,
    });
    const insumo = await Insumo.create(
      {
        nombre: datos.nombre,
        unidad: datos.unidad,
        stock_actual: deCentesimos(aCentesimos(datos.stock_inicial)),
        stock_minimo: deCentesimos(aCentesimos(datos.stock_minimo)),
      },
      { transaction },
    );
    if (datos.stock_inicial > 0) {
      await MovimientoInsumo.create(
        {
          tipo: "ingreso",
          cantidad: deCentesimos(aCentesimos(datos.stock_inicial)),
          motivo: "Stock inicial",
          insumo_id: insumo.id,
          usuario_id: usuarioId,
        },
        { transaction },
      );
    }
    return aDto(insumo);
  });
}

/** Modificación de nombre, unidad y stock mínimo (el stock actual solo cambia por movimientos). */
export async function actualizarInsumo(id: number, datos: DatosEditarInsumo): Promise<InsumoDto> {
  return sequelize.transaction(async (transaction) => {
    const insumo = await buscarPorId(Insumo, id, "El insumo no existe", { transaction });
    await exigirValorUnico(Insumo, "nombre", datos.nombre, "Ya existe un insumo con ese nombre", {
      excluirId: id,
      sinMayusculas: true,
      transaction,
    });
    await insumo.update(
      { nombre: datos.nombre, unidad: datos.unidad, stock_minimo: deCentesimos(aCentesimos(datos.stock_minimo)) },
      { transaction },
    );
    return aDto(insumo);
  });
}

/** Baja física de insumo: no se elimina si tiene movimientos o usos en procedimientos. */
export async function eliminarInsumo(id: number): Promise<void> {
  await sequelize.transaction(async (transaction) => {
    const insumo = await buscarPorId(Insumo, id, "El insumo no existe", { transaction });
    const [movimientos, usos] = await Promise.all([
      MovimientoInsumo.count({ where: { insumo_id: id }, transaction }),
      ProcedimientoInsumo.count({ where: { insumo_id: id }, transaction }),
    ]);
    if (movimientos + usos > 0) {
      const asociados = enumerarAsociados([
        [movimientos, "movimiento de stock", "movimientos de stock"],
        [usos, "uso en procedimientos", "usos en procedimientos"],
      ]);
      throw new ReglaNegocioError(`No se puede eliminar el insumo porque tiene ${asociados} registrados`);
    }
    await insumo.destroy({ transaction });
  });
}

/**
 * Movimiento manual de ingreso o egreso. Bloquea la fila del insumo (SELECT … FOR UPDATE)
 * para que dos egresos simultáneos no puedan dejar el stock negativo.
 */
export async function registrarMovimiento(
  insumoId: number,
  datos: DatosMovimiento,
  usuarioId: number,
): Promise<InsumoDto> {
  return sequelize.transaction(async (transaction) => {
    const insumo = await buscarPorId(Insumo, insumoId, "El insumo no existe", {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    await ajustarStock(insumo, datos.tipo, datos.cantidad, transaction);
    await MovimientoInsumo.create(
      {
        tipo: datos.tipo,
        cantidad: deCentesimos(aCentesimos(datos.cantidad)),
        motivo: datos.motivo,
        insumo_id: insumoId,
        usuario_id: usuarioId,
      },
      { transaction },
    );
    return aDto(insumo);
  });
}

/** Movimientos de un insumo, del más reciente al más antiguo, paginados. */
export async function listarMovimientos(
  insumoId: number,
  parametros: ParametrosListado,
): Promise<ResultadoPaginado<MovimientoDto>> {
  await buscarPorId(Insumo, insumoId, "El insumo no existe");
  const { rows, count } = await MovimientoInsumo.findAndCountAll({
    where: { insumo_id: insumoId },
    include: [{ association: "usuario", attributes: ["id", "nombre", "apellido"] }],
    order: [["fecha", "DESC"], ["id", "DESC"]],
    ...paginacion(parametros),
  });
  return {
    filas: rows.map((movimiento) => ({
      id: movimiento.id,
      tipo: movimiento.tipo,
      cantidad: movimiento.cantidad,
      fecha: movimiento.fecha.toISOString(),
      motivo: movimiento.motivo,
      usuario: `${movimiento.usuario!.nombre} ${movimiento.usuario!.apellido}`,
      procedimiento_id: movimiento.procedimiento_id,
    })),
    total: count,
    pagina: parametros.pagina,
    tamanio: parametros.tamanio,
  };
}
