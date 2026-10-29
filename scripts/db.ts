/**
 * CLI de base de datos.
 *   npm run db:migrar        aplica las migraciones pendientes
 *   npm run db:seed          carga los datos iniciales (idempotente)
 *   npm run db:reset         borra todo, migra y siembra
 *   npm run db:reset:test    igual que reset, pero sobre la base de test
 *   npm run db:demo          borra todo, migra, siembra y carga los datos de demostración
 *   npm run db:demo:test     igual que demo, pero sobre la base de test (prueba de humo de la Fase 6)
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
  const { sembrarDatosDemo } = await import("../db/seeders/demo");
  const migrador = crearMigrador(sequelize);

  /** Elimina el esquema completo (tablas, índices y registro de migraciones), lo recrea y siembra los datos iniciales. */
  async function reiniciarBase(): Promise<number> {
    await sequelize.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    const aplicadas = await migrador.up();
    await sembrarDatosIniciales();
    return aplicadas.length;
  }

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
        const aplicadas = await reiniciarBase();
        console.log(`Base reiniciada: ${aplicadas} migraciones aplicadas y datos iniciales cargados`);
        break;
      }
      case "demo": {
        const aplicadas = await reiniciarBase();
        await sembrarDatosDemo();
        console.log(`Base reiniciada con datos de demostración (${aplicadas} migraciones aplicadas)`);
        break;
      }
      default:
        console.error("Comando desconocido. Usar: migrar | seed | reset | demo [--test]");
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
