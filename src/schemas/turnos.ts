import { ESTADOS_TURNO, TIPOS_PROCEDIMIENTO } from "@/lib/constantes";
import { esquemaListado, horaValida, idSeleccionado, textoRequerido, z } from "./comun";

/** Solicitud de turno (F3): animal, operativo, horario y tipo de procedimiento. */
export const esquemaSolicitarTurno = z.object({
  animal_id: idSeleccionado("Seleccione un animal"),
  operativo_id: idSeleccionado("Seleccione un operativo"),
  horario: horaValida,
  tipo_solicitado: z.enum(TIPOS_PROCEDIMIENTO, "Seleccione el tipo de procedimiento"),
});
export type DatosSolicitarTurno = z.infer<typeof esquemaSolicitarTurno>;

/** Reprogramación: nuevo operativo (puede ser el mismo) y nuevo horario. */
export const esquemaReprogramarTurno = z.object({
  operativo_id: idSeleccionado("Seleccione un operativo"),
  horario: horaValida,
});
export type DatosReprogramarTurno = z.infer<typeof esquemaReprogramarTurno>;

/** Cancelación de un turno: el motivo es obligatorio. */
export const esquemaCancelarTurno = z.object({ motivo: textoRequerido(255) });
export type DatosCancelarTurno = z.infer<typeof esquemaCancelarTurno>;

/** Listado de turnos: texto (animal o tutor), estado y operativo opcionales. */
export const esquemaListadoTurnos = esquemaListado.extend({
  estado: z.enum(ESTADOS_TURNO).optional(),
  operativo_id: z.coerce.number().int().positive().optional(),
});
export type ParametrosListadoTurnos = z.infer<typeof esquemaListadoTurnos>;
