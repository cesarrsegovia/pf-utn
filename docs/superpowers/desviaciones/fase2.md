# Registro de desviaciones — Fase 2 (Catálogos)

## Forma de implementación

El plan `2026-10-28-sigcan-fase2-catalogos.md` quedó escrito solo hasta la Task 3. Por decisión del usuario,
la fase la implementó Claude directamente (Tasks 1–15) en lugar de completar el plan y ejecutarlo con un agente externo.

## Cambios respecto de las Tasks 1–3 escritas en el plan

1. `src/lib/texto.ts`: el rango de tildes se escribe `/[̀-ͯ]/g` (escape explícito) en lugar de los caracteres combinantes literales.
2. `src/services/comun.ts`: además de lo que indicaba el plan, incluye `ResultadoBaja`, `paginacion()`, `condicionEstado()` y `exigirReferencia()`.
3. `src/schemas/comun.ts`: además, `filtroEstado` (activos / inactivos / todos).
4. Los campos de los formularios que corresponden a columnas usan el mismo nombre que la columna (`zona_id`, `vecino_id`, `usuario_id`, `numero_chip`, `edad_estimada`, `stock_minimo`, `stock_inicial`), para que los errores de unicidad del servidor se muestren junto al input.

## Agregados no previstos en el mapa de archivos

- `src/hooks/use-edicion.ts`: estado compartido del diálogo de alta/edición y de la confirmación de baja.
- `src/components/insumos/detalle-insumo.tsx` y `formulario-movimiento.tsx` (pantalla `/insumos/[id]`).

## Verificación

- `npx tsc --noEmit` sin errores; `npm run lint`: 0 errores, 1 advertencia previa (`cliente-api.ts`, Fase 1).
- `npm test`: 75/75 (33 previos + 6 de utilidades + 36 de servicios de la fase).
- El test de bloqueo de fila de insumos se verificó quitando el `lock`: así falla y con el `lock` pasa.
- `npm run build` + `next start`: prueba con `curl` de login, listados, opciones, altas, DNI repetido (400), egreso mayor al stock (409 con mensaje), movimientos, 401 sin sesión y páginas (200). Los datos de prueba se eliminaron.
- **Pendiente:** recorrido manual en el navegador por rol (formularios, filtros, botones ocultos para roles de solo lectura).
