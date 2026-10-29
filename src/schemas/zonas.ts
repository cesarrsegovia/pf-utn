import { textoOpcional, textoRequerido, z } from "./comun";

/** Alta y edición de zonas (F10). El listado usa `esquemaListado` (solo texto). */
export const esquemaZona = z.object({
  nombre: textoRequerido(80),
  descripcion: textoOpcional(255),
});
export type DatosZona = z.infer<typeof esquemaZona>;
