import { CONDICIONES_ANIMAL, SEXOS_ANIMAL } from "@/lib/constantes";
import { esquemaListado, textoOpcional, z } from "./comun";

/**
 * Alta y edición de animales (F2). La especie no se pide: el sistema atiende caninos.
 * Un animal con tutor exige `vecino_id`; los callejeros y asilvestrados lo ignoran.
 */
export const esquemaAnimal = z
  .object({
    nombre: textoOpcional(60),
    raza: textoOpcional(60),
    sexo: z.enum(SEXOS_ANIMAL, "Seleccione el sexo"),
    edad_estimada: z.number("Ingrese un número").int("Ingrese años enteros").min(0, "No puede ser negativa").max(30, "Máximo 30 años").nullable(),
    condicion: z.enum(CONDICIONES_ANIMAL, "Seleccione la condición"),
    vecino_id: z.number().int().positive().nullable(),
    // Microchip ISO 11784/11785: 15 dígitos. Vacío = sin chip.
    numero_chip: z.string().trim().refine((valor) => valor === "" || /^\d{15}$/.test(valor), "El chip debe tener 15 dígitos"),
    castrado: z.boolean(),
  })
  .refine((datos) => datos.condicion !== "con_tutor" || datos.vecino_id !== null, {
    path: ["vecino_id"],
    message: "Seleccione el tutor",
  });
export type DatosAnimal = z.infer<typeof esquemaAnimal>;

/** Listado de animales: texto (nombre, raza, chip o tutor) y condición (opcional). */
export const esquemaListadoAnimales = esquemaListado.extend({
  condicion: z.enum(CONDICIONES_ANIMAL).optional(),
});
export type ParametrosListadoAnimales = z.infer<typeof esquemaListadoAnimales>;
