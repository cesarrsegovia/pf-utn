import type { Sequelize } from "sequelize";
import { SequelizeStorage, Umzug } from "umzug";
import { migraciones } from "./migrations";

/**
 * Crea el migrador de Umzug. Las migraciones aplicadas se registran en la tabla
 * `migraciones_aplicadas`, de modo que cada una se ejecuta una sola vez.
 */
export function crearMigrador(sequelize: Sequelize) {
  return new Umzug({
    migrations: migraciones.map((migracion) => ({
      name: migracion.nombre,
      up: () => migracion.up(sequelize),
      down: () => migracion.down(sequelize),
    })),
    storage: new SequelizeStorage({ sequelize, tableName: "migraciones_aplicadas" }),
    logger: undefined,
  });
}
