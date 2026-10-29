import { fechaValida, z } from "./comun";

/** Filtros de los reportes estadísticos (F13): zona (o todas) y rango de fechas obligatorio. */
export const esquemaFiltrosReportes = z
  .object({
    zona_id: z.coerce.number().int().positive().optional(),
    desde: fechaValida,
    hasta: fechaValida,
  })
  .refine((filtros) => filtros.desde <= filtros.hasta, {
    path: ["hasta"],
    message: "Debe ser igual o posterior a la fecha desde",
  });
export type FiltrosReportes = z.infer<typeof esquemaFiltrosReportes>;
