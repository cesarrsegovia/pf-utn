# SIGCAN Fase 0 (Base) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Reglas del proyecto (`CLAUDE.md`):** NO ejecutar comandos de git (ni init, ni add, ni commit, ni push). Los "Puntos de control" son avisos al usuario. Todo el código lleva comentarios profesionales, claros y concisos en español.

**Goal:** Dejar el proyecto Next.js 16 funcionando con PostgreSQL 18 en Docker, el esquema completo de 16 tablas creado por migración (con FK, UNIQUE y CHECK), los 16 modelos Sequelize con sus asociaciones, datos iniciales y tests corriendo.

**Architecture:** Monolito Next.js (App Router). `src/lib/conexion.ts` crea la instancia única de Sequelize; `src/models/*.ts` definen un modelo por tabla; `src/lib/db.ts` declara las asociaciones y reexporta todo. El esquema se crea con una migración SQL ejecutada por Umzug desde `scripts/db.ts`. Los tests (Vitest) corren contra una base `sigcan_test` en el mismo contenedor.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn/ui (Base UI), Sequelize 6 + pg, Umzug 3, tsx, Vitest, bcryptjs, Docker Compose (postgres:18).

**Spec:** `docs/superpowers/specs/2026-10-28-sigcan-design.md` (secciones 2 y 3).

---

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `docker-compose.yml` | Contenedor PostgreSQL 18 (puerto host 5433) con volumen persistente |
| `docker/init/01-crear-base-test.sql` | Crea la base `sigcan_test` al inicializar el contenedor |
| `.env.example` / `.env` | Variables de entorno (conexión, JWT, SMTP, seed) |
| `next.config.ts` | Excluye `sequelize`/`pg` del bundle del servidor |
| `src/lib/constantes.ts` | Valores permitidos de estados y tipos (fuente única para Zod y UI) |
| `src/lib/conexion.ts` | Instancia única de Sequelize según el entorno |
| `src/models/*.ts` | 16 modelos, uno por tabla del ERD |
| `src/lib/db.ts` | Asociaciones entre modelos y reexportación (punto de entrada para servicios) |
| `db/migrations/0001-esquema-inicial.ts` | DDL completo del ERD |
| `db/migrations/index.ts` | Lista ordenada de migraciones |
| `db/migrador.ts` | Configuración de Umzug |
| `db/seeders/inicial.ts` | Roles, administrador inicial y zonas de Río Grande |
| `scripts/db.ts` | CLI: `migrar`, `seed`, `reset` (con `--test` para la base de test) |
| `vitest.config.ts`, `tests/setup/*`, `tests/helpers/bd.ts` | Infraestructura de tests |
| `tests/db/esquema.test.ts`, `tests/db/modelos.test.ts` | Verifican esquema, restricciones y asociaciones |
| `src/app/api/salud/route.ts` | Chequeo de salud: Next.js + Sequelize + PostgreSQL |
| `README.md` | Instalación y scripts |

---

### Task 1: Scaffold de Next.js 16 en la carpeta existente

La carpeta ya tiene `package.json`, `.env`, `.gitignore`, `CLAUDE.md` y `docs/`, así que `create-next-app` se ejecuta en el scratchpad y se copian los archivos generados.

**Files:**
- Create: todo el scaffold (`src/app/*`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`, `public/*`, `package.json`)
- Preserve: `CLAUDE.md`, `docs/`, `.env`

- [x] **Step 1: Generar el proyecto en el scratchpad**

```bash
SCRATCH="C:/Users/Cesar/AppData/Local/Temp/claude/D--Dev-proyecto-final-integrador/783f0bc1-1df9-4edc-a78f-496bc85ce62d/scratchpad"
cd "$SCRATCH" && npx --yes create-next-app@16 sigcan --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --skip-install --disable-git --yes
```

Expected: carpeta `$SCRATCH/sigcan` con `package.json` que incluye `"next": "16.x"`.

- [x] **Step 2: Copiar el scaffold sin pisar archivos del usuario**

```bash
cd "$SCRATCH/sigcan" && for f in $(ls -A); do
  case "$f" in
    node_modules|.git|CLAUDE.md|AGENTS.md|.gitignore) ;;   # se preservan / se descartan
    *) cp -r "$f" /d/Dev/proyecto-final-integrador/ ;;
  esac
done
```

- [x] **Step 3: Renombrar el paquete**

En `package.json`, cambiar `"name"` a `"sigcan"`.

- [x] **Step 4: Reemplazar `.gitignore`**

```gitignore
# Dependencias
/node_modules

# Next.js
/.next/
/out/
next-env.d.ts

# Producción
/build

# Variables de entorno (se versiona solo el ejemplo)
.env*
!.env.example

# Logs y varios
npm-debug.log*
*.tsbuildinfo
.DS_Store
/coverage
```

- [x] **Step 5: Instalar y verificar**

Run: `cd /d/Dev/proyecto-final-integrador && npm install && npx next --version`
Expected: imprime `Next.js v16.x`.

---

### Task 2: Dependencias, scripts y configuración de Next

**Files:**
- Modify: `package.json` (scripts)
- Modify: `next.config.ts`

- [x] **Step 1: Instalar dependencias**

```bash
npm install sequelize pg pg-hstore umzug bcryptjs zod jose
npm install -D tsx vitest @types/pg
```

- [x] **Step 2: Agregar scripts en `package.json`** (conservando `dev`, `build`, `start`, `lint` generados)

```json
"db:migrar": "tsx scripts/db.ts migrar",
"db:seed": "tsx scripts/db.ts seed",
"db:reset": "tsx scripts/db.ts reset",
"db:reset:test": "tsx scripts/db.ts reset --test",
"test": "vitest run",
"test:watch": "vitest"
```

- [x] **Step 3: Externalizar Sequelize en `next.config.ts`**

Agregar la clave dentro del objeto `nextConfig` generado (sin quitar las existentes):

```ts
  // Sequelize y pg resuelven drivers con require dinámicos que el bundler no puede
  // empaquetar: se excluyen del bundle del servidor y se cargan desde node_modules.
  serverExternalPackages: ["sequelize", "pg", "pg-hstore"],
```

---

### Task 3: PostgreSQL 18 en Docker y variables de entorno

**Files:**
- Create: `docker-compose.yml`, `docker/init/01-crear-base-test.sql`, `.env.example`
- Modify: `.env` (vacío actualmente)

- [x] **Step 1: `docker-compose.yml`**

```yaml
# Base de datos de SIGCAN para desarrollo y tests.
# Se expone en el puerto 5433 para no chocar con un PostgreSQL local en 5432.
services:
  db:
    image: postgres:18
    container_name: sigcan-db
    environment:
      POSTGRES_USER: sigcan
      POSTGRES_PASSWORD: sigcan
      POSTGRES_DB: sigcan
    ports:
      - "5433:5432"
    volumes:
      # A partir de postgres:18 el volumen se monta en /var/lib/postgresql (no en /data).
      - sigcan-datos:/var/lib/postgresql
      # Scripts que se ejecutan solo la primera vez que se crea el volumen.
      - ./docker/init:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U sigcan -d sigcan"]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  sigcan-datos:
```

- [x] **Step 2: `docker/init/01-crear-base-test.sql`**

```sql
-- Base separada para los tests automáticos: se recrea en cada corrida de `npm test`
-- sin tocar los datos de desarrollo.
CREATE DATABASE sigcan_test OWNER sigcan;
```

- [x] **Step 3: `.env.example`**

```dotenv
# Conexión a PostgreSQL (contenedor de docker-compose.yml)
DATABASE_URL=postgres://sigcan:sigcan@localhost:5433/sigcan
DATABASE_URL_TEST=postgres://sigcan:sigcan@localhost:5433/sigcan_test

# Secreto para firmar los JWT de sesión (mínimo 32 caracteres aleatorios)
JWT_SECRET=cambiar-por-un-secreto-largo-y-aleatorio

# Servidor SMTP para las notificaciones (F12)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=
SMTP_PASS=
SMTP_FROM="SIGCAN Zoonosis <no-responder@sigcan.local>"

# Secreto para invocar el procesador de notificaciones desde fuera de la app
CRON_SECRET=cambiar-por-otro-secreto

# Administrador creado por el seed inicial
SEED_ADMIN_EMAIL=admin@sigcan.local
SEED_ADMIN_PASSWORD=Admin1234
```

- [x] **Step 4: `.env` local** — mismo contenido que `.env.example`, con `JWT_SECRET` y `CRON_SECRET` generados:

Run: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` (dos veces, una por secreto).

- [x] **Step 5: Levantar y verificar**

Run: `docker compose up -d && docker compose ps`
Expected: `sigcan-db` en estado `healthy`.

Run: `docker exec sigcan-db psql -U sigcan -c "\l" | grep sigcan`
Expected: aparecen `sigcan` y `sigcan_test`.

---

### Task 4: Constantes del dominio y conexión

**Files:**
- Create: `src/lib/constantes.ts`, `src/lib/conexion.ts`

- [x] **Step 1: `src/lib/constantes.ts`**

```ts
/**
 * Valores permitidos de los campos de tipo y estado del modelo de datos.
 * Es la fuente única que usan los esquemas de validación y la interfaz;
 * la base de datos los refuerza con restricciones CHECK (ver migración 0001).
 */

export const ROLES = ["administrador", "operador", "veterinario"] as const;
export type NombreRol = (typeof ROLES)[number];

export const SEXOS_ANIMAL = ["M", "H"] as const;
export type SexoAnimal = (typeof SEXOS_ANIMAL)[number];

export const CONDICIONES_ANIMAL = ["con_tutor", "callejero", "asilvestrado"] as const;
export type CondicionAnimal = (typeof CONDICIONES_ANIMAL)[number];

export const TIPOS_PERSONAL = ["veterinario", "auxiliar"] as const;
export type TipoPersonal = (typeof TIPOS_PERSONAL)[number];

export const ESTADOS_OPERATIVO = ["programado", "en_curso", "realizado", "cancelado"] as const;
export type EstadoOperativo = (typeof ESTADOS_OPERATIVO)[number];

/** Se usa tanto para el tipo solicitado en un turno como para el procedimiento realizado. */
export const TIPOS_PROCEDIMIENTO = ["castracion", "chipeo", "castracion_y_chipeo"] as const;
export type TipoProcedimiento = (typeof TIPOS_PROCEDIMIENTO)[number];

export const ESTADOS_TURNO = ["pendiente", "confirmado", "completado", "cancelado"] as const;
export type EstadoTurno = (typeof ESTADOS_TURNO)[number];

export const TIPOS_MOVIMIENTO = ["ingreso", "egreso"] as const;
export type TipoMovimiento = (typeof TIPOS_MOVIMIENTO)[number];

export const ESTADOS_AVISTAMIENTO = ["pendiente", "atendido"] as const;
export type EstadoAvistamiento = (typeof ESTADOS_AVISTAMIENTO)[number];

export const TIPOS_NOTIFICACION = ["recordatorio", "confirmacion", "cancelacion", "reprogramacion"] as const;
export type TipoNotificacion = (typeof TIPOS_NOTIFICACION)[number];

/** `anulado` registra recordatorios que dejaron de valer (turno cancelado o reprogramado). */
export const ESTADOS_ENVIO = ["pendiente", "enviado", "fallido", "anulado"] as const;
export type EstadoEnvio = (typeof ESTADOS_ENVIO)[number];

/** Zona horaria oficial de Río Grande (UTC-3, sin horario de verano). */
export const ZONA_HORARIA = "America/Argentina/Ushuaia";
```

- [x] **Step 2: `src/lib/conexion.ts`**

```ts
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
```

---

### Task 5: Migrador, CLI de base de datos e infraestructura de tests

**Files:**
- Create: `db/migrations/index.ts`, `db/migrador.ts`, `db/seeders/inicial.ts` (versión vacía), `scripts/db.ts`, `vitest.config.ts`, `tests/setup/global.ts`, `tests/setup/entorno.ts`, `tests/helpers/bd.ts`

- [x] **Step 1: `db/migrations/index.ts`** (lista vacía por ahora; la migración se agrega en la Task 6)

```ts
import type { Sequelize } from "sequelize";

/** Contrato que cumple cada archivo de migración. */
export interface Migracion {
  nombre: string;
  up: (sequelize: Sequelize) => Promise<void>;
  down: (sequelize: Sequelize) => Promise<void>;
}

/**
 * Migraciones en orden de aplicación. Se listan explícitamente (en lugar de buscar
 * archivos por patrón) para que funcionen igual con tsx, Vitest y Next.js.
 */
export const migraciones: Migracion[] = [];
```

- [x] **Step 2: `db/migrador.ts`**

```ts
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
```

- [x] **Step 3: `db/seeders/inicial.ts`** (versión vacía; se completa en la Task 8)

```ts
/** Carga los datos mínimos para operar el sistema. Se completa en la Task 8. */
export async function sembrarDatosIniciales(): Promise<void> {}
```

- [x] **Step 4: `scripts/db.ts`**

```ts
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
```

> Nota: `@/lib/db` todavía no existe; se crea en la Task 7. Hasta entonces, crear `src/lib/db.ts` con el contenido mínimo:
>
> ```ts
> /** Punto de entrada de la capa de datos. Las asociaciones se agregan en la Task 7. */
> export { sequelize } from "./conexion";
> ```

- [x] **Step 5: `vitest.config.ts`**

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mismo alias que tsconfig.json: "@/..." apunta a src/.
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    // Recrea la base de test una vez antes de toda la corrida.
    globalSetup: ["tests/setup/global.ts"],
    // Carga .env antes de cada archivo de test.
    setupFiles: ["tests/setup/entorno.ts"],
    // Los archivos comparten la misma base: se ejecutan de a uno para evitar interferencias.
    fileParallelism: false,
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});
```

- [x] **Step 6: `tests/setup/global.ts`**

```ts
import { execSync } from "node:child_process";

/** Se ejecuta una vez por corrida: deja la base de test con el esquema y los datos iniciales. */
export default function prepararBaseDeTest() {
  execSync("npm run db:reset:test", { stdio: "inherit" });
}
```

- [x] **Step 7: `tests/setup/entorno.ts`**

```ts
import { loadEnvConfig } from "@next/env";

// Vitest define NODE_ENV=test, por lo que la conexión usará DATABASE_URL_TEST.
loadEnvConfig(process.cwd());
```

- [x] **Step 8: `tests/helpers/bd.ts`**

```ts
import type { Transaction } from "sequelize";
import { sequelize } from "@/lib/db";

/**
 * Ejecuta el bloque dentro de una transacción que siempre se revierte,
 * de modo que cada test deja la base exactamente como la encontró.
 */
export async function enTransaccionRevertida(bloque: (transaccion: Transaction) => Promise<void>): Promise<void> {
  const transaccion = await sequelize.transaction();
  try {
    await bloque(transaccion);
  } finally {
    await transaccion.rollback();
  }
}

/**
 * Espera que la operación sea rechazada por la base de datos y devuelve el nombre
 * de la restricción violada (CHECK, UNIQUE o FOREIGN KEY) informado por PostgreSQL.
 */
export async function restriccionViolada(operacion: Promise<unknown>): Promise<string | undefined> {
  try {
    await operacion;
  } catch (error) {
    return (error as { parent?: { constraint?: string } }).parent?.constraint;
  }
  throw new Error("Se esperaba que la base de datos rechazara la operación");
}
```

- [x] **Step 9: Verificar que la CLI funciona sobre una base vacía**

Run: `npm run db:reset`
Expected: `Base reiniciada: 0 migraciones aplicadas y datos iniciales cargados`

---

### Task 6: Esquema de 16 tablas (TDD)

**Files:**
- Test: `tests/db/esquema.test.ts`
- Create: `db/migrations/0001-esquema-inicial.ts`
- Modify: `db/migrations/index.ts`

- [x] **Step 1: Escribir el test que falla**

```ts
import { afterAll, describe, expect, it } from "vitest";
import { QueryTypes } from "sequelize";
import { sequelize } from "@/lib/db";
import { restriccionViolada } from "../helpers/bd";

afterAll(() => sequelize.close());

/** Ejecuta SQL crudo; se usa para probar las restricciones sin pasar por los modelos. */
const ejecutar = (sql: string) => sequelize.query(sql);

describe("esquema de la base de datos", () => {
  it("crea las 16 tablas del ERD", async () => {
    // Se usa pg_tables: Sequelize 6 trata de forma especial las consultas que empiezan con
    // "SELECT table_name FROM information_schema.tables" y devuelve arrays en lugar de objetos.
    const filas = await sequelize.query<{ table_name: string }>(
      `SELECT tablename AS table_name FROM pg_tables
       WHERE schemaname = 'public' AND tablename <> 'migraciones_aplicadas'
       ORDER BY tablename`,
      { type: QueryTypes.SELECT },
    );
    expect(filas.map((fila) => fila.table_name)).toEqual([
      "animal", "historial_clinico", "insumo", "movimiento_insumo", "notificacion",
      "operativo", "operativo_veterinario", "procedimiento", "procedimiento_insumo",
      "reporte_avistamiento", "rol", "turno", "usuario", "vecino", "veterinario", "zona",
    ]);
  });

  it("rechaza un sexo de animal distinto de M/H", async () => {
    const restriccion = await restriccionViolada(
      ejecutar("INSERT INTO animal (sexo, condicion) VALUES ('X', 'callejero')"),
    );
    expect(restriccion).toBe("ck_animal_sexo");
  });

  it("exige tutor solo para animales con_tutor", async () => {
    const restriccion = await restriccionViolada(
      ejecutar("INSERT INTO animal (sexo, condicion) VALUES ('M', 'con_tutor')"),
    );
    expect(restriccion).toBe("ck_animal_tutor");
  });

  it("no admite stock negativo", async () => {
    const restriccion = await restriccionViolada(
      ejecutar("INSERT INTO insumo (nombre, unidad, stock_actual) VALUES ('Ketamina', 'ml', -1)"),
    );
    expect(restriccion).toBe("ck_insumo_stock_actual");
  });

  it("exige matrícula al personal de tipo veterinario", async () => {
    const restriccion = await restriccionViolada(
      ejecutar("INSERT INTO veterinario (tipo, nombre, apellido) VALUES ('veterinario', 'Ana', 'Ruiz')"),
    );
    expect(restriccion).toBe("ck_veterinario_matricula");
  });

  it("exige número de chip cuando el procedimiento incluye chipeo", async () => {
    const restriccion = await restriccionViolada(
      ejecutar("INSERT INTO procedimiento (tipo, turno_id, veterinario_id) VALUES ('chipeo', 1, 1)"),
    );
    expect(restriccion).toBe("ck_procedimiento_chip");
  });
});
```

- [x] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run tests/db/esquema.test.ts`
Expected: FAIL — la lista de tablas está vacía y los INSERT fallan con `relation "animal" does not exist` (sin nombre de restricción).

- [x] **Step 3: Escribir la migración `db/migrations/0001-esquema-inicial.ts`**

```ts
import type { Sequelize } from "sequelize";
import type { Migracion } from "./index";

/**
 * Esquema inicial de SIGCAN según el ERD de la Fase 2 (16 tablas).
 *
 * Criterios:
 * - Las restricciones llevan nombre explícito (pk_, fk_, uq_, ck_, ux_) para que los
 *   errores de PostgreSQL identifiquen con precisión qué regla se violó.
 * - Los valores permitidos se escriben literalmente: una migración es una foto fija del
 *   esquema y no debe cambiar si más adelante cambian las constantes del código.
 * - Las fechas con hora se guardan como TIMESTAMPTZ para evitar ambigüedades de zona horaria.
 */
const SQL_CREAR = `
CREATE TABLE rol (
  id     INTEGER GENERATED BY DEFAULT AS IDENTITY,
  nombre VARCHAR(30) NOT NULL,
  CONSTRAINT pk_rol PRIMARY KEY (id),
  CONSTRAINT uq_rol_nombre UNIQUE (nombre),
  CONSTRAINT ck_rol_nombre CHECK (nombre IN ('administrador', 'operador', 'veterinario'))
);

CREATE TABLE usuario (
  id            INTEGER GENERATED BY DEFAULT AS IDENTITY,
  nombre        VARCHAR(60)  NOT NULL,
  apellido      VARCHAR(60)  NOT NULL,
  email         VARCHAR(120) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  activo        BOOLEAN      NOT NULL DEFAULT TRUE,
  rol_id        INTEGER      NOT NULL,
  CONSTRAINT pk_usuario PRIMARY KEY (id),
  CONSTRAINT uq_usuario_email UNIQUE (email),
  CONSTRAINT fk_usuario_rol FOREIGN KEY (rol_id) REFERENCES rol (id)
);

CREATE TABLE zona (
  id          INTEGER GENERATED BY DEFAULT AS IDENTITY,
  nombre      VARCHAR(80)  NOT NULL,
  descripcion VARCHAR(255),
  CONSTRAINT pk_zona PRIMARY KEY (id),
  CONSTRAINT uq_zona_nombre UNIQUE (nombre)
);

CREATE TABLE vecino (
  id         INTEGER GENERATED BY DEFAULT AS IDENTITY,
  nombre     VARCHAR(60)  NOT NULL,
  apellido   VARCHAR(60)  NOT NULL,
  dni        VARCHAR(10)  NOT NULL,
  telefono   VARCHAR(20)  NOT NULL,
  email      VARCHAR(120),
  direccion  VARCHAR(150) NOT NULL,
  activo     BOOLEAN      NOT NULL DEFAULT TRUE,
  fecha_baja DATE,
  zona_id    INTEGER      NOT NULL,
  CONSTRAINT pk_vecino PRIMARY KEY (id),
  CONSTRAINT uq_vecino_dni UNIQUE (dni),
  -- Un vecino dado de baja lógica debe registrar la fecha de baja.
  CONSTRAINT ck_vecino_baja CHECK (activo OR fecha_baja IS NOT NULL),
  CONSTRAINT fk_vecino_zona FOREIGN KEY (zona_id) REFERENCES zona (id)
);

CREATE TABLE animal (
  id            INTEGER GENERATED BY DEFAULT AS IDENTITY,
  nombre        VARCHAR(60),
  especie       VARCHAR(20) NOT NULL DEFAULT 'canino',
  raza          VARCHAR(60),
  sexo          CHAR(1)     NOT NULL,
  edad_estimada INTEGER,
  condicion     VARCHAR(20) NOT NULL,
  castrado      BOOLEAN     NOT NULL DEFAULT FALSE,
  numero_chip   VARCHAR(20),
  vecino_id     INTEGER,
  CONSTRAINT pk_animal PRIMARY KEY (id),
  CONSTRAINT uq_animal_chip UNIQUE (numero_chip),
  CONSTRAINT ck_animal_sexo CHECK (sexo IN ('M', 'H')),
  CONSTRAINT ck_animal_condicion CHECK (condicion IN ('con_tutor', 'callejero', 'asilvestrado')),
  CONSTRAINT ck_animal_edad CHECK (edad_estimada IS NULL OR edad_estimada >= 0),
  -- Solo los animales con tutor tienen vecino; callejeros y asilvestrados no.
  CONSTRAINT ck_animal_tutor CHECK ((condicion = 'con_tutor') = (vecino_id IS NOT NULL)),
  CONSTRAINT fk_animal_vecino FOREIGN KEY (vecino_id) REFERENCES vecino (id)
);

CREATE TABLE veterinario (
  id           INTEGER GENERATED BY DEFAULT AS IDENTITY,
  tipo         VARCHAR(20) NOT NULL,
  nombre       VARCHAR(60) NOT NULL,
  apellido     VARCHAR(60) NOT NULL,
  matricula    VARCHAR(20),
  especialidad VARCHAR(60),
  telefono     VARCHAR(20),
  activo       BOOLEAN     NOT NULL DEFAULT TRUE,
  usuario_id   INTEGER,
  CONSTRAINT pk_veterinario PRIMARY KEY (id),
  CONSTRAINT uq_veterinario_matricula UNIQUE (matricula),
  CONSTRAINT uq_veterinario_usuario UNIQUE (usuario_id),
  CONSTRAINT ck_veterinario_tipo CHECK (tipo IN ('veterinario', 'auxiliar')),
  -- La matrícula es obligatoria para veterinarios y opcional para auxiliares.
  CONSTRAINT ck_veterinario_matricula CHECK (tipo = 'auxiliar' OR matricula IS NOT NULL),
  CONSTRAINT fk_veterinario_usuario FOREIGN KEY (usuario_id) REFERENCES usuario (id)
);

CREATE TABLE operativo (
  id                     INTEGER GENERATED BY DEFAULT AS IDENTITY,
  fecha                  DATE         NOT NULL,
  hora_inicio            TIME         NOT NULL,
  hora_fin               TIME         NOT NULL,
  lugar                  VARCHAR(150) NOT NULL,
  cupo_maximo            INTEGER      NOT NULL,
  estado                 VARCHAR(20)  NOT NULL DEFAULT 'programado',
  motivo_cancelacion     VARCHAR(255),
  fecha_cancelacion      TIMESTAMPTZ,
  usuario_cancelacion_id INTEGER,
  zona_id                INTEGER      NOT NULL,
  CONSTRAINT pk_operativo PRIMARY KEY (id),
  CONSTRAINT ck_operativo_cupo CHECK (cupo_maximo > 0),
  CONSTRAINT ck_operativo_horario CHECK (hora_fin > hora_inicio),
  CONSTRAINT ck_operativo_estado CHECK (estado IN ('programado', 'en_curso', 'realizado', 'cancelado')),
  -- Un operativo cancelado debe registrar motivo, fecha y usuario de la cancelación.
  CONSTRAINT ck_operativo_cancelacion CHECK (
    estado <> 'cancelado'
    OR (motivo_cancelacion IS NOT NULL AND fecha_cancelacion IS NOT NULL AND usuario_cancelacion_id IS NOT NULL)
  ),
  CONSTRAINT fk_operativo_usuario_cancelacion FOREIGN KEY (usuario_cancelacion_id) REFERENCES usuario (id),
  CONSTRAINT fk_operativo_zona FOREIGN KEY (zona_id) REFERENCES zona (id)
);

CREATE TABLE operativo_veterinario (
  operativo_id   INTEGER NOT NULL,
  veterinario_id INTEGER NOT NULL,
  CONSTRAINT pk_operativo_veterinario PRIMARY KEY (operativo_id, veterinario_id),
  CONSTRAINT fk_ov_operativo FOREIGN KEY (operativo_id) REFERENCES operativo (id) ON DELETE CASCADE,
  CONSTRAINT fk_ov_veterinario FOREIGN KEY (veterinario_id) REFERENCES veterinario (id)
);

CREATE TABLE turno (
  id                 INTEGER GENERATED BY DEFAULT AS IDENTITY,
  fecha_solicitud    TIMESTAMPTZ NOT NULL DEFAULT now(),
  horario            TIME        NOT NULL,
  tipo_solicitado    VARCHAR(20) NOT NULL,
  estado             VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  motivo_cancelacion VARCHAR(255),
  animal_id          INTEGER     NOT NULL,
  operativo_id       INTEGER     NOT NULL,
  CONSTRAINT pk_turno PRIMARY KEY (id),
  CONSTRAINT ck_turno_tipo CHECK (tipo_solicitado IN ('castracion', 'chipeo', 'castracion_y_chipeo')),
  CONSTRAINT ck_turno_estado CHECK (estado IN ('pendiente', 'confirmado', 'completado', 'cancelado')),
  CONSTRAINT ck_turno_cancelacion CHECK (estado <> 'cancelado' OR motivo_cancelacion IS NOT NULL),
  CONSTRAINT fk_turno_animal FOREIGN KEY (animal_id) REFERENCES animal (id),
  CONSTRAINT fk_turno_operativo FOREIGN KEY (operativo_id) REFERENCES operativo (id)
);
-- Refuerzo en la base de la regla de F3: un animal tiene como máximo un turno activo.
CREATE UNIQUE INDEX ux_turno_activo_por_animal ON turno (animal_id) WHERE estado IN ('pendiente', 'confirmado');
CREATE INDEX ix_turno_operativo ON turno (operativo_id);

CREATE TABLE procedimiento (
  id                   INTEGER GENERATED BY DEFAULT AS IDENTITY,
  tipo                 VARCHAR(20) NOT NULL,
  fecha                TIMESTAMPTZ NOT NULL DEFAULT now(),
  observaciones        TEXT,
  numero_chip_colocado VARCHAR(20),
  turno_id             INTEGER     NOT NULL,
  veterinario_id       INTEGER     NOT NULL,
  CONSTRAINT pk_procedimiento PRIMARY KEY (id),
  CONSTRAINT uq_procedimiento_turno UNIQUE (turno_id),
  CONSTRAINT uq_procedimiento_chip UNIQUE (numero_chip_colocado),
  CONSTRAINT ck_procedimiento_tipo CHECK (tipo IN ('castracion', 'chipeo', 'castracion_y_chipeo')),
  -- Hay chip si y solo si el procedimiento incluye chipeo.
  CONSTRAINT ck_procedimiento_chip CHECK ((tipo = 'castracion') = (numero_chip_colocado IS NULL)),
  CONSTRAINT fk_procedimiento_turno FOREIGN KEY (turno_id) REFERENCES turno (id),
  CONSTRAINT fk_procedimiento_veterinario FOREIGN KEY (veterinario_id) REFERENCES veterinario (id)
);

CREATE TABLE insumo (
  id           INTEGER GENERATED BY DEFAULT AS IDENTITY,
  nombre       VARCHAR(80)   NOT NULL,
  unidad       VARCHAR(20)   NOT NULL,
  stock_actual NUMERIC(10,2) NOT NULL DEFAULT 0,
  stock_minimo NUMERIC(10,2) NOT NULL DEFAULT 0,
  CONSTRAINT pk_insumo PRIMARY KEY (id),
  CONSTRAINT uq_insumo_nombre UNIQUE (nombre),
  CONSTRAINT ck_insumo_stock_actual CHECK (stock_actual >= 0),
  CONSTRAINT ck_insumo_stock_minimo CHECK (stock_minimo >= 0)
);

CREATE TABLE procedimiento_insumo (
  procedimiento_id INTEGER       NOT NULL,
  insumo_id        INTEGER       NOT NULL,
  cantidad_usada   NUMERIC(10,2) NOT NULL,
  CONSTRAINT pk_procedimiento_insumo PRIMARY KEY (procedimiento_id, insumo_id),
  CONSTRAINT ck_pi_cantidad CHECK (cantidad_usada > 0),
  CONSTRAINT fk_pi_procedimiento FOREIGN KEY (procedimiento_id) REFERENCES procedimiento (id),
  CONSTRAINT fk_pi_insumo FOREIGN KEY (insumo_id) REFERENCES insumo (id)
);

CREATE TABLE movimiento_insumo (
  id               INTEGER GENERATED BY DEFAULT AS IDENTITY,
  tipo             VARCHAR(10)   NOT NULL,
  cantidad         NUMERIC(10,2) NOT NULL,
  fecha            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  motivo           VARCHAR(255),
  insumo_id        INTEGER       NOT NULL,
  usuario_id       INTEGER       NOT NULL,
  procedimiento_id INTEGER,
  CONSTRAINT pk_movimiento_insumo PRIMARY KEY (id),
  CONSTRAINT ck_movimiento_tipo CHECK (tipo IN ('ingreso', 'egreso')),
  CONSTRAINT ck_movimiento_cantidad CHECK (cantidad > 0),
  CONSTRAINT fk_movimiento_insumo FOREIGN KEY (insumo_id) REFERENCES insumo (id),
  CONSTRAINT fk_movimiento_usuario FOREIGN KEY (usuario_id) REFERENCES usuario (id),
  CONSTRAINT fk_movimiento_procedimiento FOREIGN KEY (procedimiento_id) REFERENCES procedimiento (id)
);

CREATE TABLE historial_clinico (
  id               INTEGER GENERATED BY DEFAULT AS IDENTITY,
  descripcion      TEXT    NOT NULL,
  procedimiento_id INTEGER NOT NULL,
  CONSTRAINT pk_historial_clinico PRIMARY KEY (id),
  CONSTRAINT uq_historial_procedimiento UNIQUE (procedimiento_id),
  CONSTRAINT fk_historial_procedimiento FOREIGN KEY (procedimiento_id) REFERENCES procedimiento (id)
);

CREATE TABLE reporte_avistamiento (
  id                   INTEGER GENERATED BY DEFAULT AS IDENTITY,
  fecha                TIMESTAMPTZ  NOT NULL,
  descripcion          TEXT         NOT NULL,
  cantidad_animales    INTEGER      NOT NULL,
  direccion_referencia VARCHAR(150),
  estado               VARCHAR(20)  NOT NULL DEFAULT 'pendiente',
  fecha_atencion       TIMESTAMPTZ,
  zona_id              INTEGER      NOT NULL,
  vecino_id            INTEGER,
  usuario_id           INTEGER      NOT NULL,
  operativo_id         INTEGER,
  CONSTRAINT pk_reporte_avistamiento PRIMARY KEY (id),
  CONSTRAINT ck_reporte_cantidad CHECK (cantidad_animales > 0),
  CONSTRAINT ck_reporte_estado CHECK (estado IN ('pendiente', 'atendido')),
  -- Un reporte atendido debe registrar la fecha de atención.
  CONSTRAINT ck_reporte_atencion CHECK (estado = 'pendiente' OR fecha_atencion IS NOT NULL),
  CONSTRAINT fk_reporte_zona FOREIGN KEY (zona_id) REFERENCES zona (id),
  CONSTRAINT fk_reporte_vecino FOREIGN KEY (vecino_id) REFERENCES vecino (id),
  CONSTRAINT fk_reporte_usuario FOREIGN KEY (usuario_id) REFERENCES usuario (id),
  CONSTRAINT fk_reporte_operativo FOREIGN KEY (operativo_id) REFERENCES operativo (id)
);

CREATE TABLE notificacion (
  id               INTEGER GENERATED BY DEFAULT AS IDENTITY,
  tipo             VARCHAR(20) NOT NULL,
  canal            VARCHAR(10) NOT NULL DEFAULT 'email',
  mensaje          TEXT        NOT NULL,
  estado_envio     VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  fecha_programada TIMESTAMPTZ NOT NULL,
  fecha_envio      TIMESTAMPTZ,
  turno_id         INTEGER     NOT NULL,
  vecino_id        INTEGER     NOT NULL,
  CONSTRAINT pk_notificacion PRIMARY KEY (id),
  CONSTRAINT ck_notificacion_tipo CHECK (tipo IN ('recordatorio', 'confirmacion', 'cancelacion', 'reprogramacion')),
  CONSTRAINT ck_notificacion_canal CHECK (canal = 'email'),
  CONSTRAINT ck_notificacion_estado CHECK (estado_envio IN ('pendiente', 'enviado', 'fallido', 'anulado')),
  CONSTRAINT fk_notificacion_turno FOREIGN KEY (turno_id) REFERENCES turno (id),
  CONSTRAINT fk_notificacion_vecino FOREIGN KEY (vecino_id) REFERENCES vecino (id)
);
-- Acelera la búsqueda periódica de notificaciones listas para enviar.
CREATE INDEX ix_notificacion_pendientes ON notificacion (fecha_programada) WHERE estado_envio = 'pendiente';
`;

/** Orden inverso de creación para respetar las claves foráneas. */
const SQL_ELIMINAR = `
DROP TABLE IF EXISTS notificacion, reporte_avistamiento, historial_clinico, movimiento_insumo,
  procedimiento_insumo, insumo, procedimiento, turno, operativo_veterinario, operativo,
  veterinario, animal, vecino, zona, usuario, rol CASCADE;
`;

export const esquemaInicial: Migracion = {
  nombre: "0001-esquema-inicial",
  // Todo el DDL se ejecuta en una transacción: o se crea el esquema completo o nada.
  up: async (sequelize: Sequelize) => {
    await sequelize.transaction((transaction) => sequelize.query(SQL_CREAR, { transaction }));
  },
  down: async (sequelize: Sequelize) => {
    await sequelize.query(SQL_ELIMINAR);
  },
};
```

- [x] **Step 4: Registrar la migración en `db/migrations/index.ts`**

Agregar el import y reemplazar la lista vacía:

```ts
import { esquemaInicial } from "./0001-esquema-inicial";
```

```ts
export const migraciones: Migracion[] = [esquemaInicial];
```

> Atención: `0001-esquema-inicial.ts` importa el tipo `Migracion` desde `./index` e `index.ts` importa la migración. Como uno de los dos imports es `import type`, no hay ciclo en tiempo de ejecución.

- [x] **Step 5: Correr el test y verificar que pasa**

Run: `npx vitest run tests/db/esquema.test.ts`
Expected: PASS (6 tests).

---

### Task 7: Modelos Sequelize y asociaciones (TDD)

**Files:**
- Test: `tests/db/modelos.test.ts`
- Create: `src/models/{rol,usuario,zona,vecino,animal,veterinario,operativo,operativo-veterinario,turno,procedimiento,insumo,procedimiento-insumo,movimiento-insumo,historial-clinico,reporte-avistamiento,notificacion}.ts`
- Modify: `src/lib/db.ts`

Convenciones de los modelos: los atributos se llaman igual que las columnas del ERD (snake_case); `CreationOptional` marca los campos con valor por defecto o nulos; `DATE`/`TIME` de PostgreSQL se manejan como `string` (`"2026-11-05"`, `"09:00:00"`) y `NUMERIC` como `string` (pg lo devuelve así para no perder precisión). Las propiedades de asociación se declaran con `NonAttribute`.

- [x] **Step 1: Escribir el test que falla `tests/db/modelos.test.ts`**

```ts
import { afterAll, describe, expect, it } from "vitest";
import {
  Animal, Operativo, OperativoVeterinario, sequelize, Turno, Vecino, Veterinario, Zona,
} from "@/lib/db";
import { enTransaccionRevertida, restriccionViolada } from "../helpers/bd";

afterAll(() => sequelize.close());

describe("modelos y asociaciones", () => {
  it("navega animal → vecino → zona", async () => {
    await enTransaccionRevertida(async (transaction) => {
      const zona = await Zona.create({ nombre: "Zona de prueba modelos" }, { transaction });
      const vecino = await Vecino.create(
        { nombre: "Ana", apellido: "Pérez", dni: "30111222", telefono: "2964400000", direccion: "Calle 1 123", zona_id: zona.id },
        { transaction },
      );
      const animal = await Animal.create({ sexo: "H", condicion: "con_tutor", vecino_id: vecino.id }, { transaction });

      const encontrado = await Animal.findByPk(animal.id, {
        include: [{ association: "vecino", include: ["zona"] }],
        transaction,
      });

      expect(encontrado?.vecino?.zona?.nombre).toBe("Zona de prueba modelos");
      expect(encontrado?.castrado).toBe(false);
    });
  });

  it("asigna personal a un operativo (N:M)", async () => {
    await enTransaccionRevertida(async (transaction) => {
      const zona = await Zona.create({ nombre: "Zona de prueba N:M" }, { transaction });
      const operativo = await Operativo.create(
        { fecha: "2030-05-10", hora_inicio: "09:00", hora_fin: "13:00", lugar: "SUM barrial", cupo_maximo: 20, zona_id: zona.id },
        { transaction },
      );
      const veterinario = await Veterinario.create(
        { tipo: "veterinario", nombre: "Luis", apellido: "Gómez", matricula: "MV-0001" },
        { transaction },
      );
      await OperativoVeterinario.create({ operativo_id: operativo.id, veterinario_id: veterinario.id }, { transaction });

      const conPersonal = await Operativo.findByPk(operativo.id, { include: ["personal"], transaction });

      expect(conPersonal?.estado).toBe("programado");
      expect(conPersonal?.personal?.map((persona) => persona.matricula)).toEqual(["MV-0001"]);
    });
  });

  it("impide dos turnos activos para el mismo animal", async () => {
    await enTransaccionRevertida(async (transaction) => {
      const zona = await Zona.create({ nombre: "Zona de prueba turnos" }, { transaction });
      const operativo = await Operativo.create(
        { fecha: "2030-05-10", hora_inicio: "09:00", hora_fin: "13:00", lugar: "SUM barrial", cupo_maximo: 20, zona_id: zona.id },
        { transaction },
      );
      const animal = await Animal.create({ sexo: "M", condicion: "callejero" }, { transaction });
      const datosTurno = { horario: "09:30", tipo_solicitado: "castracion" as const, animal_id: animal.id, operativo_id: operativo.id };

      await Turno.create(datosTurno, { transaction });
      const restriccion = await restriccionViolada(Turno.create({ ...datosTurno, estado: "confirmado" }, { transaction }));

      expect(restriccion).toBe("ux_turno_activo_por_animal");
    });
  });
});
```

- [x] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run tests/db/modelos.test.ts`
Expected: FAIL — `@/lib/db` no exporta `Animal`, `Zona`, etc.

- [x] **Step 3: `src/models/rol.ts`**

```ts
import { DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes, type NonAttribute } from "sequelize";
import { sequelize } from "@/lib/conexion";
import type { NombreRol } from "@/lib/constantes";
import type { Usuario } from "./usuario";

/** Rol del sistema: administrador, operador o veterinario (F11). */
export class Rol extends Model<InferAttributes<Rol>, InferCreationAttributes<Rol>> {
  declare id: CreationOptional<number>;
  declare nombre: NombreRol;

  declare usuarios?: NonAttribute<Usuario[]>;
}

Rol.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nombre: { type: DataTypes.STRING(30), allowNull: false, unique: true },
  },
  { sequelize, tableName: "rol" },
);
```

- [x] **Step 4: `src/models/usuario.ts`**

```ts
import { DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes, type NonAttribute } from "sequelize";
import { sequelize } from "@/lib/conexion";
import type { Rol } from "./rol";
import type { Veterinario } from "./veterinario";

/** Cuenta de acceso del personal municipal; cada usuario tiene un único rol (F11). */
export class Usuario extends Model<InferAttributes<Usuario>, InferCreationAttributes<Usuario>> {
  declare id: CreationOptional<number>;
  declare nombre: string;
  declare apellido: string;
  declare email: string;
  declare password_hash: string;
  declare activo: CreationOptional<boolean>;
  declare rol_id: number;

  declare rol?: NonAttribute<Rol>;
  declare personal?: NonAttribute<Veterinario | null>;
}

Usuario.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nombre: { type: DataTypes.STRING(60), allowNull: false },
    apellido: { type: DataTypes.STRING(60), allowNull: false },
    email: { type: DataTypes.STRING(120), allowNull: false, unique: true },
    password_hash: { type: DataTypes.STRING(255), allowNull: false },
    activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    rol_id: { type: DataTypes.INTEGER, allowNull: false },
  },
  {
    sequelize,
    tableName: "usuario",
    // El hash nunca sale del servidor salvo que se pida explícitamente (login).
    defaultScope: { attributes: { exclude: ["password_hash"] } },
    scopes: { conPassword: { attributes: { include: ["password_hash"] } } },
  },
);
```

- [x] **Step 5: `src/models/zona.ts`**

```ts
import { DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes } from "sequelize";
import { sequelize } from "@/lib/conexion";

/** Zona o barrio administrativo que organiza vecinos, operativos y avistamientos (F10). */
export class Zona extends Model<InferAttributes<Zona>, InferCreationAttributes<Zona>> {
  declare id: CreationOptional<number>;
  declare nombre: string;
  declare descripcion: CreationOptional<string | null>;
}

Zona.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nombre: { type: DataTypes.STRING(80), allowNull: false, unique: true },
    descripcion: { type: DataTypes.STRING(255), allowNull: true },
  },
  { sequelize, tableName: "zona" },
);
```

- [x] **Step 6: `src/models/vecino.ts`**

```ts
import { DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes, type NonAttribute } from "sequelize";
import { sequelize } from "@/lib/conexion";
import type { Animal } from "./animal";
import type { Zona } from "./zona";

/** Vecino solicitante y tutor de animales; admite baja lógica (F1). */
export class Vecino extends Model<InferAttributes<Vecino>, InferCreationAttributes<Vecino>> {
  declare id: CreationOptional<number>;
  declare nombre: string;
  declare apellido: string;
  declare dni: string;
  declare telefono: string;
  declare email: CreationOptional<string | null>;
  declare direccion: string;
  declare activo: CreationOptional<boolean>;
  /** Fecha de la baja lógica (formato YYYY-MM-DD); nula mientras el vecino está activo. */
  declare fecha_baja: CreationOptional<string | null>;
  declare zona_id: number;

  declare zona?: NonAttribute<Zona>;
  declare animales?: NonAttribute<Animal[]>;
}

Vecino.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nombre: { type: DataTypes.STRING(60), allowNull: false },
    apellido: { type: DataTypes.STRING(60), allowNull: false },
    dni: { type: DataTypes.STRING(10), allowNull: false, unique: true },
    telefono: { type: DataTypes.STRING(20), allowNull: false },
    email: { type: DataTypes.STRING(120), allowNull: true },
    direccion: { type: DataTypes.STRING(150), allowNull: false },
    activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    fecha_baja: { type: DataTypes.DATEONLY, allowNull: true },
    zona_id: { type: DataTypes.INTEGER, allowNull: false },
  },
  { sequelize, tableName: "vecino" },
);
```

- [x] **Step 7: `src/models/animal.ts`**

```ts
import { DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes, type NonAttribute } from "sequelize";
import { sequelize } from "@/lib/conexion";
import type { CondicionAnimal, SexoAnimal } from "@/lib/constantes";
import type { Turno } from "./turno";
import type { Vecino } from "./vecino";

/** Animal canino; `vecino_id` nulo identifica a un callejero o asilvestrado (F2). */
export class Animal extends Model<InferAttributes<Animal>, InferCreationAttributes<Animal>> {
  declare id: CreationOptional<number>;
  declare nombre: CreationOptional<string | null>;
  declare especie: CreationOptional<string>;
  declare raza: CreationOptional<string | null>;
  declare sexo: SexoAnimal;
  declare edad_estimada: CreationOptional<number | null>;
  declare condicion: CondicionAnimal;
  declare castrado: CreationOptional<boolean>;
  declare numero_chip: CreationOptional<string | null>;
  declare vecino_id: CreationOptional<number | null>;

  declare vecino?: NonAttribute<Vecino | null>;
  declare turnos?: NonAttribute<Turno[]>;
}

Animal.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nombre: { type: DataTypes.STRING(60), allowNull: true },
    especie: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "canino" },
    raza: { type: DataTypes.STRING(60), allowNull: true },
    sexo: { type: DataTypes.CHAR(1), allowNull: false },
    edad_estimada: { type: DataTypes.INTEGER, allowNull: true },
    condicion: { type: DataTypes.STRING(20), allowNull: false },
    castrado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    numero_chip: { type: DataTypes.STRING(20), allowNull: true, unique: true },
    vecino_id: { type: DataTypes.INTEGER, allowNull: true },
  },
  { sequelize, tableName: "animal" },
);
```

- [x] **Step 8: `src/models/veterinario.ts`**

```ts
import { DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes, type NonAttribute } from "sequelize";
import { sequelize } from "@/lib/conexion";
import type { TipoPersonal } from "@/lib/constantes";
import type { Operativo } from "./operativo";
import type { Usuario } from "./usuario";

/** Personal actuante: veterinarios (con matrícula) y auxiliares (F5). */
export class Veterinario extends Model<InferAttributes<Veterinario>, InferCreationAttributes<Veterinario>> {
  declare id: CreationOptional<number>;
  declare tipo: TipoPersonal;
  declare nombre: string;
  declare apellido: string;
  declare matricula: CreationOptional<string | null>;
  declare especialidad: CreationOptional<string | null>;
  declare telefono: CreationOptional<string | null>;
  declare activo: CreationOptional<boolean>;
  /** Cuenta de acceso vinculada (opcional); necesaria para registrar procedimientos. */
  declare usuario_id: CreationOptional<number | null>;

  declare usuario?: NonAttribute<Usuario | null>;
  declare operativos?: NonAttribute<Operativo[]>;
}

Veterinario.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    tipo: { type: DataTypes.STRING(20), allowNull: false },
    nombre: { type: DataTypes.STRING(60), allowNull: false },
    apellido: { type: DataTypes.STRING(60), allowNull: false },
    matricula: { type: DataTypes.STRING(20), allowNull: true, unique: true },
    especialidad: { type: DataTypes.STRING(60), allowNull: true },
    telefono: { type: DataTypes.STRING(20), allowNull: true },
    activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    usuario_id: { type: DataTypes.INTEGER, allowNull: true, unique: true },
  },
  { sequelize, tableName: "veterinario" },
);
```

- [x] **Step 9: `src/models/operativo.ts`**

```ts
import { DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes, type NonAttribute } from "sequelize";
import { sequelize } from "@/lib/conexion";
import type { EstadoOperativo } from "@/lib/constantes";
import type { Turno } from "./turno";
import type { Usuario } from "./usuario";
import type { Veterinario } from "./veterinario";
import type { Zona } from "./zona";

/** Jornada de castración/chipeo en una zona, con cupo máximo de turnos (F4). */
export class Operativo extends Model<InferAttributes<Operativo>, InferCreationAttributes<Operativo>> {
  declare id: CreationOptional<number>;
  /** Fecha local del operativo (YYYY-MM-DD). */
  declare fecha: string;
  /** Horas locales (HH:MM o HH:MM:SS). */
  declare hora_inicio: string;
  declare hora_fin: string;
  declare lugar: string;
  declare cupo_maximo: number;
  declare estado: CreationOptional<EstadoOperativo>;
  declare motivo_cancelacion: CreationOptional<string | null>;
  declare fecha_cancelacion: CreationOptional<Date | null>;
  declare usuario_cancelacion_id: CreationOptional<number | null>;
  declare zona_id: number;

  declare zona?: NonAttribute<Zona>;
  declare turnos?: NonAttribute<Turno[]>;
  declare personal?: NonAttribute<Veterinario[]>;
  declare usuarioCancelacion?: NonAttribute<Usuario | null>;
}

Operativo.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    fecha: { type: DataTypes.DATEONLY, allowNull: false },
    hora_inicio: { type: DataTypes.TIME, allowNull: false },
    hora_fin: { type: DataTypes.TIME, allowNull: false },
    lugar: { type: DataTypes.STRING(150), allowNull: false },
    cupo_maximo: { type: DataTypes.INTEGER, allowNull: false },
    estado: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "programado" },
    motivo_cancelacion: { type: DataTypes.STRING(255), allowNull: true },
    fecha_cancelacion: { type: DataTypes.DATE, allowNull: true },
    usuario_cancelacion_id: { type: DataTypes.INTEGER, allowNull: true },
    zona_id: { type: DataTypes.INTEGER, allowNull: false },
  },
  { sequelize, tableName: "operativo" },
);
```

- [x] **Step 10: `src/models/operativo-veterinario.ts`**

```ts
import { DataTypes, Model, type InferAttributes, type InferCreationAttributes } from "sequelize";
import { sequelize } from "@/lib/conexion";

/** Tabla intermedia N:M: personal asignado a cada operativo (F4/F5). */
export class OperativoVeterinario extends Model<
  InferAttributes<OperativoVeterinario>,
  InferCreationAttributes<OperativoVeterinario>
> {
  declare operativo_id: number;
  declare veterinario_id: number;
}

OperativoVeterinario.init(
  {
    operativo_id: { type: DataTypes.INTEGER, primaryKey: true },
    veterinario_id: { type: DataTypes.INTEGER, primaryKey: true },
  },
  { sequelize, tableName: "operativo_veterinario" },
);
```

- [x] **Step 11: `src/models/turno.ts`**

```ts
import { DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes, type NonAttribute } from "sequelize";
import { sequelize } from "@/lib/conexion";
import type { EstadoTurno, TipoProcedimiento } from "@/lib/constantes";
import type { Animal } from "./animal";
import type { Notificacion } from "./notificacion";
import type { Operativo } from "./operativo";
import type { Procedimiento } from "./procedimiento";

/** Turno de un animal dentro de un operativo (F3). */
export class Turno extends Model<InferAttributes<Turno>, InferCreationAttributes<Turno>> {
  declare id: CreationOptional<number>;
  declare fecha_solicitud: CreationOptional<Date>;
  /** Hora local del turno (HH:MM o HH:MM:SS); la fecha la aporta el operativo. */
  declare horario: string;
  declare tipo_solicitado: TipoProcedimiento;
  declare estado: CreationOptional<EstadoTurno>;
  declare motivo_cancelacion: CreationOptional<string | null>;
  declare animal_id: number;
  declare operativo_id: number;

  declare animal?: NonAttribute<Animal>;
  declare operativo?: NonAttribute<Operativo>;
  declare procedimiento?: NonAttribute<Procedimiento | null>;
  declare notificaciones?: NonAttribute<Notificacion[]>;
}

Turno.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    fecha_solicitud: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    horario: { type: DataTypes.TIME, allowNull: false },
    tipo_solicitado: { type: DataTypes.STRING(20), allowNull: false },
    estado: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "pendiente" },
    motivo_cancelacion: { type: DataTypes.STRING(255), allowNull: true },
    animal_id: { type: DataTypes.INTEGER, allowNull: false },
    operativo_id: { type: DataTypes.INTEGER, allowNull: false },
  },
  { sequelize, tableName: "turno" },
);
```

- [x] **Step 12: `src/models/procedimiento.ts`**

```ts
import { DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes, type NonAttribute } from "sequelize";
import { sequelize } from "@/lib/conexion";
import type { TipoProcedimiento } from "@/lib/constantes";
import type { HistorialClinico } from "./historial-clinico";
import type { Insumo } from "./insumo";
import type { MovimientoInsumo } from "./movimiento-insumo";
import type { ProcedimientoInsumo } from "./procedimiento-insumo";
import type { Turno } from "./turno";
import type { Veterinario } from "./veterinario";

/** Procedimiento realizado sobre el animal de un turno; como máximo uno por turno (F7). */
export class Procedimiento extends Model<InferAttributes<Procedimiento>, InferCreationAttributes<Procedimiento>> {
  declare id: CreationOptional<number>;
  declare tipo: TipoProcedimiento;
  declare fecha: CreationOptional<Date>;
  declare observaciones: CreationOptional<string | null>;
  declare numero_chip_colocado: CreationOptional<string | null>;
  declare turno_id: number;
  declare veterinario_id: number;

  declare turno?: NonAttribute<Turno>;
  declare veterinario?: NonAttribute<Veterinario>;
  declare insumos?: NonAttribute<Insumo[]>;
  declare detalleInsumos?: NonAttribute<ProcedimientoInsumo[]>;
  declare movimientos?: NonAttribute<MovimientoInsumo[]>;
  declare historial?: NonAttribute<HistorialClinico | null>;
}

Procedimiento.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    tipo: { type: DataTypes.STRING(20), allowNull: false },
    fecha: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    observaciones: { type: DataTypes.TEXT, allowNull: true },
    numero_chip_colocado: { type: DataTypes.STRING(20), allowNull: true, unique: true },
    turno_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    veterinario_id: { type: DataTypes.INTEGER, allowNull: false },
  },
  { sequelize, tableName: "procedimiento" },
);
```

- [x] **Step 13: `src/models/insumo.ts`**

```ts
import { DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes, type NonAttribute } from "sequelize";
import { sequelize } from "@/lib/conexion";
import type { MovimientoInsumo } from "./movimiento-insumo";

/**
 * Insumo veterinario con control de stock (F6).
 * Las cantidades NUMERIC llegan como string desde pg para no perder precisión;
 * los servicios las convierten a número al operar.
 */
export class Insumo extends Model<InferAttributes<Insumo>, InferCreationAttributes<Insumo>> {
  declare id: CreationOptional<number>;
  declare nombre: string;
  declare unidad: string;
  declare stock_actual: CreationOptional<string>;
  declare stock_minimo: CreationOptional<string>;

  declare movimientos?: NonAttribute<MovimientoInsumo[]>;
}

Insumo.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nombre: { type: DataTypes.STRING(80), allowNull: false, unique: true },
    unidad: { type: DataTypes.STRING(20), allowNull: false },
    stock_actual: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: "0" },
    stock_minimo: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: "0" },
  },
  { sequelize, tableName: "insumo" },
);
```

- [x] **Step 14: `src/models/procedimiento-insumo.ts`**

```ts
import { DataTypes, Model, type InferAttributes, type InferCreationAttributes, type NonAttribute } from "sequelize";
import { sequelize } from "@/lib/conexion";
import type { Insumo } from "./insumo";

/** Tabla intermedia N:M: insumos y cantidades usadas en cada procedimiento (F6/F7). */
export class ProcedimientoInsumo extends Model<
  InferAttributes<ProcedimientoInsumo>,
  InferCreationAttributes<ProcedimientoInsumo>
> {
  declare procedimiento_id: number;
  declare insumo_id: number;
  declare cantidad_usada: string;

  declare insumo?: NonAttribute<Insumo>;
}

ProcedimientoInsumo.init(
  {
    procedimiento_id: { type: DataTypes.INTEGER, primaryKey: true },
    insumo_id: { type: DataTypes.INTEGER, primaryKey: true },
    cantidad_usada: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  },
  { sequelize, tableName: "procedimiento_insumo" },
);
```

- [x] **Step 15: `src/models/movimiento-insumo.ts`**

```ts
import { DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes, type NonAttribute } from "sequelize";
import { sequelize } from "@/lib/conexion";
import type { TipoMovimiento } from "@/lib/constantes";
import type { Insumo } from "./insumo";
import type { Procedimiento } from "./procedimiento";
import type { Usuario } from "./usuario";

/** Ingreso o egreso de stock de un insumo, con el usuario que lo registró (F6). */
export class MovimientoInsumo extends Model<InferAttributes<MovimientoInsumo>, InferCreationAttributes<MovimientoInsumo>> {
  declare id: CreationOptional<number>;
  declare tipo: TipoMovimiento;
  declare cantidad: string;
  declare fecha: CreationOptional<Date>;
  declare motivo: CreationOptional<string | null>;
  declare insumo_id: number;
  declare usuario_id: number;
  /** Presente solo en los egresos generados al registrar un procedimiento (F7). */
  declare procedimiento_id: CreationOptional<number | null>;

  declare insumo?: NonAttribute<Insumo>;
  declare usuario?: NonAttribute<Usuario>;
  declare procedimiento?: NonAttribute<Procedimiento | null>;
}

MovimientoInsumo.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    tipo: { type: DataTypes.STRING(10), allowNull: false },
    cantidad: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    fecha: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    motivo: { type: DataTypes.STRING(255), allowNull: true },
    insumo_id: { type: DataTypes.INTEGER, allowNull: false },
    usuario_id: { type: DataTypes.INTEGER, allowNull: false },
    procedimiento_id: { type: DataTypes.INTEGER, allowNull: true },
  },
  { sequelize, tableName: "movimiento_insumo" },
);
```

- [x] **Step 16: `src/models/historial-clinico.ts`**

```ts
import { DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes, type NonAttribute } from "sequelize";
import { sequelize } from "@/lib/conexion";
import type { Procedimiento } from "./procedimiento";

/**
 * Entrada del historial clínico; se crea solo desde F7 (una por procedimiento).
 * El animal y la fecha se obtienen del procedimiento y su turno (F8).
 */
export class HistorialClinico extends Model<InferAttributes<HistorialClinico>, InferCreationAttributes<HistorialClinico>> {
  declare id: CreationOptional<number>;
  declare descripcion: string;
  declare procedimiento_id: number;

  declare procedimiento?: NonAttribute<Procedimiento>;
}

HistorialClinico.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    descripcion: { type: DataTypes.TEXT, allowNull: false },
    procedimiento_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  },
  { sequelize, tableName: "historial_clinico" },
);
```

- [x] **Step 17: `src/models/reporte-avistamiento.ts`**

```ts
import { DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes, type NonAttribute } from "sequelize";
import { sequelize } from "@/lib/conexion";
import type { EstadoAvistamiento } from "@/lib/constantes";
import type { Operativo } from "./operativo";
import type { Usuario } from "./usuario";
import type { Vecino } from "./vecino";
import type { Zona } from "./zona";

/** Aviso de animales sueltos por zona, cargado por el personal y sin GPS (F9). */
export class ReporteAvistamiento extends Model<
  InferAttributes<ReporteAvistamiento>,
  InferCreationAttributes<ReporteAvistamiento>
> {
  declare id: CreationOptional<number>;
  declare fecha: Date;
  declare descripcion: string;
  declare cantidad_animales: number;
  declare direccion_referencia: CreationOptional<string | null>;
  declare estado: CreationOptional<EstadoAvistamiento>;
  declare fecha_atencion: CreationOptional<Date | null>;
  declare zona_id: number;
  declare vecino_id: CreationOptional<number | null>;
  declare usuario_id: number;
  declare operativo_id: CreationOptional<number | null>;

  declare zona?: NonAttribute<Zona>;
  declare vecino?: NonAttribute<Vecino | null>;
  declare usuario?: NonAttribute<Usuario>;
  declare operativo?: NonAttribute<Operativo | null>;
}

ReporteAvistamiento.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    fecha: { type: DataTypes.DATE, allowNull: false },
    descripcion: { type: DataTypes.TEXT, allowNull: false },
    cantidad_animales: { type: DataTypes.INTEGER, allowNull: false },
    direccion_referencia: { type: DataTypes.STRING(150), allowNull: true },
    estado: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "pendiente" },
    fecha_atencion: { type: DataTypes.DATE, allowNull: true },
    zona_id: { type: DataTypes.INTEGER, allowNull: false },
    vecino_id: { type: DataTypes.INTEGER, allowNull: true },
    usuario_id: { type: DataTypes.INTEGER, allowNull: false },
    operativo_id: { type: DataTypes.INTEGER, allowNull: true },
  },
  { sequelize, tableName: "reporte_avistamiento" },
);
```

- [x] **Step 18: `src/models/notificacion.ts`**

```ts
import { DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes, type NonAttribute } from "sequelize";
import { sequelize } from "@/lib/conexion";
import type { EstadoEnvio, TipoNotificacion } from "@/lib/constantes";
import type { Turno } from "./turno";
import type { Vecino } from "./vecino";

/** Notificación por correo al vecino sobre un turno (F12). */
export class Notificacion extends Model<InferAttributes<Notificacion>, InferCreationAttributes<Notificacion>> {
  declare id: CreationOptional<number>;
  declare tipo: TipoNotificacion;
  declare canal: CreationOptional<"email">;
  declare mensaje: string;
  declare estado_envio: CreationOptional<EstadoEnvio>;
  /** Momento a partir del cual el procesador puede enviarla (24 h antes en los recordatorios). */
  declare fecha_programada: Date;
  declare fecha_envio: CreationOptional<Date | null>;
  declare turno_id: number;
  declare vecino_id: number;

  declare turno?: NonAttribute<Turno>;
  declare vecino?: NonAttribute<Vecino>;
}

Notificacion.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    tipo: { type: DataTypes.STRING(20), allowNull: false },
    canal: { type: DataTypes.STRING(10), allowNull: false, defaultValue: "email" },
    mensaje: { type: DataTypes.TEXT, allowNull: false },
    estado_envio: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "pendiente" },
    fecha_programada: { type: DataTypes.DATE, allowNull: false },
    fecha_envio: { type: DataTypes.DATE, allowNull: true },
    turno_id: { type: DataTypes.INTEGER, allowNull: false },
    vecino_id: { type: DataTypes.INTEGER, allowNull: false },
  },
  { sequelize, tableName: "notificacion" },
);
```

- [x] **Step 19: Reemplazar `src/lib/db.ts` con las asociaciones**

```ts
/**
 * Punto de entrada de la capa de datos: importa los 16 modelos, declara sus
 * asociaciones (según el ERD) y los reexporta junto con la instancia de Sequelize.
 * Los servicios deben importar siempre desde aquí para que las asociaciones existan.
 *
 * IMPORTANTE: este módulo depende de `pg`, por lo que nunca debe importarse desde
 * `src/proxy.ts` ni desde código que corra en el Edge Runtime.
 */
import { sequelize } from "./conexion";
import { Animal } from "@/models/animal";
import { HistorialClinico } from "@/models/historial-clinico";
import { Insumo } from "@/models/insumo";
import { MovimientoInsumo } from "@/models/movimiento-insumo";
import { Notificacion } from "@/models/notificacion";
import { Operativo } from "@/models/operativo";
import { OperativoVeterinario } from "@/models/operativo-veterinario";
import { Procedimiento } from "@/models/procedimiento";
import { ProcedimientoInsumo } from "@/models/procedimiento-insumo";
import { ReporteAvistamiento } from "@/models/reporte-avistamiento";
import { Rol } from "@/models/rol";
import { Turno } from "@/models/turno";
import { Usuario } from "@/models/usuario";
import { Vecino } from "@/models/vecino";
import { Veterinario } from "@/models/veterinario";
import { Zona } from "@/models/zona";

/**
 * Declara las asociaciones una sola vez por instancia de Sequelize
 * (la recarga en caliente de Next.js puede volver a evaluar este módulo).
 */
function declararAsociaciones() {
  // Usuarios y roles (F11)
  Rol.hasMany(Usuario, { foreignKey: "rol_id", as: "usuarios" });
  Usuario.belongsTo(Rol, { foreignKey: "rol_id", as: "rol" });

  // Personal actuante ↔ cuenta de acceso (0..1 : 0..1)
  Usuario.hasOne(Veterinario, { foreignKey: "usuario_id", as: "personal" });
  Veterinario.belongsTo(Usuario, { foreignKey: "usuario_id", as: "usuario" });

  // Zonas (F10)
  Zona.hasMany(Vecino, { foreignKey: "zona_id", as: "vecinos" });
  Vecino.belongsTo(Zona, { foreignKey: "zona_id", as: "zona" });
  Zona.hasMany(Operativo, { foreignKey: "zona_id", as: "operativos" });
  Operativo.belongsTo(Zona, { foreignKey: "zona_id", as: "zona" });
  Zona.hasMany(ReporteAvistamiento, { foreignKey: "zona_id", as: "reportes" });
  ReporteAvistamiento.belongsTo(Zona, { foreignKey: "zona_id", as: "zona" });

  // Vecinos y animales (F1/F2)
  Vecino.hasMany(Animal, { foreignKey: "vecino_id", as: "animales" });
  Animal.belongsTo(Vecino, { foreignKey: "vecino_id", as: "vecino" });

  // Operativos ↔ personal (N:M a través de operativo_veterinario)
  Operativo.belongsToMany(Veterinario, {
    through: OperativoVeterinario,
    foreignKey: "operativo_id",
    otherKey: "veterinario_id",
    as: "personal",
  });
  Veterinario.belongsToMany(Operativo, {
    through: OperativoVeterinario,
    foreignKey: "veterinario_id",
    otherKey: "operativo_id",
    as: "operativos",
  });
  Operativo.belongsTo(Usuario, { foreignKey: "usuario_cancelacion_id", as: "usuarioCancelacion" });

  // Turnos (F3)
  Animal.hasMany(Turno, { foreignKey: "animal_id", as: "turnos" });
  Turno.belongsTo(Animal, { foreignKey: "animal_id", as: "animal" });
  Operativo.hasMany(Turno, { foreignKey: "operativo_id", as: "turnos" });
  Turno.belongsTo(Operativo, { foreignKey: "operativo_id", as: "operativo" });

  // Procedimientos (F7) e historial (F8)
  Turno.hasOne(Procedimiento, { foreignKey: "turno_id", as: "procedimiento" });
  Procedimiento.belongsTo(Turno, { foreignKey: "turno_id", as: "turno" });
  Veterinario.hasMany(Procedimiento, { foreignKey: "veterinario_id", as: "procedimientos" });
  Procedimiento.belongsTo(Veterinario, { foreignKey: "veterinario_id", as: "veterinario" });
  Procedimiento.hasOne(HistorialClinico, { foreignKey: "procedimiento_id", as: "historial" });
  HistorialClinico.belongsTo(Procedimiento, { foreignKey: "procedimiento_id", as: "procedimiento" });

  // Insumos (F6): uso por procedimiento (N:M con cantidad) y movimientos de stock
  Procedimiento.belongsToMany(Insumo, {
    through: ProcedimientoInsumo,
    foreignKey: "procedimiento_id",
    otherKey: "insumo_id",
    as: "insumos",
  });
  Insumo.belongsToMany(Procedimiento, {
    through: ProcedimientoInsumo,
    foreignKey: "insumo_id",
    otherKey: "procedimiento_id",
    as: "procedimientos",
  });
  Procedimiento.hasMany(ProcedimientoInsumo, { foreignKey: "procedimiento_id", as: "detalleInsumos" });
  ProcedimientoInsumo.belongsTo(Insumo, { foreignKey: "insumo_id", as: "insumo" });
  Insumo.hasMany(MovimientoInsumo, { foreignKey: "insumo_id", as: "movimientos" });
  MovimientoInsumo.belongsTo(Insumo, { foreignKey: "insumo_id", as: "insumo" });
  Usuario.hasMany(MovimientoInsumo, { foreignKey: "usuario_id", as: "movimientos" });
  MovimientoInsumo.belongsTo(Usuario, { foreignKey: "usuario_id", as: "usuario" });
  Procedimiento.hasMany(MovimientoInsumo, { foreignKey: "procedimiento_id", as: "movimientos" });
  MovimientoInsumo.belongsTo(Procedimiento, { foreignKey: "procedimiento_id", as: "procedimiento" });

  // Avistamientos (F9)
  Vecino.hasMany(ReporteAvistamiento, { foreignKey: "vecino_id", as: "reportes" });
  ReporteAvistamiento.belongsTo(Vecino, { foreignKey: "vecino_id", as: "vecino" });
  Usuario.hasMany(ReporteAvistamiento, { foreignKey: "usuario_id", as: "reportes" });
  ReporteAvistamiento.belongsTo(Usuario, { foreignKey: "usuario_id", as: "usuario" });
  Operativo.hasMany(ReporteAvistamiento, { foreignKey: "operativo_id", as: "reportes" });
  ReporteAvistamiento.belongsTo(Operativo, { foreignKey: "operativo_id", as: "operativo" });

  // Notificaciones (F12)
  Turno.hasMany(Notificacion, { foreignKey: "turno_id", as: "notificaciones" });
  Notificacion.belongsTo(Turno, { foreignKey: "turno_id", as: "turno" });
  Vecino.hasMany(Notificacion, { foreignKey: "vecino_id", as: "notificaciones" });
  Notificacion.belongsTo(Vecino, { foreignKey: "vecino_id", as: "vecino" });
}

// Si Rol ya tiene la asociación "usuarios", este módulo ya fue inicializado.
if (!Rol.associations.usuarios) {
  declararAsociaciones();
}

export {
  sequelize,
  Animal, HistorialClinico, Insumo, MovimientoInsumo, Notificacion, Operativo, OperativoVeterinario,
  Procedimiento, ProcedimientoInsumo, ReporteAvistamiento, Rol, Turno, Usuario, Vecino, Veterinario, Zona,
};
```

- [x] **Step 20: Correr los tests de modelos**

Run: `npx vitest run tests/db/modelos.test.ts`
Expected: PASS (3 tests).

- [x] **Step 21: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

---

### Task 8: Datos iniciales (seed)

**Files:**
- Modify: `db/seeders/inicial.ts`
- Test: `tests/db/seed.test.ts`

- [x] **Step 1: Escribir el test que falla `tests/db/seed.test.ts`**

```ts
import { afterAll, describe, expect, it } from "vitest";
import { Rol, sequelize, Usuario, Zona } from "@/lib/db";

afterAll(() => sequelize.close());

// La base de test se reinicia con `db:reset:test`, que ejecuta el seed inicial.
describe("seed inicial", () => {
  it("carga los tres roles", async () => {
    const roles = await Rol.findAll({ order: [["nombre", "ASC"]] });
    expect(roles.map((rol) => rol.nombre)).toEqual(["administrador", "operador", "veterinario"]);
  });

  it("crea el administrador inicial con la contraseña hasheada", async () => {
    const admin = await Usuario.scope("conPassword").findOne({
      where: { email: process.env.SEED_ADMIN_EMAIL },
      include: ["rol"],
    });
    expect(admin?.rol?.nombre).toBe("administrador");
    expect(admin?.password_hash).toMatch(/^\$2[aby]\$/);
  });

  it("carga las zonas de Río Grande", async () => {
    expect(await Zona.count()).toBeGreaterThanOrEqual(10);
  });
});
```

- [x] **Step 2: Correr y verificar que falla**

Run: `npx vitest run tests/db/seed.test.ts`
Expected: FAIL — no hay roles (lista vacía).

- [x] **Step 3: Implementar `db/seeders/inicial.ts`**

```ts
import bcrypt from "bcryptjs";
import { Rol, Usuario, Zona } from "@/lib/db";
import { ROLES } from "@/lib/constantes";

/** Barrios de Río Grande usados como zonas administrativas iniciales. */
const ZONAS_RIO_GRANDE = [
  "Centro", "Chacra II", "Chacra IV", "Chacra XI", "Chacra XIII", "Austral",
  "Mutual", "Malvinas Argentinas", "Los Cisnes", "Vapor Amadeo", "Margen Sur", "Aeropuerto",
];

/**
 * Carga los datos mínimos para operar el sistema: roles, administrador inicial y zonas.
 * Es idempotente: usa findOrCreate, así que puede ejecutarse varias veces sin duplicar.
 */
export async function sembrarDatosIniciales(): Promise<void> {
  // 1) Roles del sistema.
  for (const nombre of ROLES) {
    await Rol.findOrCreate({ where: { nombre } });
  }

  // 2) Administrador inicial (credenciales tomadas de .env).
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("Faltan SEED_ADMIN_EMAIL y/o SEED_ADMIN_PASSWORD en el archivo .env");
  }
  const rolAdministrador = await Rol.findOne({ where: { nombre: "administrador" } });
  await Usuario.findOrCreate({
    where: { email },
    defaults: {
      nombre: "Administrador",
      apellido: "SIGCAN",
      email,
      password_hash: await bcrypt.hash(password, 10),
      rol_id: rolAdministrador!.id,
    },
  });

  // 3) Zonas administrativas.
  for (const nombre of ZONAS_RIO_GRANDE) {
    await Zona.findOrCreate({ where: { nombre } });
  }
}
```

- [x] **Step 4: Correr toda la suite**

Run: `npm test`
Expected: PASS — 3 archivos, 12 tests.

- [x] **Step 5: Sembrar la base de desarrollo**

Run: `npm run db:reset`
Expected: `Base reiniciada: 1 migraciones aplicadas y datos iniciales cargados`

Run: `docker exec sigcan-db psql -U sigcan -d sigcan -c "SELECT (SELECT count(*) FROM rol) roles, (SELECT count(*) FROM usuario) usuarios, (SELECT count(*) FROM zona) zonas;"`
Expected: `3 | 1 | 12`

---

### Task 9: Integración con Next.js — salud, página inicial y shadcn/ui

**Files:**
- Create: `src/app/api/salud/route.ts`
- Modify: `src/app/layout.tsx`, `src/app/page.tsx`
- Create (por la CLI de shadcn): `components.json`, `src/lib/utils.ts`, `src/components/ui/button.tsx`

- [x] **Step 1: `src/app/api/salud/route.ts`**

```ts
import { NextResponse } from "next/server";
import { sequelize } from "@/lib/db";

/**
 * GET /api/salud
 * Verifica que la aplicación pueda conectarse a PostgreSQL a través de Sequelize.
 * Responde 200 si la conexión funciona y 503 si no.
 */
export async function GET() {
  try {
    await sequelize.authenticate();
    return NextResponse.json({ estado: "ok", baseDeDatos: "conectada" });
  } catch {
    return NextResponse.json({ estado: "error", baseDeDatos: "sin conexión" }, { status: 503 });
  }
}
```

- [x] **Step 2: Inicializar shadcn/ui con Base UI**

Run: `npx shadcn@latest init --help`
Elegir las opciones no interactivas que correspondan a: librería de componentes **Base UI** (según la Fase 2), color base **neutral**, sin sobrescribir `globals.css` salvo lo que la CLI agregue. Luego:

Run: `npx shadcn@latest add button`
Expected: se crean `components.json`, `src/lib/utils.ts` y `src/components/ui/button.tsx`.

- [x] **Step 3: `src/app/layout.tsx`** — en el archivo generado, cambiar `lang="en"` por `lang="es"` y reemplazar `metadata` por:

```ts
export const metadata: Metadata = {
  title: "SIGCAN — Castración y Chipeo Animal",
  description: "Sistema de Gestión de Castración y Chipeo Animal del Municipio de Río Grande",
};
```

- [x] **Step 4: Reemplazar `src/app/page.tsx`** (página provisoria; en la Fase 1 redirige al login)

```tsx
import { Button } from "@/components/ui/button";

/** Página provisoria de la Fase 0: confirma que el frontend y los estilos funcionan. */
export default function Inicio() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-3xl font-semibold">SIGCAN</h1>
      <p className="text-muted-foreground">Sistema de Gestión de Castración y Chipeo Animal — Río Grande</p>
      <Button render={<a href="/api/salud" />}>Verificar conexión con la base de datos</Button>
    </main>
  );
}
```

> Si la versión instalada de `button` usa Radix (`asChild`) en lugar de Base UI (`render`), adaptar esa única prop según el componente generado.

- [x] **Step 5: Verificar en el navegador**

Run: `npm run dev` (en segundo plano) y abrir `http://localhost:3000/api/salud`
Expected: `{"estado":"ok","baseDeDatos":"conectada"}`. La página `/` muestra el título y el botón con estilos.

- [x] **Step 6: Verificar el build de producción**

Run: `npm run build`
Expected: compila sin errores de tipos ni de bundling de Sequelize.

---

### Task 10: README, refactorización y cierre de fase

**Files:**
- Create: `README.md` (reemplaza el generado)

- [x] **Step 1: `README.md`**

````markdown
# SIGCAN — Sistema de Gestión de Castración y Chipeo Animal (Río Grande)

Trabajo Final Integrador — Tecnicatura Superior en Programación, UTN FRTDF.
Integrantes: Marcos Sebastián Albornoz, Cesar Segovia.

## Stack

Next.js 16 (App Router) + TypeScript · PostgreSQL 18 · Sequelize · Tailwind CSS v4 + shadcn/ui · JWT (jose) · bcryptjs · Vitest.

## Requisitos

- Node.js 20.9 o superior
- Docker Desktop

## Instalación

```bash
npm install
cp .env.example .env          # completar JWT_SECRET, CRON_SECRET y SMTP_*
docker compose up -d          # PostgreSQL 18 en localhost:5433 (bases sigcan y sigcan_test)
npm run db:reset              # crea el esquema y carga los datos iniciales
npm run dev                   # http://localhost:3000
```

Usuario inicial: el definido en `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` (por defecto `admin@sigcan.local` / `Admin1234`).

## Scripts

| Script | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `npm start` | Build y ejecución de producción |
| `npm run lint` | ESLint |
| `npm test` | Tests automáticos (recrean la base `sigcan_test`) |
| `npm run db:migrar` | Aplica migraciones pendientes |
| `npm run db:seed` | Carga datos iniciales (idempotente) |
| `npm run db:reset` | Borra la base de desarrollo, migra y siembra |

## Estructura

```
db/            migraciones y seeders
scripts/       CLI de base de datos
src/app/       páginas y API REST (Route Handlers)
src/lib/       conexión, asociaciones, utilidades
src/models/    un modelo Sequelize por tabla del ERD
tests/         tests automáticos (Vitest)
docs/          diseño y planes de implementación
```
````

- [x] **Step 2: Pasada de refactorización** (según `CLAUDE.md`)

Revisar lo construido en la fase y corregir: duplicación entre modelos o scripts, comentarios faltantes o redundantes, nombres poco claros, imports sin uso. Mantener los cambios acotados a la Fase 0.

- [x] **Step 3: Verificación final**

Run: `npm run lint && npx tsc --noEmit && npm test && npm run build`
Expected: todo sin errores; 12 tests en verde.

- [x] **Step 4: Punto de control (sin git)**

Detenerse e informar al usuario: archivos creados, resultados de la verificación y que la Fase 0 está lista para que él haga el commit. No ejecutar comandos de git.
