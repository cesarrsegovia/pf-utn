import { z } from "./comun";

/** Datos del formulario de inicio de sesión. */
export const esquemaLogin = z.object({
  email: z.email("Ingrese un email válido"),
  password: z.string().min(1, "Ingrese la contraseña"),
});
export type DatosLogin = z.infer<typeof esquemaLogin>;
