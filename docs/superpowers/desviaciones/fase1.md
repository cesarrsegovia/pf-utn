# Registro de desviaciones — Fase 1 (Acceso)

## Task 1 — `npx shadcn@latest add` (`package.json` y `src/components/ui/*.tsx`)

1. **Dependencias transitivas de `sonner` en `package.json`:**
   - **Qué decía el plan:** Instalar `react-hook-form`, `@hookform/resolvers`, `swr`, `server-only` y ejecutar `npx shadcn@latest add input label card table dialog alert-dialog native-select badge sonner checkbox`.
   - **Qué hizo el CLI de `shadcn`:** Al agregar el componente `sonner`, el registro de `shadcn/ui` instaló automáticamente en `package.json` las dependencias requeridas por `src/components/ui/sonner.tsx`: `"sonner": "^2.0.8"` y `"next-themes": "^0.4.6"`.
   - **Por qué se conserva:** `src/components/ui/sonner.tsx` importa `Toaster` desde `"sonner"` y `useTheme` desde `"next-themes"`, y el propio plan en Tasks posteriores importa `toast` desde `"sonner"` y `<Toaster />` desde `@/components/ui/sonner`.

2. **Importación de `cn` en `src/components/ui/*.tsx`:**
   - **Qué generó el CLI de `shadcn`:** Los componentes generados (`input.tsx`, `label.tsx`, `card.tsx`, `table.tsx`, `dialog.tsx`, `alert-dialog.tsx`, `native-select.tsx`, `badge.tsx`, `checkbox.tsx`) importaron `import { cn } from "cn"` debido a un bug del generador de `shadcn` con el alias de utilidades.
   - **Qué se cambió (Task 12 — Refactorización):** Se unificó en los 9 archivos el import hacia `import { cn } from "@/lib/utils"`, manteniendo el mismo criterio aplicado en la Fase 0 sobre `src/components/ui/button.tsx` y en el resto de los componentes del proyecto.

## Revisión (revisor de código)

### Verificación
- `npm test`: 33/33 (12 de Fase 0 + 21 de Fase 1); `npx tsc --noEmit` sin errores; `npm run lint` 0 errores y 1 advertencia (ver 2); `npm run build` OK.
- Prueba de API contra `next start`: login inválido 401 con mensaje genérico, login válido 200 con cookie `HttpOnly; Secure; SameSite=lax`, `/api/usuarios` 401 sin cookie y 200 con cookie sin `password_hash`, 403 para operador, 400 por validación, 404/409 por reglas, sesión de usuario desactivado cae (401) y las páginas sin cookie redirigen a `/login`.
- Todos los archivos del plan (Task 0–11) coinciden carácter por carácter con el código del plan (comparación automática de bloques de código).

### Error corregido (código previo a Fase 1 / plan que no lo contemplaba)
1. **`src/models/*.ts` (16 archivos): faltaba `modelName` en `Model.init`.**
   - **Síntoma:** en `npm run build` + `npm start`, el login devolvía `rol: "Administrador"` (el nombre del usuario, no su rol), el JWT resultaba inválido y toda petición posterior daba 401. En desarrollo y en Vitest funcionaba.
   - **Causa:** Sequelize toma el nombre del modelo del nombre de la clase; el minificado de producción de Next/Turbopack renombra todas las clases a un mismo identificador, los modelos colisionan y el `include: ["rol"]` resuelve contra el modelo equivocado.
   - **Corrección:** `modelName` explícito (igual al nombre de la clase, por lo que los alias de consulta como `"Usuario.nombre"` no cambian) con comentario explicativo en cada modelo.
   - **Origen:** defecto de Fase 0 que el plan de Fase 1 no detectó; solo se manifiesta en producción. Los tests no lo cubren.

### Observaciones sin corregir (código del plan)
2. **`src/lib/cliente-api.ts:29`:** advertencia de lint `no-location-assign-relative-destination` por `window.location.href = "/login"`. Es el código literal del plan; la redirección completa es intencional (limpia el estado del cliente), por eso se conserva.
3. **`src/lib/utils.ts` (Fase 0)** usa el paquete `cn` (reemplazo de clsx + tailwind-merge); es válido, sin acción requerida.
