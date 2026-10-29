import { Op } from "sequelize";
import type { TipoProcedimiento } from "@/lib/constantes";
import { condicionBusqueda } from "@/lib/busqueda";
import { HistorialClinico } from "@/lib/db";
import { nombreAnimal } from "@/lib/etiquetas";
import type { ResultadoPaginado } from "@/schemas/comun";
import type { ParametrosListadoHistorial } from "@/schemas/historial";
import { condicionDiasLocales, paginacion } from "./comun";

/** Entrada del historial clínico (F8). Animal y fecha se obtienen del procedimiento y su turno. */
export interface HistorialDto {
  id: number;
  procedimiento_id: number;
  /** Fecha y hora del procedimiento en ISO 8601. */
  fecha: string;
  tipo: TipoProcedimiento;
  descripcion: string;
  animal_id: number;
  animal: string;
  /** Chip actual del animal. */
  numero_chip: string | null;
  /** "Apellido, Nombre" de quien registró el procedimiento. */
  veterinario: string;
}

/**
 * Consulta del historial (solo lectura). Filtrado por animal se ordena cronológicamente
 * (la vida clínica del animal); sin animal, del más reciente al más antiguo.
 */
export async function listarHistorial(parametros: ParametrosListadoHistorial): Promise<ResultadoPaginado<HistorialDto>> {
  const direccion = parametros.animal_id ? "ASC" : "DESC";
  const { rows, count } = await HistorialClinico.findAndCountAll({
    // Alias de Sequelize para modelos anidados: "procedimiento->turno->animal".
    where: condicionBusqueda(
      ["procedimiento->turno->animal.nombre", "procedimiento->turno->animal.numero_chip", "procedimiento->veterinario.apellido"],
      parametros.busqueda,
    ),
    include: [
      {
        association: "procedimiento",
        required: true,
        attributes: ["id", "tipo", "fecha"],
        where: {
          [Op.and]: [
            parametros.tipo ? { tipo: parametros.tipo } : {},
            condicionDiasLocales("fecha", parametros.desde, parametros.hasta),
          ],
        },
        include: [
          { association: "veterinario", attributes: ["id", "nombre", "apellido"] },
          {
            association: "turno",
            required: true,
            attributes: ["id", "animal_id"],
            where: parametros.animal_id ? { animal_id: parametros.animal_id } : undefined,
            include: [{ association: "animal", attributes: ["id", "nombre", "numero_chip"] }],
          },
        ],
      },
    ],
    order: [["procedimiento", "fecha", direccion], ["id", direccion]],
    ...paginacion(parametros),
  });

  return {
    filas: rows.map((entrada) => {
      const procedimiento = entrada.procedimiento!;
      const animal = procedimiento.turno!.animal!;
      return {
        id: entrada.id,
        procedimiento_id: procedimiento.id,
        fecha: procedimiento.fecha.toISOString(),
        tipo: procedimiento.tipo,
        descripcion: entrada.descripcion,
        animal_id: animal.id,
        animal: nombreAnimal(animal),
        numero_chip: animal.numero_chip,
        veterinario: `${procedimiento.veterinario!.apellido}, ${procedimiento.veterinario!.nombre}`,
      };
    }),
    total: count,
    pagina: parametros.pagina,
    tamanio: parametros.tamanio,
  };
}
