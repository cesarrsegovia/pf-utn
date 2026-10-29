import { esquemaListado, filtroEstado, textoRequerido, z } from "./comun";

/** Alta y edición de vecinos (F1). La baja y la reactivación tienen sus propias rutas. */
export const esquemaVecino = z.object({
  nombre: textoRequerido(60),
  apellido: textoRequerido(60),
  dni: z.string().trim().regex(/^\d{7,8}$/, "Ingrese 7 u 8 dígitos, sin puntos"),
  telefono: textoRequerido(20),
  // Opcional: vacío o un email válido.
  email: z
    .string()
    .trim()
    .max(120, "Máximo 120 caracteres")
    .refine((valor) => valor === "" || z.email().safeParse(valor).success, "Ingrese un email válido"),
  direccion: textoRequerido(150),
  zona_id: z.number("Seleccione una zona").int().positive("Seleccione una zona"),
});
export type DatosVecino = z.infer<typeof esquemaVecino>;

/** Listado de vecinos: texto, estado y zona (opcional). */
export const esquemaListadoVecinos = esquemaListado.extend({
  estado: filtroEstado,
  zona_id: z.coerce.number().int().positive().optional(),
});
export type ParametrosListadoVecinos = z.infer<typeof esquemaListadoVecinos>;

/** Opciones de tutores: vecinos activos y, si se indica, el tutor actual aunque esté inactivo. */
export const esquemaOpcionesVecinos = z.object({
  incluirId: z.coerce.number().int().positive().optional(),
});
