import { Op, type WhereOptions } from "sequelize";
import { sequelize } from "./db";
import { escaparLike, normalizarTexto } from "./texto";

/**
 * Condición "contiene" sobre varias columnas, sin distinguir mayúsculas ni tildes.
 * `columnas` usa la notación calificada de Sequelize: "Vecino.apellido" para el modelo
 * principal o "vecino.dni" para un modelo incluido con ese alias.
 * Sin texto devuelve una condición vacía (no filtra).
 */
export function condicionBusqueda(columnas: string[], texto: string): WhereOptions {
  if (!texto) return {};
  const patron = `%${escaparLike(normalizarTexto(texto))}%`;
  return {
    [Op.or]: columnas.map((columna) =>
      sequelize.where(
        // La extensión unaccent no está instalada: translate() reemplaza las vocales con tilde.
        sequelize.fn("translate", sequelize.fn("lower", sequelize.col(columna)), "áéíóúü", "aeiouu"),
        { [Op.like]: patron },
      ),
    ),
  };
}
