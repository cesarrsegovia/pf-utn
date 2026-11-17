# SIGCAN — Hoja de ruta de implementación

> Spec: `docs/superpowers/specs/2026-10-28-sigcan-design.md`
> Cada fase tiene su propio plan detallado (`docs/superpowers/plans/2026-MM-DD-sigcan-faseN-*.md`), que se escribe al comenzar la fase sobre el código ya construido.

## Reglas de trabajo (de `CLAUDE.md`)

1. **Git lo maneja el usuario.** Claude no ejecuta `git init`, `git add`, commits ni push. Donde un plan dice "Punto de control", Claude se detiene, resume lo hecho y avisa que está listo para commitear.
2. **Código comentado:** cada procedimiento se documenta con comentarios profesionales, claros y concisos (en español).
3. **Código reutilizable y refactorización:** al final de cada fase hay una tarea de refactorización (duplicación, nombres, componentes y helpers extraíbles) antes del punto de control.

## Ciclo de cada fase

```
Plan detallado → Tareas con TDD (servicios) → Verificación (npm test, npm run lint, npm run build, prueba manual)
→ Refactorización → Verificación de nuevo → Punto de control (commit del usuario)
```

## Fases

| Fase | Fechas | Funcionalidades | Archivos principales | Criterio de cierre |
|---|---|---|---|---|
| 0. Base | 28–29/10 | — | scaffold Next.js, `docker-compose.yml`, `src/lib/{conexion,db,constantes}.ts`, `src/models/*` (16), `db/migrations/0001-esquema-inicial.ts`, `db/seeders/inicial.ts`, `scripts/db.ts`, Vitest | `docker compose up -d`, `npm run db:reset`, `npm test`, `npm run build` sin errores; `/api/salud` responde ok |
| 1. Acceso | 30–31/10 | F11 | `src/lib/{auth,sesion,api,errores,permisos}.ts`, `src/proxy.ts`, `src/app/(auth)/login`, `src/app/(panel)/layout.tsx`, componentes reutilizables (TablaDatos, FormularioDialogo, ConfirmarDialogo, BadgeEstado), `src/services/usuarios.ts`, `src/app/api/{auth,usuarios}` | Login/logout; cada rol ve solo su menú; API devuelve 401/403 correctos; CRUD de usuarios con reglas de F11 |
| 2. Catálogos | 01–04/11 | F10, F5, F1, F2, F6 | `src/services/{zonas,personal,vecinos,animales,insumos}.ts`, `src/schemas/*`, páginas y API correspondientes | CRUDs con búsqueda, paginación, validación cliente/servidor; baja lógica de vecinos con cascada; stock nunca negativo |
| 3. Operativos y turnos | 04–07/11 | F4, F3, F12 | `src/services/{operativos,turnos,notificaciones}.ts`, `src/lib/mailer.ts`, `src/instrumentation.ts` | Cupo, turno único, 48 h/fuerza mayor, cascada de cancelación, "No se presentó"; correo real recibido; recordatorios programados/anulados |
| 4. Procedimiento | 07–09/11 | F7, F8 | `src/services/{procedimientos,historial}.ts` | Transacción completa y rollback probados con tests; historial con filtros |
| 5. Seguimiento | 09–10/11 | F9, F13, Dashboard | `src/services/{avistamientos,reportes,dashboard}.ts`, gráficos shadcn/Recharts | Indicadores correctos sobre datos controlados (tests) y sobre el seed |
| 6. Verificación | 11–13/11 | Todas | `db/seeders/demo.ts`, `docs/verificacion/recorridos.md`, README final | Recorridos por rol completos, errores corregidos, ajustes de usabilidad |

## Ejecución por agentes externos

El usuario ejecuta los planes con agentes de Antigravity. Después de cada fase, un subagente revisor (Sonnet) compara el código con el plan, corre la verificación, corrige y reporta. Los patrones de falla detectados se incorporan a los planes siguientes (sección "Reglas para quien implemente" y archivo `docs/superpowers/desviaciones/faseN.md`).

**Fase 0 revisada (28/10):** sin desviaciones relevantes. Un test se adaptó correctamente por una particularidad de Sequelize (plan corregido). Se desactivó `cacheComponents`, que había agregado el scaffold (Task 0 de la Fase 1).

**Fase 1 revisada (28/10):** implementación idéntica al plan; 33 tests en verde. El revisor detectó y corrigió un defecto latente de la Fase 0 que solo aparece en producción (modelos sin `modelName`). Desde la Fase 2, cada plan incluye una prueba de humo contra `npm run build` + `npm start`.

**Fase 3 revisada (28/10):** ejecución fiel al plan; 118 tests y humo 25/25 en verde. Única desviación documentada: casts por TS7053 al indexar etiquetas con columnas `CreationOptional`. El revisor agregó el bloqueo de los turnos leídos en la cascada de cancelación. Ambas lecciones están en la sección 0.1 del plan de la Fase 4.

**Fase 4 revisada (29/10):** ejecución fiel al plan (23 archivos, sin desviaciones); 131 tests, humo Fase 4 27/27 y regresión Fase 3 25/25 en verde. Refactor menor del revisor: componente `FiltroFecha` en el historial. Lecciones para la Fase 5: levantar Docker/`sigcan-db` antes de verificar, reportar conteos absolutos del humo y correr el comparador antes de declarar "Sin desviaciones".

**Fase 5 revisada (29/10):** código fiel al plan (28 archivos creados y 13 modificados, sin desviaciones); tsc 0 errores, lint 0 errores, 152/152 tests, build OK, humo Fase 5 28/28 y regresión Fase 4 27/27 y Fase 3 25/25. Antigravity no pudo correr la verificación final (sandbox de terminal); la hizo el revisor y completó `desviaciones/fase5.md`. Lecciones para la Fase 6: checklist explícito de cierre, declarar lo no ejecutado, `db:reset:test` antes de cada humo.

**Fase 6 revisada (29/10):** código idéntico al plan; tsc 0 errores, lint 0 errores, 158/158 tests, build OK, humos Fase 5 28/28, Fase 4 27/27, Fase 3 25/25 y Fase 6 28/28. Corrección del revisor: el humo 6 acepta la redirección por streaming de `/reportes` (con `loading.tsx` la respuesta es 200 con `NEXT_REDIRECT`); checklist ADM-6 corregido a un operativo de mañana (< 48 h). Recorridos: 37 de 43 pasos OK, 6 pendientes del usuario (R-F12 correo real, tema oscuro, ventana angosta, menú). Base de desarrollo con `npm run db:demo`. Consultas abiertas: callejero con tutor por API se guarda sin tutor en vez de rechazarse; menú del veterinario con módulos de consulta.

## Riesgos y mitigación

- **Plazo (16 días):** si una fase se atrasa, se simplifica primero la presentación de F13 (gráficos → tablas). Las reglas de F3, F4, F7 y F13 no se recortan.
- **Sequelize dentro de Next.js:** se valida en la Fase 0 con `/api/salud` (externalización de `sequelize`/`pg` en `next.config.ts`).
- **SMTP:** si el SMTP real falla el día de la demo, las notificaciones quedan `fallido` y se reintentan; el registro en la tabla demuestra la lógica igualmente.
