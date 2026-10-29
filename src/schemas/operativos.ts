import { ESTADOS_OPERATIVO } from "@/lib/constantes";
import { esquemaListado, fechaValida, horaValida, idSeleccionado, textoRequerido, z } from "./comun";

/** Alta y edición de operativos (F4). Las horas HH:MM se comparan como texto. */
export const esquemaOperativo = z
  .object({
    fecha: fechaValida,
    hora_inicio: horaValida,
    hora_fin: horaValida,
    lugar: textoRequerido(150),
    cupo_maximo: z
      .number("Ingrese un número")
      .int("Ingrese un número entero")
      .min(1, "Debe ser mayor a 0")
      .max(500, "Máximo 500 turnos"),
    zona_id: idSeleccionado("Seleccione una zona"),
  })
  .refine((datos) => datos.hora_fin > datos.hora_inicio, {
    path: ["hora_fin"],
    message: "Debe ser posterior a la hora de inicio",
  });
export type DatosOperativo = z.infer<typeof esquemaOperativo>;

/** Listado de operativos: período (próximos por defecto), estado y zona opcionales. */
export const esquemaListadoOperativos = esquemaListado.extend({
  periodo: z.enum(["proximos", "pasados", "todos"]).default("proximos"),
  estado: z.enum(ESTADOS_OPERATIVO).optional(),
  zona_id: z.coerce.number().int().positive().optional(),
});
export type ParametrosListadoOperativos = z.infer<typeof esquemaListadoOperativos>;

/** Asignación o retiro de un integrante del personal. */
export const esquemaPersonalOperativo = z.object({
  veterinario_id: idSeleccionado("Seleccione un integrante del personal"),
});
export type DatosPersonalOperativo = z.infer<typeof esquemaPersonalOperativo>;

/** Cancelación (solo administrador): motivo obligatorio y casilla de fuerza mayor. */
export const esquemaCancelarOperativo = z.object({
  motivo: textoRequerido(255),
  fuerza_mayor: z.boolean(),
});
export type DatosCancelarOperativo = z.infer<typeof esquemaCancelarOperativo>;

/** Cambio de estado manual: iniciar (en curso) o finalizar (realizado). */
export const esquemaEstadoOperativo = z.object({
  estado: z.enum(["en_curso", "realizado"], "Estado no válido"),
});
export type DatosEstadoOperativo = z.infer<typeof esquemaEstadoOperativo>;
