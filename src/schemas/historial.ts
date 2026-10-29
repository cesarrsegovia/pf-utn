import { TIPOS_PROCEDIMIENTO } from "@/lib/constantes";
import { esquemaListado, fechaValida, z } from "./comun";

/** Consulta del historial clínico (F8): animal, tipo y rango de fechas del procedimiento. */
export const esquemaListadoHistorial = esquemaListado.extend({
  animal_id: z.coerce.number().int().positive().optional(),
  tipo: z.enum(TIPOS_PROCEDIMIENTO).optional(),
  desde: fechaValida.optional(),
  hasta: fechaValida.optional(),
});
export type ParametrosListadoHistorial = z.infer<typeof esquemaListadoHistorial>;
