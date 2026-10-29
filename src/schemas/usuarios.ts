import { ROLES } from "@/lib/constantes";
import { textoRequerido, z } from "./comun";

/** Campos comunes del alta y la edición de usuarios (F11). */
const camposUsuario = {
  nombre: textoRequerido(60),
  apellido: textoRequerido(60),
  email: z.email("Ingrese un email válido").max(120),
  rol: z.enum(ROLES, "Seleccione un rol"),
  activo: z.boolean(),
};

/** Alta: la contraseña es obligatoria (8 a 72 caracteres; 72 es el límite de bcrypt). */
export const esquemaCrearUsuario = z.object({
  ...camposUsuario,
  password: z.string().min(8, "Mínimo 8 caracteres").max(72, "Máximo 72 caracteres"),
});

/** Edición: contraseña vacía = conservar la actual. */
export const esquemaEditarUsuario = z.object({
  ...camposUsuario,
  password: z
    .string()
    .max(72, "Máximo 72 caracteres")
    .refine((valor) => valor === "" || valor.length >= 8, "Mínimo 8 caracteres"),
});

export type DatosUsuario = z.infer<typeof esquemaCrearUsuario>;
