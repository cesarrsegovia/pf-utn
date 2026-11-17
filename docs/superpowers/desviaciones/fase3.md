# Registro de desviaciones — Fase 3 (Operativos, turnos y notificaciones)

## Desviaciones respecto del plan

### 1. `src/services/turnos.ts` — indexación de mapas de etiquetas con `CreationOptional` (TS7053)

- **Archivo:** `src/services/turnos.ts` (líneas 117, 134 y 208 del código del plan).
- **Qué decía el plan:**
  - `ETIQUETAS_ESTADO_TURNO[turno.estado].toLowerCase()` (en `exigirActivo` y `confirmarTurno`).
  - `ETIQUETAS_ESTADO_OPERATIVO[operativo.estado].toLowerCase()` (en `validarDisponibilidad`).
- **Qué se cambió:** se agregó `type EstadoOperativo` al import de `@/lib/constantes` y se convirtió el índice con `as EstadoTurno` y `as EstadoOperativo` respectivamente (`ETIQUETAS_ESTADO_TURNO[turno.estado as EstadoTurno]` y `ETIQUETAS_ESTADO_OPERATIVO[operativo.estado as EstadoOperativo]`).
- **Por qué:** en los modelos `Turno` y `Operativo`, la columna `estado` está tipada como `CreationOptional<EstadoTurno>` y `CreationOptional<EstadoOperativo>`. En Sequelize 6, `CreationOptional<T>` es una intersección con una marca (`T & { [CreationAttributeBrand]?: true }`), por lo que TypeScript rechaza usarla directamente como índice de un `Record<T, string>` con el error `TS7053` al ejecutar `npx tsc --noEmit`.

## Verificación

- `npx tsc --noEmit`: 0 errores.
- `npm run lint`: 0 errores, 1 advertencia previa aceptada (`src/lib/cliente-api.ts`, Fase 1).
- `npm test`: **118/118 tests pasando** en **16 archivos** (75 previos de Fases 1–2 + 6 en `tests/lib/dominio-fase3.test.ts` + 5 en `tests/services/notificaciones.test.ts` + 16 en `tests/services/operativos.test.ts` + 16 en `tests/services/turnos.test.ts`).
- `npm run build`: compilación de producción y generación de rutas exitosas sin errores.
- Prueba de humo (`node tests/humo/fase3.mjs http://localhost:3107` contra `next start` y `sigcan_test`): **25/25 verificaciones OK** (`Prueba de humo de la Fase 3: OK`), cubriendo controles de acceso (401), login, alta de datos base, validación y alta de operativo, opciones para selectores, solicitud y duplicado de turno (409), confirmación y generación de notificaciones, procesamiento con `CRON_SECRET`, reintento (204), reprogramación, cancelación de turno y operativo, bloqueo de edición de operativo cancelado (409) y renderizado de páginas (`/operativos`, `/operativos/[id]`, `/turnos`, `/notificaciones`).
- **Pendiente (manual por el usuario):**
  - Prueba de envío de correo real con credenciales SMTP configuradas en `.env` (Step 6).
  - Recorrido manual en navegador por rol (`administrador`, `operador`, `veterinario`) (Step 7).

## Revisión de cierre (subagente revisor)

### Hallazgos
- Fidelidad plan vs. código verificada por comparación automática de cada bloque de código del plan contra su archivo: los 3 servicios nuevos, `mailer.ts`, `procesador-notificaciones.ts`, `instrumentation.ts`, las 15 rutas de API, todos los componentes y páginas, los esquemas, `navegacion.ts`, `badges-dominio.tsx`, `tests/humo/fase3.mjs` y los 4 archivos de test nuevos son **idénticos al plan**. Los bloques "modificar" (constantes, fechas, etiquetas, comun, animales, personal, formulario-dialogo, fabricas, vecinos, next.config) contienen todas las líneas del plan.
- `package.json` tiene `"nodemailer": "10.2.1"` exacto y no existe `@types/nodemailer`; `next.config.ts` incluye `nodemailer` en `serverExternalPackages`.
- Única desviación real: la de `turnos.ts` (TS7053), ya documentada arriba y comentada en el código.
- Task 13 Step 2: no quedan literales de estados activos/con cupo, `.slice(0, 5)` ni "Sin nombre" fuera de lo permitido (la columna "Nombre" de `gestion-animales.tsx`, de la Fase 2, muestra "Sin nombre" a propósito y no se tocó).
- Permisos de las 15 rutas y botones ocultos por rol coinciden con `src/lib/permisos.ts`.

### Correcciones
- `src/services/operativos.ts` (`cancelarTurnosActivos`): se agregó `lock: transaction.LOCK.UPDATE` a la consulta de turnos activos (sin `include`). Motivo: confirmar/cancelar un turno solo bloquea el turno, no el operativo; sin el bloqueo, una cancelación de operativo concurrente podía leer un turno como activo y pisar su estado.

### Verificación
- `npx tsc --noEmit`: 0 errores. `npm run lint`: 0 errores, 1 advertencia previa (`src/lib/cliente-api.ts`).
- `npm test`: 118/118 en 16 archivos. `npm run db:reset:test` y `npm run build`: OK.
- Prueba de humo contra `next start` en :3107 y `sigcan_test` con SMTP vacío: "Prueba de humo de la Fase 3: OK" (25 verificaciones); servidor detenido.
- No verificado: envío real por SMTP y recorrido manual por rol (requieren al usuario).
