import { incluyeChipeo, TIPOS_PROCEDIMIENTO } from "@/lib/constantes";
import { cantidadPositiva, idSeleccionado, textoOpcional, z } from "./comun";

/** Insumo usado en un procedimiento y su cantidad. */
export const esquemaInsumoUsado = z.object({
  insumo_id: idSeleccionado("Seleccione un insumo"),
  cantidad: cantidadPositiva,
});

/**
 * Registro de procedimiento (F7). El chip es obligatorio si el tipo incluye chipeo
 * (15 dígitos, ISO 11784/11785) y los insumos no se repiten.
 */
export const esquemaProcedimiento = z
  .object({
    turno_id: idSeleccionado("Seleccione un turno"),
    tipo: z.enum(TIPOS_PROCEDIMIENTO, "Seleccione el procedimiento realizado"),
    numero_chip_colocado: z
      .string()
      .trim()
      .refine((valor) => valor === "" || /^\d{15}$/.test(valor), "El chip debe tener 15 dígitos"),
    observaciones: textoOpcional(1000),
    insumos: z.array(esquemaInsumoUsado).max(20, "Máximo 20 insumos"),
  })
  .refine((datos) => !incluyeChipeo(datos.tipo) || datos.numero_chip_colocado !== "", {
    path: ["numero_chip_colocado"],
    message: "Ingrese el número de chip colocado",
  })
  .refine((datos) => new Set(datos.insumos.map((uso) => uso.insumo_id)).size === datos.insumos.length, {
    path: ["insumos"],
    message: "No repita insumos: sume las cantidades en una sola fila",
  });
export type DatosProcedimiento = z.infer<typeof esquemaProcedimiento>;
