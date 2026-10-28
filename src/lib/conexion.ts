import pg from "pg";
import { Sequelize } from "sequelize";

/**
 * Devuelve la cadena de conexión según el entorno:
 * los tests (NODE_ENV=test) usan una base separada para no alterar los datos de desarrollo.
 */
function urlBaseDeDatos(): string {
  const url = process.env.NODE_ENV === "test" ? process.env.DATABASE_URL_TEST : process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Falta configurar DATABASE_URL (o DATABASE_URL_TEST para tests) en el archivo .env");
  }
  return url;
}

/**
 * En desarrollo Next.js recarga los módulos en caliente; guardar la instancia en
 * `globalThis` evita abrir un pool de conexiones nuevo en cada recarga.
 */
const almacenGlobal = globalThis as unknown as { sequelize?: Sequelize };

export const sequelize =
  almacenGlobal.sequelize ??
  new Sequelize(urlBaseDeDatos(), {
    dialect: "postgres",
    // Se pasa el driver explícitamente para que funcione dentro del bundle de Next.js.
    dialectModule: pg,
    logging: false,
    define: {
      // El ERD no incluye columnas createdAt/updatedAt y los nombres de tabla son singulares.
      timestamps: false,
      freezeTableName: true,
    },
  });

if (process.env.NODE_ENV !== "production") {
  almacenGlobal.sequelize = sequelize;
}
