# Registro de desviaciones — Fase 4 (Procedimiento e historial clínico)

## Desviaciones respecto del plan

Sin desviaciones. Todos los archivos creados y modificados en la Fase 4 coinciden exactamente con los bloques del plan.

## Revisión de duplicación y lecciones (Task 9, Step 1)

- **Descuentos de stock en `src/services/`:** verificado que toda modificación de stock pasa exclusivamente por `ajustarStock()` (invocada desde `descontarPorProcedimiento()` y `registrarMovimiento()`).
- **Literales de tipos de procedimiento (`"castracion"`, `"chipeo"`):** verificado que solo aparecen en `src/lib/constantes.ts` (`TIPOS_PROCEDIMIENTO`, `incluyeCastracion()`, `incluyeChipeo()`, `tipoIncluido()`) y en `src/lib/etiquetas.ts` (`ETIQUETAS_TIPO_PROCEDIMIENTO`).
- **Indexación de `ETIQUETAS_*` con `CreationOptional` (L1):** verificado que todos los accesos sobre columnas `CreationOptional` tienen su cast correspondiente (`as EstadoTurno`, `as EstadoOperativo`).
- **Autocomparación L3:** todos los archivos nuevos (`tests/lib/dominio-fase4.test.ts`, `src/schemas/procedimientos.ts`, `src/schemas/historial.ts`, `tests/services/procedimientos.test.ts`, `src/services/procedimientos.ts`, `tests/services/historial.test.ts`, `src/services/historial.ts`, `src/app/api/procedimientos/route.ts`, `src/app/api/procedimientos/turnos/route.ts`, `src/app/api/historial/route.ts`, `src/app/api/insumos/opciones/route.ts`, `src/components/procedimientos/formulario-procedimiento.tsx`, `src/components/procedimientos/turnos-para-atender.tsx`, `src/app/(panel)/procedimientos/page.tsx`, `src/components/historial/historial-clinico.tsx`, `src/app/(panel)/historial/page.tsx`, `tests/humo/fase4.mjs`) y todos los archivos modificados (`src/lib/constantes.ts`, `src/services/insumos.ts`, `src/services/turnos.ts`, `tests/helpers/fabricas.ts`, `src/lib/navegacion.ts`, `src/components/animales/gestion-animales.tsx`) coinciden exactamente con el plan.

## Verificación

- `npx tsc --noEmit`: 0 errores.
- `npm run lint`: 0 errores, 1 advertencia previa aceptada (`src/lib/cliente-api.ts`, Fase 1).
- `npm test`: **131/131 tests pasando** en **19 archivos** (118 previos de Fases 1–3 + 1 en `tests/lib/dominio-fase4.test.ts` + 9 en `tests/services/procedimientos.test.ts` + 3 en `tests/services/historial.test.ts`).
- `npm run build`: compilación de producción y generación de rutas exitosas sin errores.
- Prueba de humo de la Fase 4 (`node tests/humo/fase4.mjs http://localhost:3107` contra `next start` y `sigcan_test`): **27/27 verificaciones OK** (`Prueba de humo de la Fase 4: OK`), cubriendo preparación de datos base, usuario veterinario y vínculo con personal, operativo en curso y turno confirmado, control de permisos (403 para administrador, 401 sin sesión), listado de turnos atendibles, rollback completo por stock insuficiente (409 y stock intacto en `10.00`), validación de chip (400), registro exitoso (201), bloqueo de doble registro (409), descuento de stock (`7.50`), actualización del animal (`castrado: true` y `numero_chip`), creación de entrada en el historial clínico, exclusión del turno ya completado de la bandeja de atención y renderizado de páginas (`/procedimientos`, `/historial`, `/historial?animal=1`).
- Prueba de humo de regresión de la Fase 3 (`node tests/humo/fase3.mjs http://localhost:3107` contra `next start` y `sigcan_test`): **25/25 verificaciones OK** (`Prueba de humo de la Fase 3: OK`).
- **Pendiente (manual por el usuario):**
  - Recorrido manual en navegador por rol (`veterinario` vinculado y asignado, `veterinario` sin vínculo, `administrador` y `operador`) (Task 9, Step 5).

## Revisión del supervisor (29/10)

### Resultado por tarea
- **Tasks 1–8:** verificadas con comparación automática de cada bloque de código del plan contra su archivo. Idénticos al plan (salvo espacios): `dominio-fase4.test.ts`, esquemas de procedimientos e historial, servicios `procedimientos.ts` e `historial.ts`, sus dos tests, las 4 rutas de API, los 3 componentes/páginas de procedimientos, el componente y la página de historial. Los bloques "modificar" (`constantes.ts`, `insumos.ts`, `turnos.ts`, `fabricas.ts`, `navegacion.ts`, `gestion-animales.tsx`) contienen todas las líneas del plan; las únicas líneas "ausentes" son las dos de import de `insumos.ts` y la de `fabricas.ts` que el plan manda reemplazar (correcto).
- **Task 9:** `fase4.md` existía; la prueba de humo existe y es idéntica al plan.

### Desviaciones encontradas
- (a) Equivalentes/inocuas: ninguna. (b) Justificadas y documentadas: ninguna. (c) No documentadas: ninguna. (d) Errores: ninguno.
- Puntos críticos de F7 verificados: orden operativo (SHARE) → turno (UPDATE) → animal (UPDATE) → insumos por id ascendente (UPDATE); ningún `lock` combinado con `include`; lecturas previas a modificar bloqueadas (la lectura inicial del turno solo toma `operativo_id`, columna inmutable, y se relee bloqueada); una sola transacción con `HistorialClinico.create` como último paso; tests de atomicidad (stock en segundo insumo, chip duplicado, falla forzada del historial) presentes; veterinario no habilitado → `ProhibidoError`; `anularRecordatorios` dentro de la transacción; casts `as EstadoTurno`/`as EstadoOperativo` presentes (L1).
- F8: orden ASC con filtro por animal y DESC sin filtro; filtros de tipo, fechas (días locales completos) y búsqueda; solo lectura (no hay POST/PUT/DELETE); enlace "Ver historial" en gestión de animales.
- Permisos: `/api/procedimientos` y `/api/procedimientos/turnos` exigen `procedimientos:registrar` (solo veterinario; administrador y operador reciben 403), `/api/historial` exige `historial:ver` (todos los roles), `/api/insumos/opciones` exige `insumos:ver`; sin sesión, 401 (probado en la prueba de humo).

### Correcciones
- Ninguna necesaria en lógica de negocio.

### Refactors aplicados
- `src/components/historial/historial-clinico.tsx`: los dos `<Input type="date">` idénticos (Desde/Hasta) se extrajeron al componente local `FiltroFecha`. Sin cambio de comportamiento ni de contratos.

### Verificación final (corrida por el supervisor, tras el refactor)
- `npx tsc --noEmit`: 0 errores. `npm run lint`: 0 errores, 1 advertencia conocida (`cliente-api.ts`).
- `npm test`: **131/131** en 19 archivos. `npm run build`: OK.
- Prueba de humo Fase 4 (`next start` :3107, `sigcan_test`, SMTP vacío, base reseteada): **27/27** OK. Prueba de humo Fase 3 (regresión): **25/25** OK. Servidor detenido.
- Nota operativa: Docker Desktop estaba cerrado y el contenedor `sigcan-db` detenido; se iniciaron para verificar.
- No verificado: recorrido manual por rol en navegador (Task 9, Step 5; requiere al usuario).
