import { TIPOS_PERSONAL } from "@/lib/constantes";
import { esquemaListado, filtroEstado, textoOpcional, textoRequerido, z } from "./comun";

/**
 * Alta y edición de personal actuante (F5). Los nombres de campo coinciden con las
 * columnas de la tabla `veterinario`, así los errores de unicidad se asocian al input.
 */
export const esquemaPersonal = z
  .object({
    tipo: z.enum(TIPOS_PERSONAL, "Seleccione un tipo"),
    nombre: textoRequerido(60),
    apellido: textoRequerido(60),
    matricula: textoOpcional(20),
    especialidad: textoOpcional(60),
    telefono: textoOpcional(20),
    activo: z.boolean(),
    usuario_id: z.number().int().positive().nullable(),
  })
  .refine((datos) => datos.tipo === "auxiliar" || datos.matricula !== "", {
    path: ["matricula"],
    message: "La matrícula es obligatoria para veterinarios",
  });
export type DatosPersonal = z.infer<typeof esquemaPersonal>;

/** Listado de personal: texto, tipo (opcional) y estado. */
export const esquemaListadoPersonal = esquemaListado.extend({
  tipo: z.enum(TIPOS_PERSONAL).optional(),
  estado: filtroEstado,
});
export type ParametrosListadoPersonal = z.infer<typeof esquemaListadoPersonal>;

/** Opciones de usuarios vinculables; `personalId` es el registro en edición (conserva su vínculo). */
export const esquemaOpcionesUsuarios = z.object({
  personalId: z.coerce.number().int().positive().optional(),
});
