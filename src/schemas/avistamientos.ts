import { ESTADOS_AVISTAMIENTO } from "@/lib/constantes";
import { esquemaListado, fechaValida, horaValida, idSeleccionado, textoOpcional, textoRequerido, z } from "./comun";

/** Alta y edición de un reporte de avistamiento (F9). La fecha y la hora son locales de Río Grande. */
export const esquemaAvistamiento = z.object({
  fecha: fechaValida,
  hora: horaValida,
  descripcion: textoRequerido(1000),
  cantidad_animales: z
    .number("Ingrese un número")
    .int("Ingrese un número entero")
    .min(1, "Debe ser mayor a 0")
    .max(500, "Máximo 500 animales"),
  direccion_referencia: textoOpcional(150),
  zona_id: idSeleccionado("Seleccione una zona"),
  /** Vecino que dio el aviso; null = anónimo. */
  vecino_id: z.number().int().positive().nullable(),
});
export type DatosAvistamiento = z.infer<typeof esquemaAvistamiento>;

/** Atención de un reporte: operativo de la misma zona que lo atendió (opcional). */
export const esquemaAtenderAvistamiento = z.object({
  operativo_id: z.number().int().positive().nullable(),
});
export type DatosAtenderAvistamiento = z.infer<typeof esquemaAtenderAvistamiento>;

/** Listado de avistamientos: texto, estado, zona y rango de fechas (todos opcionales). */
export const esquemaListadoAvistamientos = esquemaListado.extend({
  estado: z.enum(ESTADOS_AVISTAMIENTO).optional(),
  zona_id: z.coerce.number().int().positive().optional(),
  desde: fechaValida.optional(),
  hasta: fechaValida.optional(),
});
export type ParametrosListadoAvistamientos = z.infer<typeof esquemaListadoAvistamientos>;

/** Operativos que pueden asociarse a la atención: los de la zona del reporte. */
export const esquemaOperativosZona = z.object({
  zona_id: z.coerce.number().int().positive(),
});
