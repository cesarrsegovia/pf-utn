import {
  Op, type Attributes, type FindOptions, type Model, type ModelStatic, type Transaction, type WhereOptions,
} from "sequelize";
import { NoEncontradoError, ValidacionError } from "@/lib/errores";
import { instanteLocal, sumarDias } from "@/lib/fechas";
import { escaparLike } from "@/lib/texto";
import type { FiltroEstado } from "@/schemas/comun";

/**
 * Resultado de una baja: física ("eliminado") o lógica ("desactivado") cuando el registro
 * tiene historial asociado. `turnosCancelados` informa la cascada de la baja de un vecino.
 */
export interface ResultadoBaja {
  resultado: "eliminado" | "desactivado";
  turnosCancelados?: number;
}

/** Convierte la cadena vacía de un campo opcional del formulario en NULL para la base. */
export function nuloSiVacio(valor: string): string | null {
  const limpio = valor.trim();
  return limpio === "" ? null : limpio;
}

/** Condición del filtro de estado (activos, inactivos o todos) sobre la columna `activo`. */
export function condicionEstado(estado: FiltroEstado): WhereOptions {
  if (estado === "todos") return {};
  return { activo: estado === "activos" };
}

/** Opciones `limit` y `offset` de Sequelize para la página solicitada. */
export function paginacion({ pagina, tamanio }: { pagina: number; tamanio: number }) {
  return { limit: tamanio, offset: (pagina - 1) * tamanio };
}

/** Busca un registro por id o lanza 404 con el mensaje indicado. */
export async function buscarPorId<M extends Model>(
  modelo: ModelStatic<M>,
  id: number,
  mensaje: string,
  opciones: Omit<FindOptions<Attributes<M>>, "where"> = {},
): Promise<M> {
  const registro = await modelo.findByPk(id, opciones);
  if (!registro) throw new NoEncontradoError(mensaje);
  return registro;
}

/**
 * Verifica que exista el registro referenciado por un campo del formulario (ej.: la zona
 * de un vecino). Si no existe, lanza un error de validación asociado a ese campo.
 */
export async function exigirReferencia<M extends Model>(
  modelo: ModelStatic<M>,
  id: number,
  campo: string,
  mensaje: string,
  transaction?: Transaction,
): Promise<M> {
  const registro = await modelo.findByPk(id, { transaction });
  if (!registro) throw new ValidacionError("Revise los datos ingresados", { [campo]: mensaje });
  return registro;
}

/**
 * Verifica que ningún otro registro tenga el mismo valor en un campo único.
 * Lanza un error de validación asociado al campo, para mostrarlo junto al input.
 */
export async function exigirValorUnico(
  modelo: ModelStatic<Model>,
  campo: string,
  valor: string | number,
  mensaje: string,
  opciones: { excluirId?: number; sinMayusculas?: boolean; transaction?: Transaction } = {},
): Promise<void> {
  const where: WhereOptions = {
    [campo]: opciones.sinMayusculas ? { [Op.iLike]: escaparLike(String(valor)) } : valor,
    ...(opciones.excluirId ? { id: { [Op.ne]: opciones.excluirId } } : {}),
  };
  const repetidos = await modelo.count({ where, transaction: opciones.transaction });
  if (repetidos > 0) {
    throw new ValidacionError("Revise los datos ingresados", { [campo]: mensaje });
  }
}

/**
 * Texto legible a partir de conteos de registros asociados, omitiendo los ceros.
 * Ej.: [[3, "vecino", "vecinos"], [1, "operativo", "operativos"]] → "3 vecinos y 1 operativo".
 */
export function enumerarAsociados(conteos: Array<[cantidad: number, singular: string, plural: string]>): string {
  const partes = conteos
    .filter(([cantidad]) => cantidad > 0)
    .map(([cantidad, singular, plural]) => `${cantidad} ${cantidad === 1 ? singular : plural}`);
  if (partes.length <= 1) return partes.join("");
  return `${partes.slice(0, -1).join(", ")} y ${partes.at(-1)}`;
}

/**
 * Condición sobre una columna de fecha y hora para un rango de días locales completos de
 * Río Grande: desde las 00:00 de `desde` hasta antes de las 00:00 del día siguiente a `hasta`.
 * Ambos extremos son opcionales; sin ninguno, no filtra.
 */
export function condicionDiasLocales(columna: string, desde?: string, hasta?: string): WhereOptions {
  return {
    [Op.and]: [
      desde ? { [columna]: { [Op.gte]: instanteLocal(desde, "00:00") } } : {},
      hasta ? { [columna]: { [Op.lt]: instanteLocal(sumarDias(hasta, 1), "00:00") } } : {},
    ],
  };
}
