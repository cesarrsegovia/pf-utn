# SIGCAN — Sistema de Gestión de Castración y Chipeo Animal (Río Grande)

Trabajo Final Integrador — Tecnicatura Superior en Programación, UTN FRTDF.
Integrantes: Marcos Sebastián Albornoz, Cesar Segovia.

Sistema web para el área de Zoonosis del Municipio de Río Grande: registra vecinos y animales,
organiza operativos de castración y chipeo con turnos y cupos, registra los procedimientos con
su consumo de insumos e historial clínico, notifica a los vecinos por correo y genera
indicadores del programa.

## Funcionalidades

| N° | Funcionalidad | Roles |
|---|---|---|
| F1 | Vecinos (alta, búsqueda, baja lógica con cancelación de turnos) | Administrador, operador; consulta: veterinario |
| F2 | Animales (con tutor, callejeros y asilvestrados) | Administrador, operador; consulta: veterinario |
| F3 | Turnos (cupo, turno único por animal, confirmación, reprogramación, cancelación) | Administrador, operador |
| F4 | Operativos (estados, personal asignado, cancelación con 48 h o fuerza mayor) | Administrador, operador; cancelación: administrador |
| F5 | Personal veterinario | Administrador |
| F6 | Insumos (stock, mínimos, ingresos y egresos) | Administrador, operador |
| F7 | Procedimientos (transacción: stock, animal, turno, historial) | Veterinario |
| F8 | Historial clínico | Todos |
| F9 | Avistamientos | Administrador, operador; consulta: veterinario |
| F10 | Zonas | Administrador |
| F11 | Usuarios y roles | Administrador |
| F12 | Notificaciones por correo (confirmación, recordatorio, reprogramación, cancelación) | Administrador, operador |
| F13 | Reportes estadísticos (cinco indicadores por zona y período) | Administrador, operador |

## Stack

Next.js 16 (App Router) + TypeScript · PostgreSQL 18 · Sequelize · Tailwind CSS v4 + shadcn/ui · Recharts · JWT (jose) · bcryptjs · Nodemailer · Vitest.

## Requisitos

- Node.js 20.9 o superior
- Docker Desktop

## Instalación

```bash
npm install
cp .env.example .env          # completar JWT_SECRET y CRON_SECRET (y SMTP_* para enviar correos)
docker compose up -d          # PostgreSQL 18 en localhost:5433 (bases sigcan y sigcan_test)
npm run db:demo               # crea el esquema y carga los datos de demostración
npm run dev                   # http://localhost:3000
```

Para una base vacía (solo roles, administrador y zonas), usar `npm run db:reset` en lugar de `npm run db:demo`.

## Datos de demostración

`npm run db:demo` **borra la base de desarrollo** y carga un escenario con fechas relativas al día
de ejecución: 30 vecinos en 6 zonas, 50 animales, 8 operativos realizados, 2 cancelados, uno
**de hoy** listo para iniciar y 3 futuros, insumos con consumo real y 18 avistamientos.
Conviene ejecutarlo el mismo día de la demostración.

| Rol | Email | Contraseña |
|---|---|---|
| Administrador | `admin@sigcan.local` | `Admin1234` |
| Operador | `operador@sigcan.local` | `Operador1234` |
| Veterinaria (asignada al operativo de hoy) | `veterinaria@sigcan.local` | `Veterinaria1234` |
| Veterinario | `veterinario@sigcan.local` | `Veterinario1234` |

El administrador se toma de `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` (valores por defecto arriba).

## Notificaciones por correo (F12)

Las notificaciones se registran siempre; se envían si están completos `SMTP_HOST`, `SMTP_USER` y
`SMTP_PASS` en `.env` (con Gmail: `smtp.gmail.com`, puerto 465 y una contraseña de aplicación).
Un procesador interno envía las pendientes periódicamente; también se puede forzar desde
Notificaciones → "Procesar pendientes" o con `POST /api/notificaciones/procesar` y el encabezado
`Authorization: Bearer <CRON_SECRET>`. En la demo, solo la vecina "Prueba Correo" (perro "Toby")
tiene email.

## Scripts

| Script | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `npm start` | Build y ejecución de producción |
| `npm run lint` | ESLint |
| `npm test` | Tests automáticos (recrean la base `sigcan_test`) |
| `npm run db:migrar` | Aplica migraciones pendientes |
| `npm run db:seed` | Carga datos iniciales (idempotente) |
| `npm run db:reset` | Borra la base de desarrollo, migra y siembra los datos iniciales |
| `npm run db:demo` | Igual que `db:reset` y además carga los datos de demostración |
| `npm run db:reset:test` / `npm run db:demo:test` | Lo mismo sobre la base de test |

## Verificación

- **Tests automáticos:** `npm test` (158 tests: servicios, reglas de negocio, restricciones de la base y escenario de demostración).
- **Pruebas de humo** contra el build de producción (`tests/humo/fase3.mjs` a `fase6.mjs`): ver las instrucciones al comienzo de cada archivo.
- **Recorridos por rol:** `docs/verificacion/recorridos.md`.

## Estructura

```
db/            migraciones y seeders (inicial y demostración)
scripts/       CLI de base de datos
src/app/       páginas (panel por rol) y API REST (Route Handlers)
src/components/ componentes de interfaz por módulo y comunes
src/services/  lógica de negocio (transacciones y reglas)
src/schemas/   validación (Zod) compartida entre cliente y servidor
src/lib/       conexión, asociaciones, permisos, fechas, correo y utilidades
src/models/    un modelo Sequelize por tabla del ERD
tests/         tests automáticos (Vitest) y pruebas de humo
docs/          consigna, diseño, planes, recorridos de verificación
```
