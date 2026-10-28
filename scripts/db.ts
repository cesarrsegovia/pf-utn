/**
 * CLI de base de datos.
 *   npm run db:migrar        aplica las migraciones pendientes
 *   npm run db:seed          carga los datos iniciales (idempotente)
 *   npm run db:reset         borra todo, migra y siembra
 *   npm run db:reset:test    igual que reset, pero sobre la base de test
 */
import { loadEnvConfig } from "@next/env";

const [comando, ...opciones] = process.argv.slice(2);

// Con --test se apunta a DATABASE_URL_TEST (ver src/lib/conexion.ts).
if (opciones.includes("--test")) {
  Object.assign(process.env, { NODE_ENV: "test" });
}

// Carga .env con las mismas reglas que Next.js antes de crear la conexión.
loadEnvConfig(process.cwd());

async function main() {
  // Importación dinámica: la conexión debe crearse después de cargar las variables de entorno.
  const { sequelize } = await import("@/lib/db");
  const { crearMigrador } = await import("../db/migrador");
  const { sembrarDatosIniciales } = await import("../db/seeders/inicial");
  const migrador = crearMigrador(sequelize);

  try {
    switch (comando) {
      case "migrar": {
        const aplicadas = await migrador.up();
        console.log(`Migraciones aplicadas: ${aplicadas.length}`);
        break;
      }
      case "seed": {
        await sembrarDatosIniciales();
        console.log("Datos iniciales cargados");
        break;
      }
      case "reset": {
        // Elimina el esquema completo (tablas, índices y registro de migraciones) y lo recrea.
        await sequelize.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
        const aplicadas = await migrador.up();
        await sembrarDatosIniciales();
        console.log(`Base reiniciada: ${aplicadas.length} migraciones aplicadas y datos iniciales cargados`);
        break;
      }
      default:
        console.error("Comando desconocido. Usar: migrar | seed | reset [--test]");
        process.exitCode = 1;
    }
  } finally {
    await sequelize.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
