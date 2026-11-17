# Registro de desviaciones — Fase 6 (Verificación)

## Cambios respecto del plan

### D-1 — `tests/humo/fase6.mjs`, última verificación (redirección de `/reportes`)
- Decía el plan: `r.estado === 307` para la veterinaria en `/reportes`.
- Observado: responde `200`. Causa raíz: el `loading.tsx` del panel (Task 4) hace que Next transmita la página por streaming; cuando `redirect()` se ejecuta ya se envió el `200`, y la redirección viaja en el cuerpo (`NEXT_REDIRECT;replace;/dashboard;307` y `<meta http-equiv="refresh" content="1;url=/dashboard">`). El navegador igualmente termina en `/dashboard`; no es un fallo de permisos (la API de reportes devuelve 403 y la página redirige).
- Cambio: la verificación acepta `307` o `200` con la marca `NEXT_REDIRECT;replace;/dashboard;307` en el cuerpo, con un comentario que lo explica. El conteo sigue en 28. No se cambió ningún valor del escenario.

### D-2 — `docs/verificacion/recorridos.md`, pasos ADM-6 y ADM-7
- El plan pedía crear un operativo "para dentro de 3 días" y esperar el rechazo de la cancelación por faltar menos de 48 h. Con 3 días (72 h) la cancelación ordinaria es válida por la regla de negocio. Se cambió el paso a "mañana" (menos de 48 h). No cambia reglas ni código.

Resto: los 9 archivos con bloque de código del plan (`demo.test.ts`, `demo.ts`, `scripts/db.ts`, `error.tsx`, `loading.tsx`, `not-found.tsx`, `login/layout.tsx`, `fase6.mjs`, `README.md`) idénticos al plan (salvo D-1); `recorridos.md` difiere solo en la línea de fecha/ejecutor y en D-2; las 16 páginas con `metadata`, `layout.tsx`, `redactarDescripcion` exportada y los scripts de `package.json` verificados por script.

## Hallazgos de los recorridos

43 pasos: 37 OK, 0 con falla de código, 6 pendientes del usuario (ADM-2, F12-1 a F12-3, GEN-3, GEN-4). Detalle en `docs/verificacion/recorridos.md`.

- **H-1 (ADM-6/ADM-7):** error del checklist, no del sistema (ver D-2).
- **H-2 (OPE-13, VET-8, humo):** las redirecciones de página llegan por streaming (ver D-1). Funcionalmente correcto.
- **O-1 (OPE-4, observación):** crear por API un animal "callejero" enviando un tutor lo guarda con `vecino_id` nulo en lugar de rechazarlo. La interfaz no ofrece tutor para callejeros, por lo que no se cambió (regla 6 del plan); queda como consulta al usuario si se prefiere rechazarlo.

## Verificación

- [x] Autocomparación: 9 archivos creados/reemplazados con bloque (más `recorridos.md`) y 21 modificados/verificados por script contra el plan (`package.json`, `procedimientos.ts`, `layout.tsx` y 16 páginas, además de los archivos de la lista)
- [x] `npx tsc --noEmit`: 0 errores
- [x] `npm run lint`: 0 errores, 1 advertencia previa (`src/lib/cliente-api.ts`)
- [x] `npm test`: 158 passed (24 archivos)
- [x] `npm run build`: exitoso
- [x] Humo Fase 5: 28/28
- [x] Humo Fase 4: 27/27
- [x] Humo Fase 3: 25/25
- [x] Humo Fase 6: 28/28 (tras D-1)
- [x] Recorridos: 37 de 43 pasos OK, 6 pendientes del usuario, 0 hallazgos de código
- [x] Base de desarrollo con `npm run db:demo` el 2026-10-29 (ejecutado al finalizar los recorridos; la demo queda limpia)
