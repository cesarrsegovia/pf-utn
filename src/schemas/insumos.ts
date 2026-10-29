import { TIPOS_MOVIMIENTO } from "@/lib/constantes";
import { cantidadNoNegativa, cantidadPositiva, esquemaListado, textoRequerido, z } from "./comun";

/** Campos comunes del alta y la edición de insumos (F6). */
const camposInsumo = {
  nombre: textoRequerido(80),
  unidad: textoRequerido(20),
  stock_minimo: cantidadNoNegativa,
};

/** Alta: el stock inicial se registra como un movimiento de ingreso. */
export const esquemaCrearInsumo = z.object({ ...camposInsumo, stock_inicial: cantidadNoNegativa });
export type DatosCrearInsumo = z.infer<typeof esquemaCrearInsumo>;

/** Edición: el stock no se modifica aquí, solo mediante movimientos. */
export const esquemaEditarInsumo = z.object(camposInsumo);
export type DatosEditarInsumo = z.infer<typeof esquemaEditarInsumo>;

/** Movimiento manual de stock: el motivo es obligatorio para la trazabilidad. */
export const esquemaMovimiento = z.object({
  tipo: z.enum(TIPOS_MOVIMIENTO, "Seleccione el tipo de movimiento"),
  cantidad: cantidadPositiva,
  motivo: textoRequerido(255),
});
export type DatosMovimiento = z.infer<typeof esquemaMovimiento>;

/** Listado de insumos: texto y filtro de stock ("bajo_minimo" = stock actual ≤ mínimo). */
export const esquemaListadoInsumos = esquemaListado.extend({
  stock: z.enum(["todos", "bajo_minimo"]).default("todos"),
});
export type ParametrosListadoInsumos = z.infer<typeof esquemaListadoInsumos>;
