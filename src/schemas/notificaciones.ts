import { ESTADOS_ENVIO, TIPOS_NOTIFICACION } from "@/lib/constantes";
import { esquemaListado, fechaValida, z } from "./comun";

/** Listado de notificaciones (F12): texto (vecino), tipo, estado y rango de fecha programada. */
export const esquemaListadoNotificaciones = esquemaListado.extend({
  tipo: z.enum(TIPOS_NOTIFICACION).optional(),
  estado: z.enum(ESTADOS_ENVIO).optional(),
  desde: fechaValida.optional(),
  hasta: fechaValida.optional(),
});
export type ParametrosListadoNotificaciones = z.infer<typeof esquemaListadoNotificaciones>;
