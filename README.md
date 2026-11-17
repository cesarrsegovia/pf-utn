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

Next.js 16.4 (App Router, Turbopack) + TypeScript · PostgreSQL 18 · Sequelize · Tailwind CSS v4 + shadcn/ui · Recharts · JWT (jose) · bcryptjs · Nodemailer · Vitest.

## Requisitos

- Node.js 20.9 o superior (probado con 20.19).
- Docker Desktop **en ejecución** (la base de datos corre en un contenedor).
- Puertos libres: `3000` (aplicación) y `5433` (PostgreSQL; se usa 5433 para no chocar con un PostgreSQL local en 5432).

## Instalación desde cero

Desde la carpeta del proyecto:

```bash
# 1. Dependencias (respeta las versiones exactas de package-lock.json)
npm ci

# 2. Variables de entorno
cp .env.example .env          # en PowerShell: Copy-Item .env.example .env
#    Completar en .env: JWT_SECRET y CRON_SECRET (textos largos y aleatorios).
#    SMTP_USER y SMTP_PASS son opcionales (ver "Notificaciones por correo").

# 3. Base de datos: PostgreSQL 18 con las bases sigcan (desarrollo) y sigcan_test (tests)
docker compose up -d

# 4. Esquema y datos: aplica las migraciones, carga los datos iniciales y el escenario de demostración
npm run db:demo

# 5. Aplicación
npm run dev                   # http://localhost:3000
```

Para empezar con una base vacía (solo roles, administrador y zonas), usar `npm run db:reset` en
lugar de `npm run db:demo`.

> La primera vez que se crea el contenedor, `docker/init/01-crear-base-test.sql` crea la base
> `sigcan_test`. Si el volumen ya existía de antes, ese script no se vuelve a ejecutar: ver
> "Problemas frecuentes".

## Actualizar una instalación existente

Después de traer cambios del repositorio:

```bash
npm ci                        # por si cambiaron las dependencias
docker compose up -d          # si el contenedor estaba detenido
npm run db:migrar             # aplica solo las migraciones nuevas, sin borrar datos
npm run dev
```

Las migraciones están en `db/migrations/` y se registran en la tabla `migraciones_aplicadas`, de
modo que cada una se ejecuta una sola vez. `npm run db:migrar` **conserva los datos**; en cambio,
`db:reset` y `db:demo` **borran la base de desarrollo** y la vuelven a crear.

## Ejecución en modo producción

```bash
npm run build
npm start                     # http://localhost:3000
```

Usa la misma base y el mismo `.env` que el modo desarrollo. Al iniciar el servidor arranca el
procesador de notificaciones (si el correo está configurado).

## Datos de demostración

`npm run db:demo` **borra la base de desarrollo** y carga un escenario con fechas relativas al día
de ejecución: 30 vecinos en 6 zonas, 50 animales, 8 operativos realizados, 2 cancelados, uno
**de hoy** listo para iniciar y 3 futuros, insumos con consumo real y 18 avistamientos.
**Ejecutarlo el mismo día de la demostración**: con datos de otro día no hay operativo "de hoy".

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
Con el correo configurado, un procesador interno envía las pendientes cada minuto; sin él, quedan
registradas como pendientes y la pantalla de Notificaciones lo indica. El envío también se puede
forzar desde Notificaciones → "Procesar pendientes" o con `POST /api/notificaciones/procesar` y el
encabezado `Authorization: Bearer <CRON_SECRET>`. En la demo, solo la vecina "Prueba Correo"
(perro "Toby") tiene email.

## Scripts

| Script | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `npm start` | Build y ejecución de producción |
| `npm run lint` | ESLint |
| `npm test` | Tests automáticos (recrean la base `sigcan_test`; requieren el contenedor en ejecución) |
| `npm run db:migrar` | Aplica las migraciones pendientes (conserva los datos) |
| `npm run db:seed` | Carga datos iniciales (idempotente) |
| `npm run db:reset` | Borra la base de desarrollo, migra y siembra los datos iniciales |
| `npm run db:demo` | Igual que `db:reset` y además carga los datos de demostración |
| `npm run db:reset:test` / `npm run db:demo:test` | Lo mismo sobre la base de test |

## Verificación

- **Tests automáticos:** `npm test` (161 tests: servicios, reglas de negocio, restricciones de la base y escenario de demostración).
- **Pruebas de humo** contra el build de producción (`tests/humo/fase3.mjs` a `fase6.mjs`): ver las instrucciones al comienzo de cada archivo.
- **Recorridos por rol y prueba funcional:** `docs/verificacion/`.

## Problemas frecuentes

| Síntoma | Solución |
|---|---|
| `npm test` falla con `database "sigcan_test" does not exist` | El volumen de Docker es anterior al script de inicio. Crear la base a mano: `docker exec sigcan-db psql -U sigcan -d sigcan -c "CREATE DATABASE sigcan_test OWNER sigcan;"` |
| `ECONNREFUSED` en el puerto 5433 | Docker Desktop o el contenedor están detenidos: abrir Docker Desktop y ejecutar `docker compose up -d`. |
| La página se recarga sola sin parar, los estilos no se actualizan o aparece un error de compilación de Next.js | Caché de desarrollo dañada: detener `npm run dev`, borrar la carpeta `.next/dev` y volver a iniciar. |
| El puerto 3000 está ocupado | Quedó un servidor anterior en ejecución: cerrarlo (en Windows, `Get-NetTCPConnection -LocalPort 3000` muestra el proceso) o usar `npx next dev -p 3001`. |
| El inicio no muestra un operativo "de hoy" | Los datos de demostración son de otro día: ejecutar `npm run db:demo`. |

## Estructura

```
db/            migraciones y seeders (inicial y demostración)
docker/        script de inicio de PostgreSQL (crea la base de test)
scripts/       CLI de base de datos
src/app/       páginas (panel por rol) y API REST (Route Handlers)
src/components/ componentes de interfaz por módulo y comunes
src/services/  lógica de negocio (transacciones y reglas)
src/schemas/   validación (Zod) compartida entre cliente y servidor
src/lib/       conexión, asociaciones, permisos, fechas, correo y utilidades
src/models/    un modelo Sequelize por tabla del ERD
tests/         tests automáticos (Vitest) y pruebas de humo
docs/          consigna, diseño, planes y verificación (no se versiona: ver .gitignore)
```
