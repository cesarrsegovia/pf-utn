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
