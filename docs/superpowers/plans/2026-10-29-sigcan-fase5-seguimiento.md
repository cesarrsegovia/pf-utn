# SIGCAN Fase 5 (Seguimiento: avistamientos, reportes y dashboard) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** F9 Avistamientos (carga por zona sin GPS, atención con operativo opcional de la misma zona), F13 Reportes estadísticos (cinco indicadores por zona y período, cada uno con gráfico y tabla) y el Dashboard de inicio (panorama para administrador y operador; turnos del día para el veterinario).

**Architecture:** Igual que las fases anteriores: Route Handler → `requerirSesion(accion)` → Zod → servicio. F9 es un CRUD con transacción y bloqueo de fila. F13 no tiene tablas propias: `src/services/reportes.ts` calcula los indicadores con consultas SQL de agregación **parametrizadas** (`:zonaId`, `:desde`…). El dashboard es una página de servidor que llama a `resumenDashboard()`, que reutiliza los servicios existentes (insumos, operativos, turnos, avistamientos). Los gráficos usan Recharts 3 directamente (sin `npx shadcn add chart`).

**Tech Stack:** Next.js 16.4.3, Sequelize 6, Zod 4, react-hook-form, SWR, shadcn/ui (Base UI), Vitest 3. **Única dependencia nueva: `recharts@3.10.1`.**

**Spec:** `docs/superpowers/specs/2026-10-28-sigcan-design.md` — §4 (F9: gestión administrador/operador, lectura veterinario; F13: administrador y operador; Dashboard: todos, el veterinario ve sus turnos del día), §5 F9, F13 y Dashboard, §6 (badges por estado, estados vacíos y de carga), §7 (F13: fórmulas sobre datos controlados). Reglas de origen: `docs/Fase 2 - Diseno del Sistema - CORREGIDO.pdf`, sección 6 (Avistamientos F9, Reportes F13).

---

## 0. Reglas para quien implemente (leer antes de empezar)

1. **Git:** no ejecutar ningún comando de git (ni siquiera `git status`). Los "Puntos de control" son avisos al usuario (ver `CLAUDE.md`).
2. **Desviaciones:** crear `docs/superpowers/desviaciones/fase5.md` al empezar (Task 1, Step 1). Copiar el código tal como está; si algo no compila o no funciona, hacer el cambio mínimo, **registrarlo** (archivo, qué decía el plan, qué se cambió y por qué) y dejar un comentario en el código.
3. **Tests:** prohibido modificar un test del plan para que pase. Si un test parece incorrecto, detenerse y registrarlo. Los tests de fases anteriores no se tocan; en `tests/helpers/fabricas.ts` solo se **agregan** funciones y se amplían los imports (Task 3, Step 6).
4. **Dependencias:** instalar **solo** `recharts@3.10.1` con el comando exacto de la Task 1. No ejecutar `npx shadcn add` (tampoco `chart`): el gráfico se escribe a mano en la Task 9.
5. **Modelos y migraciones:** no se crean ni modifican. La tabla `reporte_avistamiento` ya existe con `ck_reporte_cantidad` (> 0), `ck_reporte_estado` y `ck_reporte_atencion` (atendido ⇒ `fecha_atencion` no nula).
6. **SQL de reportes:** solo con parámetros nombrados (`replacements`). Nunca concatenar valores recibidos del usuario en el texto de una consulta.
7. **shadcn/ui con Base UI:** usar la prop `render` (nunca `asChild`); `NativeSelect` en formularios con `className="w-full"`; enlaces con estilo de botón con `buttonVariants` sobre `<Link>`.
8. **Comentarios:** todo archivo nuevo lleva comentarios profesionales, claros y concisos en español (ya incluidos; mantenerlos).
9. **Alcance:** no implementar nada de la Fase 6 (seed demo, README final, recorridos documentados).
10. **Archivos que no se tocan:** `CLAUDE.md`, `AGENTS.md`, `docs/` (salvo el archivo de desviaciones), `src/models/*`, `db/*`.
11. **Verificación en producción obligatoria (Task 11):** `npm run build` + `next start` contra la base de test y las pruebas de humo de las Fases 5, 4 y 3.

### 0.1 Lecciones de las Fases 3 y 4 (aplicarlas desde el primer archivo)

La revisión de cierre de la Fase 4 encontró la ejecución fiel al plan (23 archivos idénticos, 131 tests, humo 27/27). Se mantienen las lecciones anteriores y se agregan tres:

- **L1 — Índices con `CreationOptional` (TS7053).** Las columnas `CreationOptional<T>` (ej.: `operativo.estado`, `reporte.estado`) no pueden indexar un `Record<T, string>` directamente. Este plan pasa el valor por una función tipada (`estadoEnTexto(operativo.estado)`) o indexa con valores de un DTO (ya tipados). Si aparece otro TS7053, usar `as EstadoX` y registrarlo.
- **L2 — Toda lectura que precede a una actualización se bloquea.** Editar, eliminar y atender un avistamiento leen la fila con `lock: transaction.LOCK.UPDATE` (sin `include`) antes de modificarla.
- **L3 — Autocomparación al cerrar cada Task.** Comparar cada archivo "Create" con su bloque del plan (idénticos salvo desviaciones registradas) y verificar que cada bloque "Modify" quedó aplicado.
- **L4 — Fórmulas probadas sobre datos controlados.** Los tests de `reportes.test.ts` arman un escenario con resultados conocidos (ej.: cumplimiento 66,7 %, asistencia 75 %). No "simplificarlos" ni ajustar los valores esperados: si no coinciden, el error está en la consulta.
- **L5 (nueva) — Docker antes de verificar.** En la revisión de la Fase 4 Docker y `sigcan-db` estaban apagados. Antes de cualquier `npm test` o prueba de humo: `docker compose up -d` y comprobar con `docker ps` que `sigcan-db` figura `healthy`.
- **L6 (nueva) — Resultados en números absolutos.** Al reportar, indicar la cantidad exacta: tests (`Tests 152 passed`) y verificaciones de cada humo (la de esta fase imprime `OK (28 verificaciones)`).
- **L7 (nueva) — "Sin desviaciones" se afirma con evidencia.** Solo se escribe después de la autocomparación (L3) de **todos** los archivos; el archivo de desviaciones debe decir cuántos archivos se compararon (ver Task 11, Step 7).

## 1. Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `package.json`, `package-lock.json` (modificar con npm) | Dependencia `recharts@3.10.1` |
| `src/lib/fechas.ts` (modificar) | `partesLocales`, `limitesDelRango`, `rangoUltimosMeses`, `mesesDelRango`, `formatearMes` |
| `src/lib/indicadores.ts` | `porcentaje`, `formatearPorcentaje`, `promedioDeTexto` |
| `src/lib/etiquetas.ts`, `src/lib/navegacion.ts` (modificar) | Etiquetas de estado de avistamiento; ítems Avistamientos y Reportes |
| `src/components/comunes/badges-dominio.tsx` (modificar) | `BadgeAvistamiento` |
| `src/schemas/avistamientos.ts`, `src/schemas/reportes.ts` | Validación de F9 y filtros de F13 |
| `src/services/comun.ts` (modificar) | `condicionDiasLocales()` (rango de días locales, reutilizado por historial y avistamientos) |
| `src/services/historial.ts` (modificar) | Usa `condicionDiasLocales()` (refactor sin cambio de comportamiento) |
| `src/services/operativos.ts` (modificar) | `proximosOperativosConCupo()`, `opcionesOperativosDeZona()` |
| `src/services/turnos.ts` (modificar) | `listarTurnosDelDia()` e `incluirAsignacion()` |
| `src/services/avistamientos.ts` | F9: CRUD y atención |
| `src/services/reportes.ts` | F13: cinco indicadores con SQL parametrizado |
| `src/services/dashboard.ts` | Resumen del inicio según el rol |
| `src/app/api/avistamientos/**`, `src/app/api/reportes/route.ts`, `src/app/api/dashboard/route.ts` | API REST |
| `src/components/comunes/{filtro-fecha,filtro-zona,area-texto}.tsx` | Componentes reutilizables (extraídos/nuevos) |
| `src/components/historial/historial-clinico.tsx`, `src/components/procedimientos/formulario-procedimiento.tsx` (modificar) | Usan `FiltroFecha` y `AreaTexto` (refactor) |
| `src/components/avistamientos/*` | Pantalla de F9 |
| `src/components/reportes/{grafico-barras,reportes-estadisticos}.tsx` | Pantalla de F13 |
| `src/components/dashboard/panel-dashboard.tsx` | Inicio (componente de servidor) |
| `src/app/(panel)/{avistamientos,reportes}/page.tsx`, `src/app/(panel)/dashboard/page.tsx` (reemplazar) | Páginas |
| `tests/helpers/fabricas.ts` (modificar) | `crearProcedimientoPrueba()`, `crearAvistamientoPrueba()` |
| `tests/lib/dominio-fase5.test.ts`, `tests/services/{avistamientos,reportes,dashboard}.test.ts` | Tests (21 nuevos: total 152) |
| `tests/humo/fase5.mjs` | Prueba de humo contra `next start` |

## 2. Decisiones de esta fase (para la defensa)

- **Avistamiento:** lo carga el usuario en sesión (administrador u operador); zona obligatoria, cantidad entera de 1 a 500, vecino opcional (null = anónimo), dirección de referencia opcional y sin GPS. La fecha y la hora del avistamiento se ingresan (por defecto, las actuales) y no pueden ser futuras.
- **Atención:** `pendiente → atendido` con `fecha_atencion` = momento de la atención. El operativo es opcional; si se indica debe ser **de la misma zona** y **no cancelado** (Fase 2: "el operativo que atendió la zona").
- **Reporte atendido = cerrado:** no se edita, no se elimina ni se vuelve a atender (409). Así los indicadores de F13 no cambian retroactivamente. Un pendiente cargado por error sí puede eliminarse.
- **Rangos de fechas:** días locales completos de Río Grande (UTC−3): desde las 00:00 de "desde" hasta antes de las 00:00 del día siguiente a "hasta". Un mismo helper (`condicionDiasLocales`) lo aplica en historial y avistamientos; `limitesDelRango` lo hace en los reportes.
- **Indicadores (F13), todos filtrables por zona (o todas) y período:**
  1. *Castraciones y chipeos por zona:* procedimientos con fecha en el período, agrupados por la zona del operativo; "castración y chipeo" suma a ambos.
  2. *Cumplimiento de operativos:* realizados / (realizados + cancelados), solo operativos del período con **fecha ya pasada**. Los pasados que siguen programados o en curso se informan como "sin cerrar" y no entran en la fórmula.
  3. *Ocupación de cupo por operativo:* turnos pendientes, confirmados o completados / `cupo_maximo`, para los operativos **no cancelados** del período. La ocupación total es la suma de asignados / la suma de cupos.
  4. *Asistencia:* completados / (completados + cancelados con motivo "No se presentó"), sobre los turnos de operativos del período.
  5. *Avistamientos por mes:* pendientes y atendidos según el mes del aviso (todos los meses del período, aunque estén en cero) y días promedio entre aviso y atención (por mes y total).
  - Sin casos en el denominador, el porcentaje es `null` y se muestra "—" (nunca una división por cero).
- **Período por defecto de los reportes:** los últimos 12 meses calendario (del día 1 de hace 11 meses hasta hoy).
- **Dashboard:** administrador y operador ven totales (vecinos activos, animales, castrados, chipeados), turnos de hoy, próximos operativos con cupo, insumos bajo el mínimo y avistamientos pendientes (hasta 5 de cada lista, con el total). El veterinario ve solo los turnos de hoy de los operativos a los que está asignado; si su usuario no está vinculado al personal, un aviso.
- **Gráficos:** Recharts 3.10.1 con la prop `responsive` (sin `ResponsiveContainer`) y colores fijos que contrastan en tema claro y oscuro (el tema base de shadcn es en grises).

---

### Task 1: Preparación, dependencia y utilidades de fechas e indicadores (TDD)

**Files:**
- Create: `docs/superpowers/desviaciones/fase5.md`, `src/lib/indicadores.ts`
- Modify: `package.json`, `package-lock.json` (con npm), `src/lib/fechas.ts`
- Test: `tests/lib/dominio-fase5.test.ts`

- [ ] **Step 1: Crear el archivo de desviaciones**

```markdown
# Registro de desviaciones — Fase 5 (Seguimiento: avistamientos, reportes y dashboard)

Sin desviaciones.
```

- [ ] **Step 2: Levantar la base (lección L5)**

Run: `docker compose up -d`
Run: `docker ps --format "{{.Names}} {{.Status}}"`
Expected: una línea `sigcan-db Up … (healthy)`. Si no aparece `healthy`, esperar unos segundos y repetir; no seguir sin la base.

- [ ] **Step 3: Instalar Recharts (único cambio de dependencias)**

Run: `npm install recharts@3.10.1`
Expected: termina sin errores (las advertencias `deprecated` de otras dependencias son normales). Solo cambian `package.json` (aparece `"recharts": "^3.10.1"` en `dependencies`) y `package-lock.json`. No tocar nada más.

- [ ] **Step 4: Escribir el test que falla `tests/lib/dominio-fase5.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import {
  formatearMes, instanteLocal, limitesDelRango, mesesDelRango, partesLocales, rangoUltimosMeses,
} from "@/lib/fechas";
import { porcentaje, promedioDeTexto } from "@/lib/indicadores";

describe("fechas de la Fase 5", () => {
  it("obtiene la fecha y la hora locales de un instante (UTC−3)", () => {
    expect(partesLocales(instanteLocal("2026-05-10", "23:30"))).toEqual({ fecha: "2026-05-10", hora: "23:30" });
    // 01:15 UTC del 11/05 todavía es 10/05 en Río Grande.
    expect(partesLocales("2026-05-11T01:15:00Z")).toEqual({ fecha: "2026-05-10", hora: "22:15" });
  });

  it("calcula los límites de un rango de días locales completos", () => {
    const { inicio, fin } = limitesDelRango("2026-10-01", "2026-10-31");
    expect(inicio.toISOString()).toBe("2026-10-01T03:00:00.000Z");
    expect(fin.toISOString()).toBe("2026-11-01T03:00:00.000Z");
  });

  it("arma el rango de los últimos meses y la lista de meses, cruzando el año", () => {
    expect(rangoUltimosMeses(12, "2026-10-29")).toEqual({ desde: "2025-11-01", hasta: "2026-10-29" });
    expect(rangoUltimosMeses(1, "2026-03-15")).toEqual({ desde: "2026-03-01", hasta: "2026-03-15" });
    expect(mesesDelRango("2025-11-20", "2026-02-03")).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    expect(mesesDelRango("2026-05-01", "2026-05-31")).toEqual(["2026-05"]);
    expect(formatearMes("2026-01")).toBe("Ene 2026");
  });
});

describe("indicadores", () => {
  it("calcula porcentajes con un decimal y null sin denominador", () => {
    expect(porcentaje(2, 3)).toBe(66.7);
    expect(porcentaje(3, 4)).toBe(75);
    expect(porcentaje(0, 5)).toBe(0);
    expect(porcentaje(0, 0)).toBeNull();
  });

  it("redondea los promedios que devuelve PostgreSQL como texto", () => {
    expect(promedioDeTexto("2.9999999")).toBe(3);
    expect(promedioDeTexto("1.25")).toBe(1.3);
    expect(promedioDeTexto(null)).toBeNull();
  });
});
```

- [ ] **Step 5: Correr y verificar que falla**

Run: `npx vitest run tests/lib/dominio-fase5.test.ts`
Expected: FAIL (`partesLocales` y `@/lib/indicadores` no existen).

- [ ] **Step 6: Agregar al final de `src/lib/fechas.ts`**

```ts
/** Fecha (YYYY-MM-DD) y hora (HH:MM) de Río Grande que corresponden a un instante. */
export function partesLocales(valor: string | Date): { fecha: string; hora: string } {
  // Se desplaza el instante a UTC−3 y se leen sus componentes UTC (sin depender de la zona del servidor).
  const local = new Date(new Date(valor).getTime() - 3 * MS_POR_HORA).toISOString();
  return { fecha: local.slice(0, 10), hora: local.slice(11, 16) };
}

/** Límites [inicio, fin) de un rango de días locales completos: desde las 00:00 de `desde` hasta las 00:00 del día siguiente a `hasta`. */
export function limitesDelRango(desde: string, hasta: string): { inicio: Date; fin: Date } {
  return { inicio: instanteLocal(desde, "00:00"), fin: instanteLocal(sumarDias(hasta, 1), "00:00") };
}

/** Rango de los últimos `meses` meses calendario, incluido el actual: del día 1 de ese mes hasta hoy. */
export function rangoUltimosMeses(meses: number, hoy = hoyLocal()): { desde: string; hasta: string } {
  const [anio, mes] = hoy.split("-").map(Number);
  // Date.UTC normaliza los meses negativos (ej.: mes −2 de 2026 → octubre de 2025).
  const desde = new Date(Date.UTC(anio, mes - meses, 1)).toISOString().slice(0, 10);
  return { desde, hasta: hoy };
}

/** Meses (YYYY-MM) comprendidos entre dos fechas YYYY-MM-DD, ambos inclusive. */
export function mesesDelRango(desde: string, hasta: string): string[] {
  const [anio, mes] = desde.split("-").map(Number);
  const ultimo = hasta.slice(0, 7);
  const meses: string[] = [];
  for (let indice = 0; ; indice++) {
    const actual = new Date(Date.UTC(anio, mes - 1 + indice, 1)).toISOString().slice(0, 7);
    if (actual > ultimo) return meses;
    meses.push(actual);
  }
}

/** Abreviaturas de los meses para los gráficos (sin depender del ICU del entorno). */
const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

/** YYYY-MM → "Oct 2026". */
export function formatearMes(mes: string): string {
  const [anio, numero] = mes.split("-").map(Number);
  return `${MESES_CORTOS[numero - 1]} ${anio}`;
}
```

- [ ] **Step 7: Crear `src/lib/indicadores.ts`**

```ts
/** Cálculos comunes de los indicadores estadísticos (F13) y del dashboard. */

/** Porcentaje con un decimal (ej.: 2 de 3 → 66.7). Sin casos en el denominador devuelve null. */
export function porcentaje(parte: number, total: number): number | null {
  if (total === 0) return null;
  return Math.round((parte * 1000) / total) / 10;
}

/** Porcentaje para mostrar ("66,7 %"), o "—" si no hay datos para calcularlo. */
export function formatearPorcentaje(valor: number | null): string {
  return valor === null ? "—" : `${valor.toLocaleString("es-AR")} %`;
}

/** Promedio redondeado a un decimal de un valor numérico que PostgreSQL devuelve como texto (o null). */
export function promedioDeTexto(valor: string | null): number | null {
  return valor === null ? null : Math.round(Number(valor) * 10) / 10;
}
```

- [ ] **Step 8: Correr y verificar que pasa**

Run: `npx vitest run tests/lib/dominio-fase5.test.ts`
Expected: PASS (5 tests).

---

### Task 2: Etiquetas, badge, navegación y esquemas

**Files:**
- Modify: `src/lib/etiquetas.ts`, `src/components/comunes/badges-dominio.tsx`, `src/lib/navegacion.ts`
- Create: `src/schemas/avistamientos.ts`, `src/schemas/reportes.ts`

- [ ] **Step 1: `src/lib/etiquetas.ts` — import**

Reemplazar el bloque de import del principio por:

```ts
import type {
  CondicionAnimal, EstadoAvistamiento, EstadoEnvio, EstadoOperativo, EstadoTurno, NombreRol, SexoAnimal,
  TipoMovimiento, TipoNotificacion, TipoPersonal, TipoProcedimiento,
} from "./constantes";
```

- [ ] **Step 2: `src/lib/etiquetas.ts` — etiquetas de avistamiento**

Agregar inmediatamente antes del comentario `/** Nombre visible de un animal: …`:

```ts
export const ETIQUETAS_ESTADO_AVISTAMIENTO: Record<EstadoAvistamiento, string> = {
  pendiente: "Pendiente",
  atendido: "Atendido",
};

```

- [ ] **Step 3: Reemplazar completo `src/components/comunes/badges-dominio.tsx`**

```tsx
import type { EstadoAvistamiento, EstadoEnvio, EstadoOperativo, EstadoTurno } from "@/lib/constantes";
import {
  ETIQUETAS_ESTADO_AVISTAMIENTO, ETIQUETAS_ESTADO_ENVIO, ETIQUETAS_ESTADO_OPERATIVO, ETIQUETAS_ESTADO_TURNO,
} from "@/lib/etiquetas";
import { BadgeEstado, type TonoEstado } from "./badge-estado";

/** Color de cada estado de operativo, turno, envío y avistamiento (spec §6: badges de color por estado). */
const TONOS_OPERATIVO: Record<EstadoOperativo, TonoEstado> = {
  programado: "info",
  en_curso: "alerta",
  realizado: "exito",
  cancelado: "neutro",
};
const TONOS_TURNO: Record<EstadoTurno, TonoEstado> = {
  pendiente: "alerta",
  confirmado: "info",
  completado: "exito",
  cancelado: "neutro",
};
const TONOS_ENVIO: Record<EstadoEnvio, TonoEstado> = {
  pendiente: "alerta",
  enviado: "exito",
  fallido: "peligro",
  anulado: "neutro",
};
const TONOS_AVISTAMIENTO: Record<EstadoAvistamiento, TonoEstado> = {
  pendiente: "alerta",
  atendido: "exito",
};

/** Estado de un operativo (F4). */
export function BadgeOperativo({ estado }: { estado: EstadoOperativo }) {
  return <BadgeEstado texto={ETIQUETAS_ESTADO_OPERATIVO[estado]} tono={TONOS_OPERATIVO[estado]} />;
}

/** Estado de un turno (F3). */
export function BadgeTurno({ estado }: { estado: EstadoTurno }) {
  return <BadgeEstado texto={ETIQUETAS_ESTADO_TURNO[estado]} tono={TONOS_TURNO[estado]} />;
}

/** Estado de envío de una notificación (F12). */
export function BadgeEnvio({ estado }: { estado: EstadoEnvio }) {
  return <BadgeEstado texto={ETIQUETAS_ESTADO_ENVIO[estado]} tono={TONOS_ENVIO[estado]} />;
}

/** Estado de un reporte de avistamiento (F9). */
export function BadgeAvistamiento({ estado }: { estado: EstadoAvistamiento }) {
  return <BadgeEstado texto={ETIQUETAS_ESTADO_AVISTAMIENTO[estado]} tono={TONOS_AVISTAMIENTO[estado]} />;
}
```

- [ ] **Step 4: Reemplazar completo `src/lib/navegacion.ts`**

```ts
import {
  Binoculars, CalendarClock, CalendarDays, ChartColumn, ClipboardList, LayoutDashboard, Mail, MapPin, Package,
  PawPrint, Stethoscope, Syringe, UserCog, Users, type LucideIcon,
} from "lucide-react";
import type { Accion } from "./permisos";

/** Ítem del menú lateral: se muestra solo si el rol tiene la acción indicada. */
export interface ItemNavegacion {
  titulo: string;
  href: string;
  icono: LucideIcon;
  accion: Accion;
}

/** Menú del panel. Cada fase agrega aquí los módulos que implementa. */
export const NAVEGACION: ItemNavegacion[] = [
  { titulo: "Inicio", href: "/dashboard", icono: LayoutDashboard, accion: "dashboard:ver" },
  { titulo: "Vecinos", href: "/vecinos", icono: Users, accion: "vecinos:ver" },
  { titulo: "Animales", href: "/animales", icono: PawPrint, accion: "animales:ver" },
  { titulo: "Operativos", href: "/operativos", icono: CalendarDays, accion: "operativos:ver" },
  { titulo: "Turnos", href: "/turnos", icono: CalendarClock, accion: "turnos:ver" },
  { titulo: "Procedimientos", href: "/procedimientos", icono: Syringe, accion: "procedimientos:registrar" },
  { titulo: "Historial clínico", href: "/historial", icono: ClipboardList, accion: "historial:ver" },
  { titulo: "Avistamientos", href: "/avistamientos", icono: Binoculars, accion: "avistamientos:ver" },
  { titulo: "Personal", href: "/personal", icono: Stethoscope, accion: "personal:ver" },
  { titulo: "Insumos", href: "/insumos", icono: Package, accion: "insumos:ver" },
  { titulo: "Reportes", href: "/reportes", icono: ChartColumn, accion: "reportes:ver" },
  { titulo: "Notificaciones", href: "/notificaciones", icono: Mail, accion: "notificaciones:ver" },
  { titulo: "Zonas", href: "/zonas", icono: MapPin, accion: "zonas:ver" },
  { titulo: "Usuarios", href: "/usuarios", icono: UserCog, accion: "usuarios:gestionar" },
];
```

(Agrega "Avistamientos" después de "Historial clínico" y "Reportes" después de "Insumos". Los permisos `avistamientos:*` y `reportes:ver` ya existen en `src/lib/permisos.ts`: no modificarlo.)

- [ ] **Step 5: Crear `src/schemas/avistamientos.ts`**

```ts
import { ESTADOS_AVISTAMIENTO } from "@/lib/constantes";
import { esquemaListado, fechaValida, horaValida, idSeleccionado, textoOpcional, textoRequerido, z } from "./comun";

/** Alta y edición de un reporte de avistamiento (F9). La fecha y la hora son locales de Río Grande. */
export const esquemaAvistamiento = z.object({
  fecha: fechaValida,
  hora: horaValida,
  descripcion: textoRequerido(1000),
  cantidad_animales: z
    .number("Ingrese un número")
    .int("Ingrese un número entero")
    .min(1, "Debe ser mayor a 0")
    .max(500, "Máximo 500 animales"),
  direccion_referencia: textoOpcional(150),
  zona_id: idSeleccionado("Seleccione una zona"),
  /** Vecino que dio el aviso; null = anónimo. */
  vecino_id: z.number().int().positive().nullable(),
});
export type DatosAvistamiento = z.infer<typeof esquemaAvistamiento>;

/** Atención de un reporte: operativo de la misma zona que lo atendió (opcional). */
export const esquemaAtenderAvistamiento = z.object({
  operativo_id: z.number().int().positive().nullable(),
});
export type DatosAtenderAvistamiento = z.infer<typeof esquemaAtenderAvistamiento>;

/** Listado de avistamientos: texto, estado, zona y rango de fechas (todos opcionales). */
export const esquemaListadoAvistamientos = esquemaListado.extend({
  estado: z.enum(ESTADOS_AVISTAMIENTO).optional(),
  zona_id: z.coerce.number().int().positive().optional(),
  desde: fechaValida.optional(),
  hasta: fechaValida.optional(),
});
export type ParametrosListadoAvistamientos = z.infer<typeof esquemaListadoAvistamientos>;

/** Operativos que pueden asociarse a la atención: los de la zona del reporte. */
export const esquemaOperativosZona = z.object({
  zona_id: z.coerce.number().int().positive(),
});
```

- [ ] **Step 6: Crear `src/schemas/reportes.ts`**

```ts
import { fechaValida, z } from "./comun";

/** Filtros de los reportes estadísticos (F13): zona (o todas) y rango de fechas obligatorio. */
export const esquemaFiltrosReportes = z
  .object({
    zona_id: z.coerce.number().int().positive().optional(),
    desde: fechaValida,
    hasta: fechaValida,
  })
  .refine((filtros) => filtros.desde <= filtros.hasta, {
    path: ["hasta"],
    message: "Debe ser igual o posterior a la fecha desde",
  });
export type FiltrosReportes = z.infer<typeof esquemaFiltrosReportes>;
```

- [ ] **Step 7: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

---

### Task 3: Helpers compartidos en servicios y fábricas de prueba

**Files:**
- Modify: `src/services/comun.ts`, `src/services/historial.ts`, `src/services/operativos.ts`, `src/services/turnos.ts`, `tests/helpers/fabricas.ts`

- [ ] **Step 1: `src/services/comun.ts` — import**

Agregar debajo de `import { NoEncontradoError, ValidacionError } from "@/lib/errores";`:

```ts
import { instanteLocal, sumarDias } from "@/lib/fechas";
```

- [ ] **Step 2: `src/services/comun.ts` — agregar al final**

```ts
/**
 * Condición sobre una columna de fecha y hora para un rango de días locales completos de
 * Río Grande: desde las 00:00 de `desde` hasta antes de las 00:00 del día siguiente a `hasta`.
 * Ambos extremos son opcionales; sin ninguno, no filtra.
 */
export function condicionDiasLocales(columna: string, desde?: string, hasta?: string): WhereOptions {
  return {
    [Op.and]: [
      desde ? { [columna]: { [Op.gte]: instanteLocal(desde, "00:00") } } : {},
      hasta ? { [columna]: { [Op.lt]: instanteLocal(sumarDias(hasta, 1), "00:00") } } : {},
    ],
  };
}
```

- [ ] **Step 3: `src/services/historial.ts` — usar el helper (refactor)**

a) Eliminar la línea `import { instanteLocal, sumarDias } from "@/lib/fechas";`.

b) Reemplazar `import { paginacion } from "./comun";` por:

```ts
import { condicionDiasLocales, paginacion } from "./comun";
```

c) Dentro del `where` del procedimiento, reemplazar estas tres líneas:

```ts
            // Días locales completos: desde las 00:00 de "desde" hasta antes de las 00:00 del día siguiente a "hasta".
            parametros.desde ? { fecha: { [Op.gte]: instanteLocal(parametros.desde, "00:00") } } : {},
            parametros.hasta ? { fecha: { [Op.lt]: instanteLocal(sumarDias(parametros.hasta, 1), "00:00") } } : {},
```

por:

```ts
            condicionDiasLocales("fecha", parametros.desde, parametros.hasta),
```

(`Op` sigue usándose en `[Op.and]`: no quitar su import.)

- [ ] **Step 4: `src/services/operativos.ts` — operativos vigentes reutilizables**

Reemplazar el bloque actual:

```ts
/** Operativos que admiten turnos (programados, de hoy en adelante) para las listas desplegables. */
export async function opcionesOperativos(): Promise<Opcion[]> {
  const operativos = await Operativo.findAll({
    attributes: { include: [ATRIBUTO_OCUPADOS] },
    where: { estado: "programado", fecha: { [Op.gte]: hoyLocal() } },
    include: [INCLUIR_ZONA],
    order: [["fecha", "ASC"], ["hora_inicio", "ASC"]],
  });
  return operativos.map(aDto).map((o) => ({
```

por (el resto de la función, desde `id: o.id,`, queda igual):

```ts
/** Operativos programados de hoy en adelante, en orden cronológico y con su cupo calculado. */
async function programadosVigentes(): Promise<OperativoDto[]> {
  const operativos = await Operativo.findAll({
    attributes: { include: [ATRIBUTO_OCUPADOS] },
    where: { estado: "programado", fecha: { [Op.gte]: hoyLocal() } },
    include: [INCLUIR_ZONA],
    order: [["fecha", "ASC"], ["hora_inicio", "ASC"]],
  });
  return operativos.map(aDto);
}

/** Operativos que admiten turnos (programados, de hoy en adelante) para las listas desplegables. */
export async function opcionesOperativos(): Promise<Opcion[]> {
  return (await programadosVigentes()).map((o) => ({
```

- [ ] **Step 5: `src/services/operativos.ts` — nuevas funciones**

Agregar inmediatamente antes de `/** Detalle de un operativo (404 si no existe). */`:

```ts
/** Próximos operativos programados que todavía tienen cupo disponible (dashboard). */
export async function proximosOperativosConCupo(limite: number): Promise<OperativoDto[]> {
  return (await programadosVigentes()).filter((operativo) => operativo.disponibles > 0).slice(0, limite);
}

/**
 * Operativos no cancelados de una zona, del más reciente al más antiguo, para asociarlos
 * a la atención de un reporte de avistamiento (F9).
 */
export async function opcionesOperativosDeZona(zonaId: number): Promise<Opcion[]> {
  const operativos = await Operativo.findAll({
    where: { zona_id: zonaId, estado: { [Op.ne]: "cancelado" } },
    order: [["fecha", "DESC"], ["hora_inicio", "DESC"]],
    limit: 30,
  });
  return operativos.map((operativo) => {
    const horario = `${horaCorta(operativo.hora_inicio)}–${horaCorta(operativo.hora_fin)}`;
    // estadoEnTexto recibe un EstadoOperativo tipado: evita el TS7053 de indexar con CreationOptional (L1).
    const estado = estadoEnTexto(operativo.estado);
    return { id: operativo.id, etiqueta: `${formatearFecha(operativo.fecha)} ${horario} · ${operativo.lugar} (${estado})` };
  });
}
```

- [ ] **Step 6: `src/services/turnos.ts` — turnos del día**

a) Reemplazar `import { horaCorta, instanteLocal } from "@/lib/fechas";` por:

```ts
import { horaCorta, hoyLocal, instanteLocal } from "@/lib/fechas";
```

b) Agregar inmediatamente antes de `/** Convierte el modelo (con sus asociaciones) al DTO público. */`:

```ts
/** Filtra los turnos por la asignación del veterinario al operativo, sin traer columnas del personal. */
function incluirAsignacion(veterinarioId: number): Includeable {
  return { association: "personal", attributes: [], where: { id: veterinarioId }, through: { attributes: [] } };
}

```

c) En `listarTurnosAtendibles`, reemplazar:

```ts
        include: [
          INCLUIR_ZONA,
          // Filtra por asignación sin traer columnas del personal.
          { association: "personal", attributes: [], where: { id: veterinarioId }, through: { attributes: [] } },
        ],
```

por:

```ts
        include: [INCLUIR_ZONA, incluirAsignacion(veterinarioId)],
```

d) Agregar inmediatamente después del cierre de `listarTurnosAtendibles` (antes del comentario de `bloquearOperativo`):

```ts
/**
 * Turnos no cancelados de los operativos de hoy, por horario (dashboard). Con `veterinarioId`,
 * solo los de los operativos a los que ese integrante del personal está asignado.
 */
export async function listarTurnosDelDia(veterinarioId?: number): Promise<TurnoDto[]> {
  const turnos = await Turno.findAll({
    where: { estado: { [Op.ne]: "cancelado" } },
    include: [
      INCLUIR_ANIMAL,
      {
        association: "operativo",
        attributes: ["id", "fecha", "lugar"],
        where: { fecha: hoyLocal(), estado: { [Op.ne]: "cancelado" } },
        include: veterinarioId ? [INCLUIR_ZONA, incluirAsignacion(veterinarioId)] : [INCLUIR_ZONA],
      },
    ],
    order: [["horario", "ASC"], ["id", "ASC"]],
  });
  return turnos.map(aDto);
}
```

- [ ] **Step 7: `tests/helpers/fabricas.ts` — imports**

Reemplazar estas tres líneas del principio:

```ts
import type { NombreRol } from "@/lib/constantes";
import type { EstadoEnvio, EstadoOperativo, EstadoTurno, TipoNotificacion, TipoPersonal } from "@/lib/constantes";
import { Animal, Notificacion, Operativo, Rol, Turno, Usuario, Vecino, Veterinario, Zona } from "@/lib/db";
```

por:

```ts
import {
  incluyeChipeo, type EstadoAvistamiento, type EstadoEnvio, type EstadoOperativo, type EstadoTurno, type NombreRol,
  type TipoNotificacion, type TipoPersonal, type TipoProcedimiento,
} from "@/lib/constantes";
import {
  Animal, Notificacion, Operativo, Procedimiento, ReporteAvistamiento, Rol, Turno, Usuario, Vecino, Veterinario, Zona,
} from "@/lib/db";
```

- [ ] **Step 8: `tests/helpers/fabricas.ts` — agregar al final**

```ts
/**
 * Crea un procedimiento sobre un turno sin pasar por F7 (para preparar datos de los reportes).
 * Si el tipo incluye chipeo, coloca un chip único de 15 dígitos (lo exige ck_procedimiento_chip).
 */
export async function crearProcedimientoPrueba(
  turnoId: number,
  veterinarioId: number,
  opciones: { tipo?: TipoProcedimiento; fecha?: Date } = {},
): Promise<Procedimiento> {
  secuencia += 1;
  const tipo = opciones.tipo ?? "castracion";
  return Procedimiento.create({
    tipo,
    fecha: opciones.fecha ?? new Date(),
    numero_chip_colocado: incluyeChipeo(tipo) ? String(985_000_000_000_000 + secuencia) : null,
    turno_id: turnoId,
    veterinario_id: veterinarioId,
  });
}

/** Crea un reporte de avistamiento: pendiente por defecto; si se crea atendido, registra la fecha de atención. */
export async function crearAvistamientoPrueba(
  usuarioId: number,
  opciones: { zonaId?: number; fecha?: Date; estado?: EstadoAvistamiento; fechaAtencion?: Date } = {},
): Promise<ReporteAvistamiento> {
  const estado = opciones.estado ?? "pendiente";
  return ReporteAvistamiento.create({
    fecha: opciones.fecha ?? new Date(),
    descripcion: "Perros sueltos en la plaza",
    cantidad_animales: 3,
    estado,
    fecha_atencion: estado === "atendido" ? (opciones.fechaAtencion ?? new Date()) : null,
    zona_id: opciones.zonaId ?? (await zonaSemilla()).id,
    usuario_id: usuarioId,
  });
}
```

- [ ] **Step 9: Verificar tipos y regresión del historial**

Run: `npx tsc --noEmit`
Expected: sin errores.
Run: `npx vitest run tests/services/historial.test.ts tests/services/turnos.test.ts tests/services/operativos.test.ts tests/services/procedimientos.test.ts`
Expected: PASS (los mismos tests que antes: el refactor no cambia comportamiento).

---

### Task 4: Servicio de avistamientos (TDD)

**Files:**
- Create: `src/services/avistamientos.ts`
- Test: `tests/services/avistamientos.test.ts`

- [ ] **Step 1: Escribir el test que falla**

```ts
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ReglaNegocioError, ValidacionError } from "@/lib/errores";
import { ReporteAvistamiento, sequelize } from "@/lib/db";
import { hoyLocal, sumarDias } from "@/lib/fechas";
import type { DatosAvistamiento } from "@/schemas/avistamientos";
import {
  actualizarAvistamiento, atenderAvistamiento, crearAvistamiento, eliminarAvistamiento, listarAvistamientos,
} from "@/services/avistamientos";
import { reiniciarDatos } from "../helpers/bd";
import { adminSemilla, crearOperativoPrueba, crearVecinoPrueba, zonaSemilla } from "../helpers/fabricas";

beforeEach(reiniciarDatos);
afterAll(() => sequelize.close());

const BASE = { pagina: 1, tamanio: 10, busqueda: "" };

/** Datos válidos de un reporte anónimo de hoy a las 00:00 (siempre en el pasado) en la zona indicada. */
function datosReporte(zonaId: number, cambios: Partial<DatosAvistamiento> = {}): DatosAvistamiento {
  return {
    fecha: hoyLocal(),
    hora: "00:00",
    descripcion: "Jauría de cinco perros cerca de la escuela",
    cantidad_animales: 5,
    direccion_referencia: "",
    zona_id: zonaId,
    vecino_id: null,
    ...cambios,
  };
}

describe("alta y listado de avistamientos (F9)", () => {
  it("registra el reporte con el usuario en sesión, pendiente y anónimo o con vecino", async () => {
    const admin = await adminSemilla();
    const zona = await zonaSemilla();
    const anonimo = await crearAvistamiento(datosReporte(zona.id), admin.id);
    expect(anonimo).toMatchObject({ estado: "pendiente", vecino: null, zona: "Centro", fecha_atencion: null });
    expect(anonimo.usuario).toBe(`${admin.nombre} ${admin.apellido}`);
    expect(anonimo.direccion_referencia).toBeNull();

    const vecino = await crearVecinoPrueba();
    const conVecino = await crearAvistamiento(datosReporte(zona.id, { vecino_id: vecino.id }), admin.id);
    expect(conVecino.vecino).toBe(`${vecino.apellido}, ${vecino.nombre}`);
  });

  it("rechaza una fecha futura y una zona inexistente (errores por campo)", async () => {
    const admin = await adminSemilla();
    const zona = await zonaSemilla();
    const futura = crearAvistamiento(datosReporte(zona.id, { fecha: sumarDias(hoyLocal(), 1) }), admin.id);
    await expect(futura).rejects.toMatchObject({ campos: { fecha: "La fecha y hora no pueden ser futuras" } });
    const sinZona = crearAvistamiento(datosReporte(9999), admin.id);
    await expect(sinZona).rejects.toBeInstanceOf(ValidacionError);
    await expect(sinZona).rejects.toMatchObject({ campos: { zona_id: "La zona seleccionada no existe" } });
    expect(await ReporteAvistamiento.count()).toBe(0);
  });

  it("filtra por estado y zona, busca por descripción y ordena del más reciente al más antiguo", async () => {
    const admin = await adminSemilla();
    const centro = await zonaSemilla();
    const austral = await zonaSemilla("Austral");
    const antiguo = await crearAvistamiento(
      datosReporte(centro.id, { fecha: sumarDias(hoyLocal(), -3), descripcion: "Gatos en el baldío" }),
      admin.id,
    );
    const reciente = await crearAvistamiento(datosReporte(centro.id), admin.id);
    const otraZona = await crearAvistamiento(datosReporte(austral.id), admin.id);
    await atenderAvistamiento(otraZona.id, { operativo_id: null });

    const todos = await listarAvistamientos(BASE);
    expect(todos.filas.map((fila) => fila.id)).toEqual([otraZona.id, reciente.id, antiguo.id]);
    expect((await listarAvistamientos({ ...BASE, estado: "pendiente" })).total).toBe(2);
    expect((await listarAvistamientos({ ...BASE, zona_id: austral.id })).filas[0].id).toBe(otraZona.id);
    expect((await listarAvistamientos({ ...BASE, busqueda: "BALDIO" })).filas.map((f) => f.id)).toEqual([antiguo.id]);
    const ultimosDosDias = await listarAvistamientos({ ...BASE, desde: sumarDias(hoyLocal(), -1) });
    expect(ultimosDosDias.total).toBe(2);
  });
});

describe("atención de avistamientos (F9)", () => {
  it("pasa a atendido con fecha de atención y el operativo de la misma zona", async () => {
    const admin = await adminSemilla();
    const zona = await zonaSemilla();
    const operativo = await crearOperativoPrueba({ zonaId: zona.id });
    const reporte = await crearAvistamiento(datosReporte(zona.id), admin.id);

    const atendido = await atenderAvistamiento(reporte.id, { operativo_id: operativo.id });
    expect(atendido.estado).toBe("atendido");
    expect(atendido.fecha_atencion).not.toBeNull();
    expect(atendido.operativo_id).toBe(operativo.id);
    expect(atendido.operativo).toContain("SUM municipal");
  });

  it("rechaza un operativo de otra zona o cancelado, sin cambiar el reporte", async () => {
    const admin = await adminSemilla();
    const zona = await zonaSemilla();
    const otraZona = await crearOperativoPrueba({ zonaId: (await zonaSemilla("Austral")).id });
    const cancelado = await crearOperativoPrueba({ zonaId: zona.id });
    await cancelado.update({
      estado: "cancelado", motivo_cancelacion: "Lluvia", fecha_cancelacion: new Date(), usuario_cancelacion_id: admin.id,
    });
    const reporte = await crearAvistamiento(datosReporte(zona.id), admin.id);

    await expect(atenderAvistamiento(reporte.id, { operativo_id: otraZona.id })).rejects.toMatchObject({
      campos: { operativo_id: "El operativo debe ser de la misma zona que el reporte" },
    });
    await expect(atenderAvistamiento(reporte.id, { operativo_id: cancelado.id })).rejects.toMatchObject({
      campos: { operativo_id: "No se puede asociar un operativo cancelado" },
    });
    expect((await ReporteAvistamiento.findByPk(reporte.id))!.estado).toBe("pendiente");
  });

  it("un reporte atendido no se edita, elimina ni vuelve a atender", async () => {
    const admin = await adminSemilla();
    const zona = await zonaSemilla();
    const reporte = await crearAvistamiento(datosReporte(zona.id), admin.id);
    await atenderAvistamiento(reporte.id, { operativo_id: null });

    await expect(atenderAvistamiento(reporte.id, { operativo_id: null })).rejects.toBeInstanceOf(ReglaNegocioError);
    await expect(actualizarAvistamiento(reporte.id, datosReporte(zona.id))).rejects.toThrow(
      "No se puede editar un reporte ya atendido",
    );
    await expect(eliminarAvistamiento(reporte.id)).rejects.toThrow("No se puede eliminar un reporte ya atendido");
  });

  it("edita y elimina un reporte pendiente", async () => {
    const admin = await adminSemilla();
    const zona = await zonaSemilla();
    const reporte = await crearAvistamiento(datosReporte(zona.id), admin.id);

    const editado = await actualizarAvistamiento(
      reporte.id,
      datosReporte(zona.id, { cantidad_animales: 2, direccion_referencia: "Frente a la plaza" }),
    );
    expect(editado).toMatchObject({ cantidad_animales: 2, direccion_referencia: "Frente a la plaza" });

    await eliminarAvistamiento(reporte.id);
    expect(await ReporteAvistamiento.count()).toBe(0);
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run tests/services/avistamientos.test.ts`
Expected: FAIL (`@/services/avistamientos` no existe).

- [ ] **Step 3: Crear `src/services/avistamientos.ts`**

```ts
import { Op, type Includeable, type Transaction } from "sequelize";
import type { EstadoAvistamiento } from "@/lib/constantes";
import { condicionBusqueda } from "@/lib/busqueda";
import { Operativo, ReporteAvistamiento, sequelize, Vecino, Zona } from "@/lib/db";
import { ReglaNegocioError, ValidacionError } from "@/lib/errores";
import { formatearFecha, instanteLocal } from "@/lib/fechas";
import type { ResultadoPaginado } from "@/schemas/comun";
import type {
  DatosAtenderAvistamiento, DatosAvistamiento, ParametrosListadoAvistamientos,
} from "@/schemas/avistamientos";
import { buscarPorId, condicionDiasLocales, exigirReferencia, nuloSiVacio, paginacion } from "./comun";

/** Representación pública de un reporte de avistamiento (F9). */
export interface AvistamientoDto {
  id: number;
  /** Fecha y hora del avistamiento en ISO 8601. */
  fecha: string;
  descripcion: string;
  cantidad_animales: number;
  direccion_referencia: string | null;
  estado: EstadoAvistamiento;
  /** Fecha y hora de la atención en ISO 8601 (null mientras está pendiente). */
  fecha_atencion: string | null;
  zona_id: number;
  zona: string;
  vecino_id: number | null;
  /** "Apellido, Nombre" del vecino que dio el aviso, o null si es anónimo. */
  vecino: string | null;
  /** "Nombre Apellido" de quien cargó el reporte. */
  usuario: string;
  operativo_id: number | null;
  /** Fecha y lugar del operativo que atendió la zona, si se indicó. */
  operativo: string | null;
}

/** Asociaciones que necesita el DTO. Vecino y operativo son opcionales (LEFT JOIN). */
const INCLUIR_DETALLE: Includeable[] = [
  { association: "zona", attributes: ["id", "nombre"] },
  { association: "vecino", attributes: ["id", "nombre", "apellido"], required: false },
  { association: "usuario", attributes: ["id", "nombre", "apellido"] },
  { association: "operativo", attributes: ["id", "fecha", "lugar"], required: false },
];

/** Convierte el modelo (con sus asociaciones) al DTO público. */
function aDto(reporte: ReporteAvistamiento): AvistamientoDto {
  return {
    id: reporte.id,
    fecha: reporte.fecha.toISOString(),
    descripcion: reporte.descripcion,
    cantidad_animales: reporte.cantidad_animales,
    direccion_referencia: reporte.direccion_referencia,
    estado: reporte.estado,
    fecha_atencion: reporte.fecha_atencion ? reporte.fecha_atencion.toISOString() : null,
    zona_id: reporte.zona_id,
    zona: reporte.zona!.nombre,
    vecino_id: reporte.vecino_id,
    vecino: reporte.vecino ? `${reporte.vecino.apellido}, ${reporte.vecino.nombre}` : null,
    usuario: `${reporte.usuario!.nombre} ${reporte.usuario!.apellido}`,
    operativo_id: reporte.operativo_id,
    operativo: reporte.operativo ? `${formatearFecha(reporte.operativo.fecha)} · ${reporte.operativo.lugar}` : null,
  };
}

/** Obtiene el DTO de un reporte (404 si no existe). */
async function obtenerDto(id: number, transaction?: Transaction): Promise<AvistamientoDto> {
  const reporte = await buscarPorId(ReporteAvistamiento, id, "El reporte de avistamiento no existe", {
    include: INCLUIR_DETALLE,
    transaction,
  });
  return aDto(reporte);
}

/** Bloquea la fila del reporte antes de modificarlo (sin include: no se combina con lock). */
function bloquearReporte(id: number, transaction: Transaction): Promise<ReporteAvistamiento> {
  return buscarPorId(ReporteAvistamiento, id, "El reporte de avistamiento no existe", {
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
}

/** Un reporte atendido queda cerrado: no se edita, elimina ni vuelve a atender (preserva los indicadores de F13). */
function exigirPendiente(reporte: ReporteAvistamiento, accion: string): void {
  if (reporte.estado !== "pendiente") {
    throw new ReglaNegocioError(`No se puede ${accion} un reporte ya atendido`);
  }
}

/**
 * Valida el formulario contra la base (zona y vecino existentes, fecha y hora no futuras)
 * y devuelve los atributos listos para guardar.
 */
async function aAtributos(datos: DatosAvistamiento, transaction: Transaction) {
  await exigirReferencia(Zona, datos.zona_id, "zona_id", "La zona seleccionada no existe", transaction);
  if (datos.vecino_id !== null) {
    await exigirReferencia(Vecino, datos.vecino_id, "vecino_id", "El vecino seleccionado no existe", transaction);
  }
  const fecha = instanteLocal(datos.fecha, datos.hora);
  if (fecha > new Date()) {
    throw new ValidacionError("Revise los datos ingresados", { fecha: "La fecha y hora no pueden ser futuras" });
  }
  return {
    fecha,
    descripcion: datos.descripcion,
    cantidad_animales: datos.cantidad_animales,
    direccion_referencia: nuloSiVacio(datos.direccion_referencia),
    zona_id: datos.zona_id,
    vecino_id: datos.vecino_id,
  };
}

/** Listado paginado (más recientes primero) con búsqueda y filtros de estado, zona y fechas. */
export async function listarAvistamientos(
  parametros: ParametrosListadoAvistamientos,
): Promise<ResultadoPaginado<AvistamientoDto>> {
  const { rows, count } = await ReporteAvistamiento.findAndCountAll({
    where: {
      [Op.and]: [
        condicionBusqueda(
          ["ReporteAvistamiento.descripcion", "ReporteAvistamiento.direccion_referencia", "zona.nombre"],
          parametros.busqueda,
        ),
        parametros.estado ? { estado: parametros.estado } : {},
        parametros.zona_id ? { zona_id: parametros.zona_id } : {},
        condicionDiasLocales("fecha", parametros.desde, parametros.hasta),
      ],
    },
    include: INCLUIR_DETALLE,
    order: [["fecha", "DESC"], ["id", "DESC"]],
    ...paginacion(parametros),
  });
  return { filas: rows.map(aDto), total: count, pagina: parametros.pagina, tamanio: parametros.tamanio };
}

/** Obtiene un reporte por id (404 si no existe). */
export function obtenerAvistamiento(id: number): Promise<AvistamientoDto> {
  return obtenerDto(id);
}

/** Alta de un reporte: lo carga el usuario en sesión y queda pendiente. */
export async function crearAvistamiento(datos: DatosAvistamiento, usuarioId: number): Promise<AvistamientoDto> {
  return sequelize.transaction(async (transaction) => {
    const atributos = await aAtributos(datos, transaction);
    const reporte = await ReporteAvistamiento.create({ ...atributos, usuario_id: usuarioId }, { transaction });
    return obtenerDto(reporte.id, transaction);
  });
}

/** Modificación de un reporte pendiente (conserva el usuario que lo cargó). */
export async function actualizarAvistamiento(id: number, datos: DatosAvistamiento): Promise<AvistamientoDto> {
  return sequelize.transaction(async (transaction) => {
    const reporte = await bloquearReporte(id, transaction);
    exigirPendiente(reporte, "editar");
    await reporte.update(await aAtributos(datos, transaction), { transaction });
    return obtenerDto(id, transaction);
  });
}

/** Baja física de un reporte pendiente (por ejemplo, cargado por error). */
export async function eliminarAvistamiento(id: number): Promise<void> {
  await sequelize.transaction(async (transaction) => {
    const reporte = await bloquearReporte(id, transaction);
    exigirPendiente(reporte, "eliminar");
    await reporte.destroy({ transaction });
  });
}

/**
 * Atención de un reporte: pendiente → atendido, con la fecha de atención actual y,
 * opcionalmente, el operativo que atendió la zona (de la misma zona y no cancelado).
 */
export async function atenderAvistamiento(id: number, datos: DatosAtenderAvistamiento): Promise<AvistamientoDto> {
  return sequelize.transaction(async (transaction) => {
    const reporte = await bloquearReporte(id, transaction);
    exigirPendiente(reporte, "atender");
    if (datos.operativo_id !== null) {
      const operativo = await exigirReferencia(
        Operativo, datos.operativo_id, "operativo_id", "El operativo seleccionado no existe", transaction,
      );
      if (operativo.zona_id !== reporte.zona_id) {
        throw new ValidacionError("Revise los datos ingresados", {
          operativo_id: "El operativo debe ser de la misma zona que el reporte",
        });
      }
      if (operativo.estado === "cancelado") {
        throw new ValidacionError("Revise los datos ingresados", {
          operativo_id: "No se puede asociar un operativo cancelado",
        });
      }
    }
    await reporte.update(
      { estado: "atendido", fecha_atencion: new Date(), operativo_id: datos.operativo_id },
      { transaction },
    );
    return obtenerDto(id, transaction);
  });
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npx vitest run tests/services/avistamientos.test.ts`
Expected: PASS (7 tests).

---

### Task 5: Servicio de reportes estadísticos (TDD)

**Files:**
- Create: `src/services/reportes.ts`
- Test: `tests/services/reportes.test.ts`

- [ ] **Step 1: Escribir el test que falla**

```ts
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { MOTIVOS_CANCELACION, type EstadoOperativo, type EstadoTurno, type TipoProcedimiento } from "@/lib/constantes";
import { sequelize } from "@/lib/db";
import { hoyLocal, instanteLocal, mesesDelRango, sumarDias } from "@/lib/fechas";
import { generarReportes } from "@/services/reportes";
import { reiniciarDatos } from "../helpers/bd";
import {
  adminSemilla, crearAnimalPrueba, crearAvistamientoPrueba, crearOperativoPrueba, crearPersonalPrueba,
  crearProcedimientoPrueba, crearTurnoPrueba, zonaSemilla,
} from "../helpers/fabricas";

beforeEach(reiniciarDatos);
afterAll(() => sequelize.close());

/** Período amplio que contiene todos los datos de prueba (30 días hacia atrás y hacia adelante). */
const periodo = () => ({ desde: sumarDias(hoyLocal(), -30), hasta: sumarDias(hoyLocal(), 30) });

/** Instante local a las 10:00 del día indicado (relativo a hoy). */
const alasDiez = (dias: number) => instanteLocal(sumarDias(hoyLocal(), dias), "10:00");

/**
 * Operativo en el estado indicado. Los cancelados se crean programados y se cancelan con los
 * datos que exige ck_operativo_cancelacion (motivo, fecha y usuario).
 */
async function operativo(dias: number, estado: EstadoOperativo, zonaId: number) {
  if (estado !== "cancelado") return crearOperativoPrueba({ diasDesdeHoy: dias, estado, zonaId });
  const creado = await crearOperativoPrueba({ diasDesdeHoy: dias, zonaId });
  const admin = await adminSemilla();
  return creado.update({
    estado, motivo_cancelacion: "Lluvia", fecha_cancelacion: new Date(), usuario_cancelacion_id: admin.id,
  });
}

/** Turno de un animal nuevo; los cancelados llevan el motivo indicado. */
async function turno(operativoId: number, estado: EstadoTurno, motivo?: string) {
  const creado = await crearTurnoPrueba((await crearAnimalPrueba()).id, operativoId, estado);
  if (motivo) await creado.update({ motivo_cancelacion: motivo });
  return creado;
}

/**
 * Escenario controlado en dos zonas (Centro y Austral):
 * - Centro: A1 realizado (hace 10 días) con 2 completados, 1 "No se presentó" y 1 cancelado por otro motivo;
 *   A2 cancelado (hace 5 días); A3 programado sin cerrar (hace 2 días, sin turnos);
 *   A4 programado futuro (en 5 días) con 1 pendiente; A5 cancelado futuro (en 6 días).
 * - Austral: B1 realizado (hace 3 días) con 1 completado.
 * - Procedimientos: en A1 castración y chipeo + castración; en B1 chipeo.
 */
async function escenario() {
  const centro = await zonaSemilla();
  const austral = await zonaSemilla("Austral");
  const a1 = await operativo(-10, "realizado", centro.id);
  await operativo(-5, "cancelado", centro.id);
  await operativo(-2, "programado", centro.id);
  const a4 = await operativo(5, "programado", centro.id);
  await operativo(6, "cancelado", centro.id);
  const b1 = await operativo(-3, "realizado", austral.id);

  const veterinario = await crearPersonalPrueba();
  const procedimiento = (turnoId: number, tipo: TipoProcedimiento, dias: number) =>
    crearProcedimientoPrueba(turnoId, veterinario.id, { tipo, fecha: alasDiez(dias) });

  await procedimiento((await turno(a1.id, "completado")).id, "castracion_y_chipeo", -10);
  await procedimiento((await turno(a1.id, "completado")).id, "castracion", -10);
  await turno(a1.id, "cancelado", MOTIVOS_CANCELACION.noSePresento);
  await turno(a1.id, "cancelado");
  await turno(a4.id, "pendiente");
  await procedimiento((await turno(b1.id, "completado")).id, "chipeo", -3);
  return { centro, austral, a1, b1, a4 };
}

describe("reportes estadísticos (F13)", () => {
  it("cuenta castraciones y chipeos por zona; castración y chipeo suma a ambos", async () => {
    const { centro, austral } = await escenario();
    const { procedimientos } = await generarReportes(periodo());
    expect(procedimientos).toEqual([
      { zona_id: austral.id, zona: "Austral", castraciones: 0, chipeos: 1 },
      { zona_id: centro.id, zona: "Centro", castraciones: 2, chipeos: 1 },
    ]);
    // Desde hace 2 días ya no entra ningún procedimiento (fueron hace 10 y 3 días).
    const recientes = await generarReportes({ desde: sumarDias(hoyLocal(), -2), hasta: hoyLocal() });
    expect(recientes.procedimientos).toEqual([]);
  });

  it("calcula el cumplimiento solo sobre operativos de fecha pasada", async () => {
    const { austral } = await escenario();
    // Pasados: A1 y B1 realizados, A2 cancelado, A3 sin cerrar. A4 y A5 son futuros.
    const { cumplimiento } = await generarReportes(periodo());
    expect(cumplimiento).toEqual({ realizados: 2, cancelados: 1, sin_cerrar: 1, porcentaje: 66.7 });
    const soloAustral = await generarReportes({ ...periodo(), zona_id: austral.id });
    expect(soloAustral.cumplimiento).toEqual({ realizados: 1, cancelados: 0, sin_cerrar: 0, porcentaje: 100 });
  });

  it("calcula la ocupación de cupo por operativo no cancelado y la total", async () => {
    const { a1, b1, a4 } = await escenario();
    const { ocupacion } = await generarReportes(periodo());
    // Cupo 20 en todos: A1 tiene 2 asignados (los cancelados no ocupan), B1 1, A3 0 y A4 1.
    expect(ocupacion.operativos.map((o) => [o.id, o.asignados, o.porcentaje])).toEqual([
      [a1.id, 2, 10],
      [b1.id, 1, 5],
      [expect.any(Number), 0, 0],
      [a4.id, 1, 5],
    ]);
    expect(ocupacion.operativos[0]).toMatchObject({ fecha: sumarDias(hoyLocal(), -10), zona: "Centro", cupo_maximo: 20 });
    expect(ocupacion.porcentaje).toBe(5); // 4 asignados / 80 lugares
  });

  it("calcula la asistencia: completados / (completados + No se presentó)", async () => {
    const { centro } = await escenario();
    const { asistencia } = await generarReportes(periodo());
    expect(asistencia).toEqual({ completados: 3, ausentes: 1, porcentaje: 75 });
    const soloCentro = await generarReportes({ ...periodo(), zona_id: centro.id });
    expect(soloCentro.asistencia).toEqual({ completados: 2, ausentes: 1, porcentaje: 66.7 });
  });

  it("arma la evolución mensual de avistamientos y el tiempo promedio de atención", async () => {
    const admin = await adminSemilla();
    const centro = await zonaSemilla();
    const austral = await zonaSemilla("Austral");
    await crearAvistamientoPrueba(admin.id, { zonaId: centro.id, fecha: alasDiez(-20) });
    await crearAvistamientoPrueba(admin.id, {
      zonaId: centro.id, fecha: alasDiez(-20), estado: "atendido", fechaAtencion: alasDiez(-18),
    });
    await crearAvistamientoPrueba(admin.id, {
      zonaId: austral.id, fecha: alasDiez(-5), estado: "atendido", fechaAtencion: alasDiez(-1),
    });

    const { avistamientos } = await generarReportes(periodo());
    // Un elemento por cada mes del período, aunque no tenga reportes.
    expect(avistamientos.meses.map((m) => m.mes)).toEqual(mesesDelRango(periodo().desde, periodo().hasta));
    const suma = (clave: "pendientes" | "atendidos") => avistamientos.meses.reduce((t, m) => t + m[clave], 0);
    expect(suma("pendientes")).toBe(1);
    expect(suma("atendidos")).toBe(2);
    const mesDelPrimero = avistamientos.meses.find((m) => m.mes === sumarDias(hoyLocal(), -20).slice(0, 7))!;
    expect(mesDelPrimero.pendientes).toBe(1);
    expect(avistamientos.promedio_dias).toBe(3); // (2 + 4) / 2

    const soloAustral = await generarReportes({ ...periodo(), zona_id: austral.id });
    expect(soloAustral.avistamientos.promedio_dias).toBe(4);
  });

  it("sin datos devuelve listas vacías, ceros y porcentajes nulos", async () => {
    const reporte = await generarReportes(periodo());
    expect(reporte.procedimientos).toEqual([]);
    expect(reporte.cumplimiento).toEqual({ realizados: 0, cancelados: 0, sin_cerrar: 0, porcentaje: null });
    expect(reporte.ocupacion).toEqual({ operativos: [], porcentaje: null });
    expect(reporte.asistencia).toEqual({ completados: 0, ausentes: 0, porcentaje: null });
    expect(reporte.avistamientos.meses.every((m) => m.pendientes === 0 && m.atendidos === 0)).toBe(true);
    expect(reporte.avistamientos.promedio_dias).toBeNull();
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run tests/services/reportes.test.ts`
Expected: FAIL (`@/services/reportes` no existe).

- [ ] **Step 3: Crear `src/services/reportes.ts`**

Notas: los conteos (`COUNT`) y promedios (`AVG`) llegan de PostgreSQL como texto y se convierten con `Number()`/`promedioDeTexto()`; las fechas `DATE` se devuelven con `to_char` para no depender del parser de `pg`; las listas (`:conCastracion`, `:conCupo`) se expanden solas en `IN (...)`.

```ts
import { QueryTypes } from "sequelize";
import {
  ESTADOS_TURNO_CON_CUPO, incluyeCastracion, incluyeChipeo, MOTIVOS_CANCELACION, TIPOS_PROCEDIMIENTO, ZONA_HORARIA,
} from "@/lib/constantes";
import { sequelize } from "@/lib/db";
import { hoyLocal, limitesDelRango, mesesDelRango } from "@/lib/fechas";
import { porcentaje, promedioDeTexto } from "@/lib/indicadores";
import type { FiltrosReportes } from "@/schemas/reportes";

/**
 * Reportes estadísticos (F13). No tienen tablas propias: se calculan con consultas de
 * agregación sobre operativo, turno, procedimiento y reporte_avistamiento (Fase 2, §6).
 * Las consultas usan SQL con parámetros nombrados (`:zonaId`); los valores nunca se
 * concatenan al texto de la consulta.
 */

/** Castraciones y chipeos realizados en los operativos de una zona. */
export interface ProcedimientosZona {
  zona_id: number;
  zona: string;
  castraciones: number;
  chipeos: number;
}

/** Cumplimiento de los operativos ya ocurridos: realizados / (realizados + cancelados). */
export interface CumplimientoOperativos {
  realizados: number;
  cancelados: number;
  /** Operativos de fecha pasada que siguen programados o en curso (no entran en la fórmula). */
  sin_cerrar: number;
  porcentaje: number | null;
}

/** Ocupación del cupo de un operativo: turnos asignados (no cancelados) / cupo máximo. */
export interface OcupacionOperativo {
  id: number;
  /** YYYY-MM-DD */
  fecha: string;
  lugar: string;
  zona: string;
  cupo_maximo: number;
  asignados: number;
  porcentaje: number;
}

/** Asistencia: completados / (completados + cancelados por "No se presentó"). */
export interface Asistencia {
  completados: number;
  ausentes: number;
  porcentaje: number | null;
}

/** Avistamientos de un mes según su estado actual y tiempo promedio de atención. */
export interface AvistamientosMes {
  /** YYYY-MM */
  mes: string;
  pendientes: number;
  atendidos: number;
  /** Días promedio entre el aviso y la atención de los atendidos del mes. */
  promedio_dias: number | null;
}

/** Resultado completo de los reportes para los filtros indicados. */
export interface ReporteEstadistico {
  procedimientos: ProcedimientosZona[];
  cumplimiento: CumplimientoOperativos;
  ocupacion: {
    operativos: OcupacionOperativo[];
    /** Ocupación total del período: suma de asignados / suma de cupos. */
    porcentaje: number | null;
  };
  asistencia: Asistencia;
  avistamientos: {
    meses: AvistamientosMes[];
    /** Promedio de días de atención de todos los atendidos del período. */
    promedio_dias: number | null;
  };
}

/** Parámetros nombrados comunes a todas las consultas. */
interface Parametros {
  /** Zona elegida o null (todas). `:zonaId IS NULL` desactiva el filtro. */
  zonaId: number | null;
  /** Días del período (columnas DATE del operativo). */
  desde: string;
  hasta: string;
  /** Instantes del período (columnas TIMESTAMPTZ): [inicio, fin). */
  inicio: Date;
  fin: Date;
}

/** Ejecuta una consulta de lectura con parámetros nombrados. */
function consultar<T extends object>(sql: string, replacements: Record<string, unknown>): Promise<T[]> {
  return sequelize.query<T>(sql, { replacements, type: QueryTypes.SELECT });
}

/** Castraciones y chipeos por zona del operativo (castración y chipeo suma a ambos). */
async function procedimientosPorZona(parametros: Parametros): Promise<ProcedimientosZona[]> {
  const filas = await consultar<{ zona_id: number; zona: string; castraciones: string; chipeos: string }>(
    `SELECT z.id AS zona_id, z.nombre AS zona,
            COUNT(*) FILTER (WHERE p.tipo IN (:conCastracion)) AS castraciones,
            COUNT(*) FILTER (WHERE p.tipo IN (:conChipeo)) AS chipeos
       FROM procedimiento p
       JOIN turno t ON t.id = p.turno_id
       JOIN operativo o ON o.id = t.operativo_id
       JOIN zona z ON z.id = o.zona_id
      WHERE p.fecha >= :inicio AND p.fecha < :fin
        AND (:zonaId IS NULL OR o.zona_id = :zonaId)
      GROUP BY z.id, z.nombre
      ORDER BY z.nombre`,
    {
      ...parametros,
      // Los tipos se derivan de las reglas de dominio, no de literales repetidos.
      conCastracion: TIPOS_PROCEDIMIENTO.filter(incluyeCastracion),
      conChipeo: TIPOS_PROCEDIMIENTO.filter(incluyeChipeo),
    },
  );
  return filas.map((fila) => ({
    zona_id: fila.zona_id,
    zona: fila.zona,
    castraciones: Number(fila.castraciones),
    chipeos: Number(fila.chipeos),
  }));
}

/** Cumplimiento sobre los operativos del período cuya fecha ya pasó. */
async function cumplimientoOperativos(parametros: Parametros): Promise<CumplimientoOperativos> {
  const [fila] = await consultar<{ realizados: string; cancelados: string; sin_cerrar: string }>(
    `SELECT COUNT(*) FILTER (WHERE o.estado = 'realizado') AS realizados,
            COUNT(*) FILTER (WHERE o.estado = 'cancelado') AS cancelados,
            COUNT(*) FILTER (WHERE o.estado IN ('programado', 'en_curso')) AS sin_cerrar
       FROM operativo o
      WHERE o.fecha BETWEEN :desde AND :hasta
        AND o.fecha < :hoy
        AND (:zonaId IS NULL OR o.zona_id = :zonaId)`,
    { ...parametros, hoy: hoyLocal() },
  );
  const realizados = Number(fila.realizados);
  const cancelados = Number(fila.cancelados);
  return {
    realizados,
    cancelados,
    sin_cerrar: Number(fila.sin_cerrar),
    porcentaje: porcentaje(realizados, realizados + cancelados),
  };
}

/** Ocupación de cada operativo no cancelado del período, en orden cronológico. */
async function ocupacionPorOperativo(parametros: Parametros): Promise<ReporteEstadistico["ocupacion"]> {
  const filas = await consultar<{
    id: number; fecha: string; lugar: string; zona: string; cupo_maximo: number; asignados: string;
  }>(
    `SELECT o.id, to_char(o.fecha, 'YYYY-MM-DD') AS fecha, o.lugar, z.nombre AS zona, o.cupo_maximo,
            (SELECT COUNT(*) FROM turno t WHERE t.operativo_id = o.id AND t.estado IN (:conCupo)) AS asignados
       FROM operativo o
       JOIN zona z ON z.id = o.zona_id
      WHERE o.estado <> 'cancelado'
        AND o.fecha BETWEEN :desde AND :hasta
        AND (:zonaId IS NULL OR o.zona_id = :zonaId)
      ORDER BY o.fecha, o.hora_inicio, o.id`,
    { ...parametros, conCupo: ESTADOS_TURNO_CON_CUPO },
  );
  const operativos = filas.map((fila) => {
    const asignados = Number(fila.asignados);
    return {
      id: fila.id,
      fecha: fila.fecha,
      lugar: fila.lugar,
      zona: fila.zona,
      cupo_maximo: fila.cupo_maximo,
      asignados,
      // El cupo es siempre mayor a 0 (ck_operativo_cupo): el porcentaje nunca es null.
      porcentaje: porcentaje(asignados, fila.cupo_maximo) ?? 0,
    };
  });
  const totalAsignados = operativos.reduce((suma, operativo) => suma + operativo.asignados, 0);
  const totalCupo = operativos.reduce((suma, operativo) => suma + operativo.cupo_maximo, 0);
  return { operativos, porcentaje: porcentaje(totalAsignados, totalCupo) };
}

/** Asistencia a los turnos de los operativos del período. */
async function asistencia(parametros: Parametros): Promise<Asistencia> {
  const [fila] = await consultar<{ completados: string; ausentes: string }>(
    `SELECT COUNT(*) FILTER (WHERE t.estado = 'completado') AS completados,
            COUNT(*) FILTER (WHERE t.estado = 'cancelado' AND t.motivo_cancelacion = :noSePresento) AS ausentes
       FROM turno t
       JOIN operativo o ON o.id = t.operativo_id
      WHERE o.fecha BETWEEN :desde AND :hasta
        AND (:zonaId IS NULL OR o.zona_id = :zonaId)`,
    { ...parametros, noSePresento: MOTIVOS_CANCELACION.noSePresento },
  );
  const completados = Number(fila.completados);
  const ausentes = Number(fila.ausentes);
  return { completados, ausentes, porcentaje: porcentaje(completados, completados + ausentes) };
}

/** Evolución mensual de los avistamientos del período (todos los meses, aunque no tengan reportes). */
async function avistamientosPorMes(parametros: Parametros): Promise<ReporteEstadistico["avistamientos"]> {
  // Días transcurridos entre el aviso y la atención (EPOCH está en segundos).
  const diasDeAtencion = "EXTRACT(EPOCH FROM (r.fecha_atencion - r.fecha)) / 86400";
  const condiciones = `r.fecha >= :inicio AND r.fecha < :fin AND (:zonaId IS NULL OR r.zona_id = :zonaId)`;
  const reemplazos = { ...parametros, zonaHoraria: ZONA_HORARIA };

  const filas = await consultar<{ mes: string; pendientes: string; atendidos: string; promedio_dias: string | null }>(
    `SELECT to_char(r.fecha AT TIME ZONE :zonaHoraria, 'YYYY-MM') AS mes,
            COUNT(*) FILTER (WHERE r.estado = 'pendiente') AS pendientes,
            COUNT(*) FILTER (WHERE r.estado = 'atendido') AS atendidos,
            AVG(${diasDeAtencion}) FILTER (WHERE r.estado = 'atendido') AS promedio_dias
       FROM reporte_avistamiento r
      WHERE ${condiciones}
      GROUP BY 1`,
    reemplazos,
  );
  const [total] = await consultar<{ promedio_dias: string | null }>(
    `SELECT AVG(${diasDeAtencion}) AS promedio_dias
       FROM reporte_avistamiento r
      WHERE r.estado = 'atendido' AND ${condiciones}`,
    reemplazos,
  );

  const porMes = new Map(filas.map((fila) => [fila.mes, fila]));
  return {
    meses: mesesDelRango(parametros.desde, parametros.hasta).map((mes) => {
      const fila = porMes.get(mes);
      return {
        mes,
        pendientes: Number(fila?.pendientes ?? 0),
        atendidos: Number(fila?.atendidos ?? 0),
        promedio_dias: promedioDeTexto(fila?.promedio_dias ?? null),
      };
    }),
    promedio_dias: promedioDeTexto(total.promedio_dias),
  };
}

/** Calcula todos los indicadores de F13 para la zona (o todas) y el rango de fechas. */
export async function generarReportes(filtros: FiltrosReportes): Promise<ReporteEstadistico> {
  const parametros: Parametros = {
    zonaId: filtros.zona_id ?? null,
    desde: filtros.desde,
    hasta: filtros.hasta,
    ...limitesDelRango(filtros.desde, filtros.hasta),
  };
  const [procedimientos, cumplimiento, ocupacion, asistenciaTurnos, avistamientos] = await Promise.all([
    procedimientosPorZona(parametros),
    cumplimientoOperativos(parametros),
    ocupacionPorOperativo(parametros),
    asistencia(parametros),
    avistamientosPorMes(parametros),
  ]);
  return { procedimientos, cumplimiento, ocupacion, asistencia: asistenciaTurnos, avistamientos };
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npx vitest run tests/services/reportes.test.ts`
Expected: PASS (6 tests). Si un valor esperado no coincide, revisar la consulta (lección L4); no cambiar el test.

---

### Task 6: Servicio del dashboard (TDD)

**Files:**
- Create: `src/services/dashboard.ts`
- Test: `tests/services/dashboard.test.ts`

- [ ] **Step 1: Escribir el test que falla**

```ts
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Insumo, OperativoVeterinario, sequelize } from "@/lib/db";
import { resumenDashboard } from "@/services/dashboard";
import { reiniciarDatos } from "../helpers/bd";
import {
  adminSemilla, crearAnimalPrueba, crearAvistamientoPrueba, crearOperativoPrueba, crearTurnoPrueba,
  crearUsuarioPrueba, crearVecinoPrueba, crearVeterinarioConUsuario, sesionDe,
} from "../helpers/fabricas";

beforeEach(reiniciarDatos);
afterAll(() => sequelize.close());

describe("dashboard", () => {
  it("muestra totales, operativos con cupo, insumos bajo mínimo y avistamientos pendientes", async () => {
    const admin = await adminSemilla();
    // Totales: 1 vecino activo y 1 inactivo; 3 animales (1 castrado, 1 chipeado).
    const tutor = await crearVecinoPrueba();
    await crearVecinoPrueba({ activo: false });
    await crearAnimalPrueba({ vecinoId: tutor.id });
    const castrado = await crearAnimalPrueba({ vecinoId: null });
    await castrado.update({ castrado: true });
    await crearAnimalPrueba({ vecinoId: null, numeroChip: "985112000000001" });

    // Operativos: uno con cupo, uno lleno (cupo 1 ocupado) y uno pasado: solo aparece el primero.
    const conCupo = await crearOperativoPrueba({ diasDesdeHoy: 3 });
    const lleno = await crearOperativoPrueba({ diasDesdeHoy: 4 });
    await lleno.update({ cupo_maximo: 1 });
    await crearTurnoPrueba((await crearAnimalPrueba()).id, lleno.id);
    await crearOperativoPrueba({ diasDesdeHoy: -1 });

    await Insumo.create({ nombre: "Ketamina", unidad: "ml", stock_actual: "1.00", stock_minimo: "5.00" });
    await Insumo.create({ nombre: "Guantes", unidad: "par", stock_actual: "50.00", stock_minimo: "5.00" });
    await crearAvistamientoPrueba(admin.id);
    await crearAvistamientoPrueba(admin.id, { estado: "atendido" });

    const resumen = await resumenDashboard(sesionDe(admin, "administrador"));
    if (resumen.tipo !== "general") throw new Error("Se esperaba el resumen general");
    // El animal del turno del operativo lleno (y su tutor) también suman: 2 vecinos activos y 4 animales.
    expect(resumen.totales).toEqual({ vecinos_activos: 2, animales: 4, castrados: 1, chipeados: 1 });
    expect(resumen.proximos_operativos.map((o) => o.id)).toEqual([conCupo.id]);
    expect(resumen.insumos_bajo_minimo.total).toBe(1);
    expect(resumen.insumos_bajo_minimo.filas[0].nombre).toBe("Ketamina");
    expect(resumen.avistamientos_pendientes.total).toBe(1);
  });

  it("lista los turnos de hoy: todos para el operador, solo los asignados para el veterinario", async () => {
    const { usuario, personal } = await crearVeterinarioConUsuario();
    const asignado = await crearOperativoPrueba({ diasDesdeHoy: 0 });
    const otro = await crearOperativoPrueba({ diasDesdeHoy: 0 });
    const manana = await crearOperativoPrueba({ diasDesdeHoy: 1 });
    await OperativoVeterinario.create({ operativo_id: asignado.id, veterinario_id: personal.id });
    await OperativoVeterinario.create({ operativo_id: manana.id, veterinario_id: personal.id });

    const propio = await crearTurnoPrueba((await crearAnimalPrueba()).id, asignado.id, "confirmado");
    await crearTurnoPrueba((await crearAnimalPrueba()).id, asignado.id, "cancelado");
    const ajeno = await crearTurnoPrueba((await crearAnimalPrueba()).id, otro.id);
    await crearTurnoPrueba((await crearAnimalPrueba()).id, manana.id, "confirmado");

    const operador = await crearUsuarioPrueba({ rol: "operador" });
    const general = await resumenDashboard(sesionDe(operador, "operador"));
    expect(general.turnos_hoy.map((t) => t.id).sort()).toEqual([propio.id, ajeno.id].sort());

    const veterinario = await resumenDashboard(sesionDe(usuario, "veterinario"));
    expect(veterinario).toMatchObject({ tipo: "veterinario", motivo: null });
    expect(veterinario.turnos_hoy.map((t) => t.id)).toEqual([propio.id]);
  });

  it("avisa al veterinario sin vínculo con el personal", async () => {
    const usuario = await crearUsuarioPrueba({ rol: "veterinario" });
    const resumen = await resumenDashboard(sesionDe(usuario, "veterinario"));
    expect(resumen).toMatchObject({ tipo: "veterinario", turnos_hoy: [] });
    if (resumen.tipo !== "veterinario") throw new Error("Se esperaba el resumen del veterinario");
    expect(resumen.motivo).toContain("no está vinculado");
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run tests/services/dashboard.test.ts`
Expected: FAIL (`@/services/dashboard` no existe).

- [ ] **Step 3: Crear `src/services/dashboard.ts`**

```ts
import { Op } from "sequelize";
import type { DatosSesion } from "@/lib/auth";
import { Animal, Vecino, Veterinario } from "@/lib/db";
import type { ResultadoPaginado } from "@/schemas/comun";
import { listarAvistamientos, type AvistamientoDto } from "./avistamientos";
import { listarInsumos, type InsumoDto } from "./insumos";
import { proximosOperativosConCupo, type OperativoDto } from "./operativos";
import { listarTurnosDelDia, type TurnoDto } from "./turnos";

/** Cantidad de elementos de cada lista del dashboard. */
const LIMITE_LISTAS = 5;

/** Totales generales del programa. */
export interface TotalesDashboard {
  vecinos_activos: number;
  animales: number;
  castrados: number;
  chipeados: number;
}

/**
 * Contenido del inicio según el rol. Administrador y operador ven el panorama completo;
 * el veterinario ve solo sus turnos del día (spec §4).
 */
export type ResumenDashboard =
  | {
      tipo: "general";
      totales: TotalesDashboard;
      proximos_operativos: OperativoDto[];
      turnos_hoy: TurnoDto[];
      /** Primeros insumos con stock en o por debajo del mínimo; `total` indica cuántos hay. */
      insumos_bajo_minimo: ResultadoPaginado<InsumoDto>;
      /** Avistamientos pendientes más recientes; `total` indica cuántos hay. */
      avistamientos_pendientes: ResultadoPaginado<AvistamientoDto>;
    }
  | {
      tipo: "veterinario";
      turnos_hoy: TurnoDto[];
      /** Motivo por el que no se pueden mostrar turnos (usuario sin vínculo con el personal). */
      motivo: string | null;
    };

/** Totales de vecinos activos y de animales (castrados y chipeados). */
async function totales(): Promise<TotalesDashboard> {
  const [vecinosActivos, animales, castrados, chipeados] = await Promise.all([
    Vecino.count({ where: { activo: true } }),
    Animal.count(),
    Animal.count({ where: { castrado: true } }),
    Animal.count({ where: { numero_chip: { [Op.ne]: null } } }),
  ]);
  return { vecinos_activos: vecinosActivos, animales, castrados, chipeados };
}

/** Turnos del día del veterinario en sesión (los de los operativos a los que está asignado). */
async function resumenVeterinario(usuarioId: number): Promise<ResumenDashboard> {
  const personal = await Veterinario.findOne({ where: { usuario_id: usuarioId } });
  if (!personal) {
    return {
      tipo: "veterinario",
      turnos_hoy: [],
      motivo: "Su usuario no está vinculado a ningún integrante del personal: pida al administrador que lo vincule",
    };
  }
  return { tipo: "veterinario", turnos_hoy: await listarTurnosDelDia(personal.id), motivo: null };
}

/** Arma el contenido del inicio para el usuario en sesión, reutilizando los servicios de cada módulo. */
export async function resumenDashboard(sesion: DatosSesion): Promise<ResumenDashboard> {
  if (sesion.rol === "veterinario") {
    return resumenVeterinario(sesion.usuarioId);
  }
  const primeros = { pagina: 1, tamanio: LIMITE_LISTAS, busqueda: "" };
  const [totalesGenerales, proximos, turnosHoy, insumos, avistamientos] = await Promise.all([
    totales(),
    proximosOperativosConCupo(LIMITE_LISTAS),
    listarTurnosDelDia(),
    listarInsumos({ ...primeros, stock: "bajo_minimo" }),
    listarAvistamientos({ ...primeros, estado: "pendiente" }),
  ]);
  return {
    tipo: "general",
    totales: totalesGenerales,
    proximos_operativos: proximos,
    turnos_hoy: turnosHoy,
    insumos_bajo_minimo: insumos,
    avistamientos_pendientes: avistamientos,
  };
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npx vitest run tests/services/dashboard.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Suite completa**

Run: `npm test`
Expected: PASS, **152 tests** (131 previos + 21 nuevos).

---

### Task 7: API REST

**Files:**
- Create: `src/app/api/avistamientos/route.ts`, `src/app/api/avistamientos/[id]/route.ts`, `src/app/api/avistamientos/[id]/atender/route.ts`, `src/app/api/avistamientos/operativos/route.ts`, `src/app/api/reportes/route.ts`, `src/app/api/dashboard/route.ts`

- [ ] **Step 1: `src/app/api/avistamientos/route.ts`**

```ts
import { NextResponse } from "next/server";
import { leerCuerpo, leerParametros, manejarApi } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { esquemaAvistamiento, esquemaListadoAvistamientos } from "@/schemas/avistamientos";
import { crearAvistamiento, listarAvistamientos } from "@/services/avistamientos";

/** GET /api/avistamientos?pagina=&tamanio=&busqueda=&estado=&zona_id=&desde=&hasta= — listado (todos los roles). */
export const GET = manejarApi(async (request) => {
  await requerirSesion("avistamientos:ver");
  return NextResponse.json(await listarAvistamientos(leerParametros(request, esquemaListadoAvistamientos)));
});

/** POST /api/avistamientos — alta; queda registrado el usuario en sesión (administrador u operador). */
export const POST = manejarApi(async (request) => {
  const sesion = await requerirSesion("avistamientos:gestionar");
  const datos = await leerCuerpo(request, esquemaAvistamiento);
  return NextResponse.json(await crearAvistamiento(datos, sesion.usuarioId), { status: 201 });
});
```

- [ ] **Step 2: `src/app/api/avistamientos/[id]/route.ts`**

```ts
import { NextResponse } from "next/server";
import { leerCuerpo, leerId, manejarApi, type ContextoId } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { esquemaAvistamiento } from "@/schemas/avistamientos";
import { actualizarAvistamiento, eliminarAvistamiento, obtenerAvistamiento } from "@/services/avistamientos";

/** GET /api/avistamientos/:id */
export const GET = manejarApi<ContextoId>(async (_request, { params }) => {
  await requerirSesion("avistamientos:ver");
  return NextResponse.json(await obtenerAvistamiento(await leerId(params)));
});

/** PUT /api/avistamientos/:id — modificación de un reporte pendiente (409 si ya fue atendido). */
export const PUT = manejarApi<ContextoId>(async (request, { params }) => {
  await requerirSesion("avistamientos:gestionar");
  const id = await leerId(params);
  const datos = await leerCuerpo(request, esquemaAvistamiento);
  return NextResponse.json(await actualizarAvistamiento(id, datos));
});

/** DELETE /api/avistamientos/:id — baja de un reporte pendiente (204; 409 si ya fue atendido). */
export const DELETE = manejarApi<ContextoId>(async (_request, { params }) => {
  await requerirSesion("avistamientos:gestionar");
  await eliminarAvistamiento(await leerId(params));
  return new NextResponse(null, { status: 204 });
});
```

- [ ] **Step 3: `src/app/api/avistamientos/[id]/atender/route.ts`**

```ts
import { NextResponse } from "next/server";
import { leerCuerpo, leerId, manejarApi, type ContextoId } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { esquemaAtenderAvistamiento } from "@/schemas/avistamientos";
import { atenderAvistamiento } from "@/services/avistamientos";

/** POST /api/avistamientos/:id/atender — pendiente → atendido, con operativo opcional de la misma zona. */
export const POST = manejarApi<ContextoId>(async (request, { params }) => {
  await requerirSesion("avistamientos:gestionar");
  const id = await leerId(params);
  const datos = await leerCuerpo(request, esquemaAtenderAvistamiento);
  return NextResponse.json(await atenderAvistamiento(id, datos));
});
```

- [ ] **Step 4: `src/app/api/avistamientos/operativos/route.ts`**

```ts
import { NextResponse } from "next/server";
import { leerParametros, manejarApi } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { esquemaOperativosZona } from "@/schemas/avistamientos";
import { opcionesOperativosDeZona } from "@/services/operativos";

/** GET /api/avistamientos/operativos?zona_id= — operativos no cancelados de la zona, para atender un reporte. */
export const GET = manejarApi(async (request) => {
  await requerirSesion("avistamientos:gestionar");
  const { zona_id } = leerParametros(request, esquemaOperativosZona);
  return NextResponse.json(await opcionesOperativosDeZona(zona_id));
});
```

- [ ] **Step 5: `src/app/api/reportes/route.ts`**

```ts
import { NextResponse } from "next/server";
import { leerParametros, manejarApi } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { esquemaFiltrosReportes } from "@/schemas/reportes";
import { generarReportes } from "@/services/reportes";

/** GET /api/reportes?desde=&hasta=&zona_id= — indicadores de F13 (administrador y operador). */
export const GET = manejarApi(async (request) => {
  await requerirSesion("reportes:ver");
  return NextResponse.json(await generarReportes(leerParametros(request, esquemaFiltrosReportes)));
});
```

- [ ] **Step 6: `src/app/api/dashboard/route.ts`**

```ts
import { NextResponse } from "next/server";
import { manejarApi } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { resumenDashboard } from "@/services/dashboard";

/** GET /api/dashboard — resumen del inicio según el rol del usuario en sesión. */
export const GET = manejarApi(async () => {
  const sesion = await requerirSesion("dashboard:ver");
  return NextResponse.json(await resumenDashboard(sesion));
});
```

- [ ] **Step 7: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

---

### Task 8: Componentes comunes y pantalla de avistamientos

**Files:**
- Create: `src/components/comunes/{filtro-fecha,filtro-zona,area-texto}.tsx`, `src/components/avistamientos/{formulario-avistamiento,formulario-atender-avistamiento,gestion-avistamientos}.tsx`, `src/app/(panel)/avistamientos/page.tsx`
- Modify: `src/components/historial/historial-clinico.tsx`, `src/components/procedimientos/formulario-procedimiento.tsx`

- [ ] **Step 1: Crear `src/components/comunes/filtro-fecha.tsx`** (se extrae del historial para reutilizarlo)

```tsx
"use client";

import { Input } from "@/components/ui/input";

/** Filtro de fecha de un listado o reporte: campo de fecha accesible con etiqueta y tooltip. */
export function FiltroFecha({ etiqueta, valor, onCambiar }: {
  /** Nombre accesible del filtro (no se muestra). */
  etiqueta: string;
  valor: string;
  onCambiar: (valor: string) => void;
}) {
  return (
    <Input
      type="date"
      aria-label={etiqueta}
      title={etiqueta}
      className="w-auto"
      value={valor}
      onChange={(evento) => onCambiar(evento.target.value)}
    />
  );
}
```

- [ ] **Step 2: `src/components/historial/historial-clinico.tsx` — usar el componente común**

a) Eliminar la línea `import { Input } from "@/components/ui/input";`.

b) Agregar debajo de `import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";`:

```tsx
import { FiltroFecha } from "@/components/comunes/filtro-fecha";
```

c) Eliminar la función local completa `FiltroFecha` (desde el comentario `/** Filtro de fecha del historial: …` hasta su `}` de cierre, inclusive). Los usos `<FiltroFecha … />` no cambian.

- [ ] **Step 3: Crear `src/components/comunes/filtro-zona.tsx`**

```tsx
"use client";

import useSWR from "swr";
import { obtenerJson } from "@/lib/cliente-api";
import type { Opcion } from "@/schemas/comun";
import { FiltroSelect } from "./filtro-select";

/** Filtro de zona de un listado o reporte: "Todas las zonas" (valor vacío) o una zona puntual. */
export function FiltroZona({ valor, onCambiar }: { valor: string; onCambiar: (valor: string) => void }) {
  const { data: zonas } = useSWR<Opcion[]>("/api/zonas/opciones", obtenerJson);
  return (
    <FiltroSelect
      etiqueta="Zona"
      valor={valor}
      opciones={(zonas ?? []).map((zona) => ({ valor: String(zona.id), etiqueta: zona.etiqueta }))}
      etiquetaTodos="Todas las zonas"
      onCambiar={onCambiar}
    />
  );
}
```

- [ ] **Step 4: Crear `src/components/comunes/area-texto.tsx`**

```tsx
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Área de texto con el mismo aspecto que `Input` (no hay componente Textarea de shadcn instalado).
 * Acepta las props de `<textarea>`, incluido lo que devuelve `register()` de react-hook-form.
 */
export function AreaTexto({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "min-h-20 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}
```

- [ ] **Step 5: `src/components/procedimientos/formulario-procedimiento.tsx` — usar `AreaTexto`**

a) Agregar inmediatamente **antes** de `import { CampoFormulario } from "@/components/comunes/campo-formulario";`:

```tsx
import { AreaTexto } from "@/components/comunes/area-texto";
```

b) Eliminar estas líneas (y la línea en blanco que las sigue):

```tsx
/** Clases de un textarea con el mismo aspecto que `Input` (no hay componente Textarea instalado). */
const CLASES_TEXTAREA =
  "min-h-20 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none " +
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
```

c) Reemplazar `<textarea id="observaciones" className={CLASES_TEXTAREA} {...register("observaciones")} />` por:

```tsx
<AreaTexto id="observaciones" {...register("observaciones")} />
```

- [ ] **Step 6: Crear `src/components/avistamientos/formulario-avistamiento.tsx`**

```tsx
"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AreaTexto } from "@/components/comunes/area-texto";
import { CampoFormulario } from "@/components/comunes/campo-formulario";
import { FormularioDialogo } from "@/components/comunes/formulario-dialogo";
import { SelectOpciones } from "@/components/comunes/select-opciones";
import { Input } from "@/components/ui/input";
import { llamarApi } from "@/lib/cliente-api";
import { hoyLocal, partesLocales } from "@/lib/fechas";
import { mostrarErrorFormulario } from "@/lib/formularios";
import { esquemaAvistamiento, type DatosAvistamiento } from "@/schemas/avistamientos";
import type { AvistamientoDto } from "@/services/avistamientos";

/** Valores iniciales: los del reporte en edición o, en un alta, la fecha y hora actuales. */
function valoresIniciales(reporte: AvistamientoDto | null): DatosAvistamiento {
  if (!reporte) {
    return {
      ...partesLocales(new Date()),
      descripcion: "",
      cantidad_animales: 1,
      direccion_referencia: "",
      // null hasta que se elige (el esquema responde "Seleccione una zona").
      zona_id: null as unknown as number,
      vecino_id: null,
    };
  }
  return {
    ...partesLocales(reporte.fecha),
    descripcion: reporte.descripcion,
    cantidad_animales: reporte.cantidad_animales,
    direccion_referencia: reporte.direccion_referencia ?? "",
    zona_id: reporte.zona_id,
    vecino_id: reporte.vecino_id,
  };
}

/** Diálogo de alta/edición de un reporte de avistamiento (F9). Valida con el mismo esquema que la API. */
export function FormularioAvistamiento({ reporte, onCerrar, onGuardado }: {
  reporte: AvistamientoDto | null;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const { register, control, handleSubmit, setError, formState } = useForm<DatosAvistamiento>({
    resolver: zodResolver(esquemaAvistamiento),
    defaultValues: valoresIniciales(reporte),
  });

  async function guardar(datos: DatosAvistamiento) {
    try {
      await llamarApi(reporte ? `/api/avistamientos/${reporte.id}` : "/api/avistamientos", {
        metodo: reporte ? "PUT" : "POST",
        cuerpo: datos,
      });
      toast.success(reporte ? "Reporte actualizado" : "Reporte registrado");
      onGuardado();
    } catch (error) {
      mostrarErrorFormulario(error, setError, "No se pudo guardar el reporte");
    }
  }

  // En edición se incluye al vecino actual aunque esté dado de baja.
  const urlVecinos = reporte?.vecino_id ? `/api/vecinos/opciones?incluirId=${reporte.vecino_id}` : "/api/vecinos/opciones";
  const errores = formState.errors;
  return (
    <FormularioDialogo
      titulo={reporte ? "Editar avistamiento" : "Nuevo avistamiento"}
      descripcion="Aviso de animales sueltos por zona (sin GPS). El vecino que avisó es opcional."
      idFormulario="formulario-avistamiento"
      enviando={formState.isSubmitting}
      amplio
      onCerrar={onCerrar}
    >
      <form id="formulario-avistamiento" onSubmit={handleSubmit(guardar)} className="grid gap-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-3">
          <CampoFormulario id="fecha" etiqueta="Fecha" error={errores.fecha?.message}>
            <Input id="fecha" type="date" max={hoyLocal()} {...register("fecha")} />
          </CampoFormulario>
          <CampoFormulario id="hora" etiqueta="Hora" error={errores.hora?.message}>
            <Input id="hora" type="time" {...register("hora")} />
          </CampoFormulario>
          <CampoFormulario id="cantidad_animales" etiqueta="Cantidad de animales" error={errores.cantidad_animales?.message}>
            <Input
              id="cantidad_animales"
              type="number"
              min={1}
              {...register("cantidad_animales", { valueAsNumber: true })}
            />
          </CampoFormulario>
        </div>
        <CampoFormulario id="zona_id" etiqueta="Zona" error={errores.zona_id?.message}>
          <Controller
            control={control}
            name="zona_id"
            render={({ field }) => (
              <SelectOpciones
                id="zona_id"
                url="/api/zonas/opciones"
                valor={field.value}
                onCambiar={field.onChange}
                invalido={!!errores.zona_id}
              />
            )}
          />
        </CampoFormulario>
        <CampoFormulario
          id="direccion_referencia"
          etiqueta="Dirección o referencia (opcional)"
          error={errores.direccion_referencia?.message}
        >
          <Input id="direccion_referencia" {...register("direccion_referencia")} />
        </CampoFormulario>
        <CampoFormulario id="vecino_id" etiqueta="Vecino que dio el aviso (opcional)" error={errores.vecino_id?.message}>
          <Controller
            control={control}
            name="vecino_id"
            render={({ field }) => (
              <SelectOpciones
                id="vecino_id"
                url={urlVecinos}
                valor={field.value}
                onCambiar={field.onChange}
                placeholder="Anónimo / sin identificar"
              />
            )}
          />
        </CampoFormulario>
        <CampoFormulario id="descripcion" etiqueta="Descripción" error={errores.descripcion?.message}>
          <AreaTexto id="descripcion" aria-invalid={!!errores.descripcion || undefined} {...register("descripcion")} />
        </CampoFormulario>
      </form>
    </FormularioDialogo>
  );
}
```

- [ ] **Step 7: Crear `src/components/avistamientos/formulario-atender-avistamiento.tsx`**

```tsx
"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { CampoFormulario } from "@/components/comunes/campo-formulario";
import { FormularioDialogo } from "@/components/comunes/formulario-dialogo";
import { SelectOpciones } from "@/components/comunes/select-opciones";
import { llamarApi } from "@/lib/cliente-api";
import { mostrarErrorFormulario } from "@/lib/formularios";
import { esquemaAtenderAvistamiento, type DatosAtenderAvistamiento } from "@/schemas/avistamientos";
import type { AvistamientoDto } from "@/services/avistamientos";

/**
 * Diálogo para marcar un reporte como atendido (F9). La fecha de atención es la actual;
 * el operativo es opcional y solo se ofrecen los no cancelados de la zona del reporte.
 */
export function FormularioAtenderAvistamiento({ reporte, onCerrar, onGuardado }: {
  reporte: AvistamientoDto;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const { control, handleSubmit, setError, formState } = useForm<DatosAtenderAvistamiento>({
    resolver: zodResolver(esquemaAtenderAvistamiento),
    defaultValues: { operativo_id: null },
  });

  async function guardar(datos: DatosAtenderAvistamiento) {
    try {
      await llamarApi(`/api/avistamientos/${reporte.id}/atender`, { metodo: "POST", cuerpo: datos });
      toast.success("Reporte marcado como atendido");
      onGuardado();
    } catch (error) {
      mostrarErrorFormulario(error, setError, "No se pudo atender el reporte");
    }
  }

  const error = formState.errors.operativo_id?.message;
  return (
    <FormularioDialogo
      titulo="Atender avistamiento"
      descripcion={`Zona ${reporte.zona} · ${reporte.cantidad_animales} animal(es). Se registra la fecha y hora actuales como atención.`}
      idFormulario="formulario-atender-avistamiento"
      enviando={formState.isSubmitting}
      textoEnviar="Marcar como atendido"
      onCerrar={onCerrar}
    >
      <form id="formulario-atender-avistamiento" onSubmit={handleSubmit(guardar)} className="grid gap-4" noValidate>
        <CampoFormulario id="operativo_id" etiqueta="Operativo que atendió la zona (opcional)" error={error}>
          <Controller
            control={control}
            name="operativo_id"
            render={({ field }) => (
              <SelectOpciones
                id="operativo_id"
                url={`/api/avistamientos/operativos?zona_id=${reporte.zona_id}`}
                valor={field.value}
                onCambiar={field.onChange}
                placeholder="Sin operativo asociado"
                invalido={!!error}
              />
            )}
          />
        </CampoFormulario>
      </form>
    </FormularioDialogo>
  );
}
```

- [ ] **Step 8: Crear `src/components/avistamientos/gestion-avistamientos.tsx`**

```tsx
"use client";

import { useState } from "react";
import { CircleCheck, Plus } from "lucide-react";
import { toast } from "sonner";
import { AccionesFila } from "@/components/comunes/acciones-fila";
import { BadgeAvistamiento } from "@/components/comunes/badges-dominio";
import { ConfirmarDialogo } from "@/components/comunes/confirmar-dialogo";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FiltroFecha } from "@/components/comunes/filtro-fecha";
import { FiltroSelect } from "@/components/comunes/filtro-select";
import { FiltroZona } from "@/components/comunes/filtro-zona";
import { ListadoPaginado } from "@/components/comunes/listado-paginado";
import type { Columna } from "@/components/comunes/tabla-datos";
import { Button } from "@/components/ui/button";
import { useEdicion } from "@/hooks/use-edicion";
import { useListado } from "@/hooks/use-listado";
import { llamarApi } from "@/lib/cliente-api";
import { ETIQUETAS_ESTADO_AVISTAMIENTO, opcionesDeEtiquetas } from "@/lib/etiquetas";
import { formatearFechaHora } from "@/lib/fechas";
import { mensajeDeError } from "@/lib/formularios";
import type { AvistamientoDto } from "@/services/avistamientos";
import { FormularioAtenderAvistamiento } from "./formulario-atender-avistamiento";
import { FormularioAvistamiento } from "./formulario-avistamiento";

/**
 * Pantalla de F9: listado con búsqueda y filtros. Administrador y operador cargan, editan,
 * eliminan y atienden los reportes pendientes; el veterinario solo consulta.
 */
export function GestionAvistamientos({ puedeGestionar }: { puedeGestionar: boolean }) {
  const listado = useListado<AvistamientoDto>("/api/avistamientos", { estado: "", zona_id: "", desde: "", hasta: "" });
  const edicion = useEdicion<AvistamientoDto>();
  const [aAtender, setAAtender] = useState<AvistamientoDto | null>(null);

  async function eliminar() {
    if (!edicion.aEliminar) return;
    try {
      await llamarApi(`/api/avistamientos/${edicion.aEliminar.id}`, { metodo: "DELETE" });
      toast.success("Reporte eliminado");
      edicion.cerrarEliminar();
      await listado.recargar();
    } catch (error) {
      toast.error(mensajeDeError(error, "No se pudo eliminar el reporte"));
    }
  }

  const columnas: Columna<AvistamientoDto>[] = [
    { titulo: "Fecha", celda: (r) => formatearFechaHora(r.fecha) },
    { titulo: "Zona", celda: (r) => r.zona },
    { titulo: "Animales", className: "text-right", celda: (r) => r.cantidad_animales },
    {
      titulo: "Descripción",
      celda: (r) => (
        <div className="max-w-sm whitespace-normal">
          <p className="text-sm">{r.descripcion}</p>
          {r.direccion_referencia && <p className="text-xs text-muted-foreground">{r.direccion_referencia}</p>}
        </div>
      ),
    },
    { titulo: "Aviso de", celda: (r) => r.vecino ?? "Anónimo" },
    {
      titulo: "Estado",
      celda: (r) => (
        <div className="grid justify-items-start gap-0.5">
          <BadgeAvistamiento estado={r.estado} />
          {r.fecha_atencion && (
            <span className="text-xs text-muted-foreground">
              {formatearFechaHora(r.fecha_atencion)}
              {r.operativo && ` · ${r.operativo}`}
            </span>
          )}
        </div>
      ),
    },
    ...(puedeGestionar
      ? [{
          titulo: "Acciones",
          className: "w-32 text-right",
          // Los reportes atendidos quedan cerrados: no tienen acciones.
          celda: (r: AvistamientoDto) =>
            r.estado === "pendiente" && (
              <AccionesFila onEditar={() => edicion.abrirEdicion(r)} onEliminar={() => edicion.pedirEliminar(r)}>
                <Button variant="ghost" size="icon-sm" aria-label="Atender" title="Atender" onClick={() => setAAtender(r)}>
                  <CircleCheck />
                </Button>
              </AccionesFila>
            ),
        }]
      : []),
  ];

  return (
    <>
      <EncabezadoPagina
        titulo="Avistamientos"
        descripcion="Avisos de animales sueltos por zona, cargados por el personal municipal."
        acciones={puedeGestionar && <Button onClick={edicion.abrirAlta}><Plus /> Nuevo avistamiento</Button>}
      />
      <ListadoPaginado
        listado={listado}
        columnas={columnas}
        claveFila={(r) => r.id}
        placeholderBusqueda="Buscar por descripción, dirección o zona"
        mensajeVacio="No hay reportes de avistamiento"
        filtros={
          <>
            <FiltroSelect
              etiqueta="Estado"
              valor={listado.filtros.estado}
              opciones={opcionesDeEtiquetas(ETIQUETAS_ESTADO_AVISTAMIENTO)}
              etiquetaTodos="Todos los estados"
              onCambiar={(valor) => listado.filtrar("estado", valor)}
            />
            <FiltroZona valor={listado.filtros.zona_id} onCambiar={(valor) => listado.filtrar("zona_id", valor)} />
            <FiltroFecha etiqueta="Desde" valor={listado.filtros.desde} onCambiar={(valor) => listado.filtrar("desde", valor)} />
            <FiltroFecha etiqueta="Hasta" valor={listado.filtros.hasta} onCambiar={(valor) => listado.filtrar("hasta", valor)} />
          </>
        }
      />

      {edicion.formulario && (
        <FormularioAvistamiento
          reporte={edicion.formulario.registro}
          onCerrar={edicion.cerrarFormulario}
          onGuardado={async () => {
            edicion.cerrarFormulario();
            await listado.recargar();
          }}
        />
      )}
      {aAtender && (
        <FormularioAtenderAvistamiento
          reporte={aAtender}
          onCerrar={() => setAAtender(null)}
          onGuardado={async () => {
            setAAtender(null);
            await listado.recargar();
          }}
        />
      )}
      <ConfirmarDialogo
        abierto={edicion.aEliminar !== null}
        titulo="Eliminar reporte"
        descripcion="¿Eliminar este reporte de avistamiento? Solo es posible mientras está pendiente."
        textoConfirmar="Eliminar"
        onConfirmar={eliminar}
        onCerrar={edicion.cerrarEliminar}
      />
    </>
  );
}
```

- [ ] **Step 9: Crear `src/app/(panel)/avistamientos/page.tsx`**

```tsx
import { GestionAvistamientos } from "@/components/avistamientos/gestion-avistamientos";
import { tienePermiso } from "@/lib/permisos";
import { exigirPermisoPagina } from "@/lib/sesion";

/** F9 — Avistamientos (gestión: administrador y operador; consulta: veterinario). */
export default async function PaginaAvistamientos() {
  const sesion = await exigirPermisoPagina("avistamientos:ver");
  return <GestionAvistamientos puedeGestionar={tienePermiso(sesion.rol, "avistamientos:gestionar")} />;
}
```

- [ ] **Step 10: Verificar**

Run: `npx tsc --noEmit` → sin errores.
Run: `npm run lint` → 0 errores (1 advertencia previa aceptada en `src/lib/cliente-api.ts`).

---

### Task 9: Pantalla de reportes

**Files:**
- Create: `src/components/reportes/grafico-barras.tsx`, `src/components/reportes/reportes-estadisticos.tsx`, `src/app/(panel)/reportes/page.tsx`

- [ ] **Step 1: Crear `src/components/reportes/grafico-barras.tsx`**

```tsx
"use client";

import { Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from "recharts";

/** Colores de las series: contrastan sobre fondo claro y oscuro (el tema base es en grises). */
export const COLORES_GRAFICO = {
  azul: "#0284c7",
  verde: "#059669",
  ambar: "#d97706",
  rojo: "#dc2626",
} as const;

/** Serie de un gráfico de barras: propiedad del dato, nombre en la leyenda y color. */
export interface SerieGrafico<T> {
  clave: Extract<keyof T, string>;
  nombre: string;
  color: string;
}

/**
 * Gráfico de barras de Recharts para los reportes (F13). `responsive` ajusta el ancho al
 * contenedor (Recharts 3, sin ResponsiveContainer). Sin datos no dibuja nada: la tabla
 * del indicador ya muestra el mensaje de lista vacía.
 */
export function GraficoBarras<T extends object>({ datos, claveX, series, apiladas, porcentaje, alto = 260 }: {
  datos: T[];
  /** Propiedad que se muestra en el eje horizontal. */
  claveX: Extract<keyof T, string>;
  series: SerieGrafico<T>[];
  /** Apila las series en una sola barra (ej.: pendientes + atendidos). */
  apiladas?: boolean;
  /** Eje vertical de 0 a 100 con el sufijo "%". */
  porcentaje?: boolean;
  alto?: number;
}) {
  if (datos.length === 0) return null;
  const ticks = { fontSize: 12, fill: "var(--muted-foreground)" };
  return (
    <BarChart
      responsive
      data={datos}
      style={{ width: "100%", height: alto }}
      margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
    >
      <CartesianGrid strokeDasharray="3 3" vertical={false} />
      <XAxis dataKey={claveX} tick={ticks} />
      <YAxis
        allowDecimals={false}
        width={44}
        domain={porcentaje ? [0, 100] : undefined}
        unit={porcentaje ? "%" : undefined}
        tick={ticks}
      />
      <Tooltip
        contentStyle={{
          backgroundColor: "var(--popover)",
          borderColor: "var(--border)",
          color: "var(--popover-foreground)",
        }}
      />
      <Legend />
      {series.map((serie) => (
        <Bar
          key={serie.clave}
          dataKey={serie.clave}
          name={serie.nombre}
          fill={serie.color}
          stackId={apiladas ? "total" : undefined}
        />
      ))}
    </BarChart>
  );
}
```

- [ ] **Step 2: Crear `src/components/reportes/reportes-estadisticos.tsx`**

```tsx
"use client";

import { useState, type ReactNode } from "react";
import useSWR from "swr";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FiltroFecha } from "@/components/comunes/filtro-fecha";
import { FiltroZona } from "@/components/comunes/filtro-zona";
import { TablaDatos, type Columna } from "@/components/comunes/tabla-datos";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { obtenerJson } from "@/lib/cliente-api";
import { formatearFecha, formatearMes, rangoUltimosMeses } from "@/lib/fechas";
import { formatearPorcentaje } from "@/lib/indicadores";
import type {
  AvistamientosMes, OcupacionOperativo, ProcedimientosZona, ReporteEstadistico,
} from "@/services/reportes";
import { COLORES_GRAFICO, GraficoBarras } from "./grafico-barras";

/** Fila de los indicadores de dos categorías (cumplimiento y asistencia). */
interface FilaCategoria {
  categoria: string;
  cantidad: number;
}

/** Columnas de las tablas de dos categorías. */
const columnasCategoria = (titulo: string): Columna<FilaCategoria>[] => [
  { titulo: "Categoría", celda: (fila) => fila.categoria },
  { titulo, className: "text-right", celda: (fila) => fila.cantidad },
];

/** Tarjeta de un indicador: título, fórmula, valor destacado (opcional), gráfico y tabla. */
function TarjetaIndicador({ titulo, descripcion, valor, children }: {
  titulo: string;
  descripcion: string;
  valor?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{titulo}</CardTitle>
        <CardDescription>{descripcion}</CardDescription>
        {valor && <p className="text-2xl font-semibold tracking-tight">{valor}</p>}
      </CardHeader>
      <CardContent className="grid gap-4">{children}</CardContent>
    </Card>
  );
}

/** Castraciones y chipeos por zona. */
function IndicadorProcedimientos({ filas }: { filas: ProcedimientosZona[] }) {
  const castraciones = filas.reduce((total, fila) => total + fila.castraciones, 0);
  const chipeos = filas.reduce((total, fila) => total + fila.chipeos, 0);
  const columnas: Columna<ProcedimientosZona>[] = [
    { titulo: "Zona", celda: (fila) => fila.zona },
    { titulo: "Castraciones", className: "text-right", celda: (fila) => fila.castraciones },
    { titulo: "Chipeos", className: "text-right", celda: (fila) => fila.chipeos },
  ];
  return (
    <TarjetaIndicador
      titulo="Castraciones y chipeos por zona"
      descripcion="Procedimientos registrados en el período, según la zona del operativo. «Castración y chipeo» suma a ambos."
      valor={`${castraciones} castraciones · ${chipeos} chipeos`}
    >
      <GraficoBarras
        datos={filas}
        claveX="zona"
        series={[
          { clave: "castraciones", nombre: "Castraciones", color: COLORES_GRAFICO.azul },
          { clave: "chipeos", nombre: "Chipeos", color: COLORES_GRAFICO.verde },
        ]}
      />
      <TablaDatos columnas={columnas} filas={filas} claveFila={(fila) => fila.zona_id} mensajeVacio="Sin procedimientos en el período" />
    </TarjetaIndicador>
  );
}

/** Cumplimiento de operativos. */
function IndicadorCumplimiento({ cumplimiento }: { cumplimiento: ReporteEstadistico["cumplimiento"] }) {
  const filas: FilaCategoria[] = [
    { categoria: "Realizados", cantidad: cumplimiento.realizados },
    { categoria: "Cancelados", cantidad: cumplimiento.cancelados },
  ];
  return (
    <TarjetaIndicador
      titulo="Cumplimiento de operativos"
      descripcion={
        "Realizados / (realizados + cancelados), sobre los operativos con fecha ya pasada. " +
        `Sin cerrar (programados o en curso con fecha pasada, no entran en el cálculo): ${cumplimiento.sin_cerrar}.`
      }
      valor={formatearPorcentaje(cumplimiento.porcentaje)}
    >
      <GraficoBarras
        datos={filas}
        claveX="categoria"
        series={[{ clave: "cantidad", nombre: "Operativos", color: COLORES_GRAFICO.azul }]}
      />
      <TablaDatos columnas={columnasCategoria("Operativos")} filas={filas} claveFila={(fila) => fila.categoria} />
    </TarjetaIndicador>
  );
}

/** Ocupación de cupo por operativo. */
function IndicadorOcupacion({ ocupacion }: { ocupacion: ReporteEstadistico["ocupacion"] }) {
  // Etiqueta corta del eje: DD/MM del operativo.
  const datos = ocupacion.operativos.map((operativo) => ({ ...operativo, dia: formatearFecha(operativo.fecha).slice(0, 5) }));
  const columnas: Columna<OcupacionOperativo>[] = [
    { titulo: "Fecha", celda: (o) => formatearFecha(o.fecha) },
    { titulo: "Lugar", celda: (o) => o.lugar },
    { titulo: "Zona", celda: (o) => o.zona },
    { titulo: "Asignados / cupo", className: "text-right", celda: (o) => `${o.asignados} / ${o.cupo_maximo}` },
    { titulo: "Ocupación", className: "text-right", celda: (o) => formatearPorcentaje(o.porcentaje) },
  ];
  return (
    <TarjetaIndicador
      titulo="Ocupación de cupo por operativo"
      descripcion="Turnos asignados (no cancelados) / cupo máximo, en los operativos no cancelados del período. El valor destacado es la ocupación total."
      valor={formatearPorcentaje(ocupacion.porcentaje)}
    >
      <GraficoBarras
        datos={datos}
        claveX="dia"
        porcentaje
        series={[{ clave: "porcentaje", nombre: "Ocupación (%)", color: COLORES_GRAFICO.azul }]}
      />
      <TablaDatos
        columnas={columnas}
        filas={ocupacion.operativos}
        claveFila={(o) => o.id}
        mensajeVacio="Sin operativos en el período"
      />
    </TarjetaIndicador>
  );
}

/** Asistencia a los turnos. */
function IndicadorAsistencia({ asistencia }: { asistencia: ReporteEstadistico["asistencia"] }) {
  const filas: FilaCategoria[] = [
    { categoria: "Asistieron (completados)", cantidad: asistencia.completados },
    { categoria: "No se presentaron", cantidad: asistencia.ausentes },
  ];
  return (
    <TarjetaIndicador
      titulo="Asistencia a los turnos"
      descripcion="Completados / (completados + cancelados con motivo «No se presentó»)."
      valor={formatearPorcentaje(asistencia.porcentaje)}
    >
      <GraficoBarras
        datos={filas}
        claveX="categoria"
        series={[{ clave: "cantidad", nombre: "Turnos", color: COLORES_GRAFICO.verde }]}
      />
      <TablaDatos columnas={columnasCategoria("Turnos")} filas={filas} claveFila={(fila) => fila.categoria} />
    </TarjetaIndicador>
  );
}

/** Evolución mensual de avistamientos y tiempo promedio de atención. */
function IndicadorAvistamientos({ avistamientos }: { avistamientos: ReporteEstadistico["avistamientos"] }) {
  const datos = avistamientos.meses.map((mes) => ({ ...mes, etiqueta: formatearMes(mes.mes) }));
  const promedio = avistamientos.promedio_dias;
  const columnas: Columna<AvistamientosMes>[] = [
    { titulo: "Mes", celda: (m) => formatearMes(m.mes) },
    { titulo: "Pendientes", className: "text-right", celda: (m) => m.pendientes },
    { titulo: "Atendidos", className: "text-right", celda: (m) => m.atendidos },
    {
      titulo: "Días promedio de atención",
      className: "text-right",
      celda: (m) => (m.promedio_dias === null ? "—" : m.promedio_dias.toLocaleString("es-AR")),
    },
  ];
  return (
    <TarjetaIndicador
      titulo="Avistamientos por mes"
      descripcion="Reportes del período según su estado actual. Tiempo de atención: días entre el aviso y la atención."
      valor={promedio === null ? "Sin reportes atendidos" : `${promedio.toLocaleString("es-AR")} días promedio de atención`}
    >
      <GraficoBarras
        datos={datos}
        claveX="etiqueta"
        apiladas
        series={[
          { clave: "pendientes", nombre: "Pendientes", color: COLORES_GRAFICO.ambar },
          { clave: "atendidos", nombre: "Atendidos", color: COLORES_GRAFICO.verde },
        ]}
      />
      <TablaDatos columnas={columnas} filas={avistamientos.meses} claveFila={(m) => m.mes} />
    </TarjetaIndicador>
  );
}

/**
 * Pantalla de F13: filtros de zona y período (por defecto, los últimos 12 meses) y un
 * gráfico más una tabla por cada indicador. Todo se calcula en el servidor.
 */
export function ReportesEstadisticos() {
  const [filtros, setFiltros] = useState(() => ({ zona_id: "", ...rangoUltimosMeses(12) }));
  const rangoValido = filtros.desde !== "" && filtros.hasta !== "" && filtros.desde <= filtros.hasta;

  const parametros = new URLSearchParams({ desde: filtros.desde, hasta: filtros.hasta });
  if (filtros.zona_id) parametros.set("zona_id", filtros.zona_id);
  // Con un rango inválido no se consulta (la API respondería 400).
  const { data, isLoading } = useSWR<ReporteEstadistico>(
    rangoValido ? `/api/reportes?${parametros}` : null,
    obtenerJson,
    { keepPreviousData: true },
  );

  const cambiar = (clave: keyof typeof filtros) => (valor: string) =>
    setFiltros((anteriores) => ({ ...anteriores, [clave]: valor }));

  return (
    <>
      <EncabezadoPagina
        titulo="Reportes estadísticos"
        descripcion="Indicadores del programa por zona y período. Cada indicador se muestra en un gráfico y en una tabla."
      />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <FiltroZona valor={filtros.zona_id} onCambiar={cambiar("zona_id")} />
        <FiltroFecha etiqueta="Desde" valor={filtros.desde} onCambiar={cambiar("desde")} />
        <FiltroFecha etiqueta="Hasta" valor={filtros.hasta} onCambiar={cambiar("hasta")} />
        {!rangoValido && (
          <p role="alert" className="text-sm text-destructive">Elija un rango válido: «desde» no puede ser posterior a «hasta».</p>
        )}
      </div>
      {!data ? (
        <p className="text-sm text-muted-foreground">{isLoading ? "Calculando indicadores…" : "Sin datos para mostrar"}</p>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <IndicadorProcedimientos filas={data.procedimientos} />
          <IndicadorCumplimiento cumplimiento={data.cumplimiento} />
          <IndicadorOcupacion ocupacion={data.ocupacion} />
          <IndicadorAsistencia asistencia={data.asistencia} />
          <IndicadorAvistamientos avistamientos={data.avistamientos} />
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 3: Crear `src/app/(panel)/reportes/page.tsx`**

```tsx
import { ReportesEstadisticos } from "@/components/reportes/reportes-estadisticos";
import { exigirPermisoPagina } from "@/lib/sesion";

/** F13 — Reportes estadísticos (administrador y operador). */
export default async function PaginaReportes() {
  await exigirPermisoPagina("reportes:ver");
  return <ReportesEstadisticos />;
}
```

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit` → sin errores. Si `recharts` reporta un error de tipos en `grafico-barras.tsx`, registrarlo en desviaciones con el mensaje exacto antes de cambiar nada.

---

### Task 10: Dashboard

**Files:**
- Create: `src/components/dashboard/panel-dashboard.tsx`
- Modify (reemplazar completo): `src/app/(panel)/dashboard/page.tsx`

- [ ] **Step 1: Crear `src/components/dashboard/panel-dashboard.tsx`** (componente de servidor: sin `"use client"`)

```tsx
import Link from "next/link";
import type { ReactNode } from "react";
import { BadgeTurno } from "@/components/comunes/badges-dominio";
import { TablaDatos, type Columna } from "@/components/comunes/tabla-datos";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatearCantidad } from "@/lib/cantidades";
import { ETIQUETAS_TIPO_PROCEDIMIENTO } from "@/lib/etiquetas";
import { formatearFecha, formatearFechaHora } from "@/lib/fechas";
import type { AvistamientoDto } from "@/services/avistamientos";
import type { ResumenDashboard } from "@/services/dashboard";
import type { InsumoDto } from "@/services/insumos";
import type { OperativoDto } from "@/services/operativos";
import type { TurnoDto } from "@/services/turnos";

/**
 * Inicio del panel (componente de servidor: recibe los datos ya calculados por
 * `resumenDashboard`, sin consultas desde el navegador).
 */

/** Tarjeta de una sección del inicio, con enlace opcional al módulo completo. */
function Seccion({ titulo, descripcion, href, children }: {
  titulo: string;
  descripcion?: string;
  href?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{titulo}</CardTitle>
        {descripcion && <CardDescription>{descripcion}</CardDescription>}
        {href && (
          <CardAction>
            <Link href={href} className={buttonVariants({ variant: "outline", size: "sm" })}>Ver todos</Link>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** Tarjeta con un total destacado. */
function Total({ titulo, valor }: { titulo: string; valor: number }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{titulo}</CardDescription>
        <CardTitle className="text-3xl tabular-nums">{valor}</CardTitle>
      </CardHeader>
    </Card>
  );
}

const COLUMNAS_TURNOS: Columna<TurnoDto>[] = [
  { titulo: "Horario", celda: (t) => t.horario },
  { titulo: "Animal", celda: (t) => t.animal },
  { titulo: "Tutor", celda: (t) => t.tutor ?? "Sin tutor" },
  { titulo: "Procedimiento", celda: (t) => ETIQUETAS_TIPO_PROCEDIMIENTO[t.tipo_solicitado] },
  { titulo: "Lugar", celda: (t) => `${t.lugar} (${t.zona})` },
  { titulo: "Estado", celda: (t) => <BadgeTurno estado={t.estado} /> },
];

const COLUMNAS_OPERATIVOS: Columna<OperativoDto>[] = [
  {
    titulo: "Fecha",
    celda: (o) => (
      <Link href={`/operativos/${o.id}`} className="font-medium underline-offset-4 hover:underline">
        {formatearFecha(o.fecha)} {o.hora_inicio}–{o.hora_fin}
      </Link>
    ),
  },
  { titulo: "Zona", celda: (o) => o.zona },
  { titulo: "Lugar", celda: (o) => o.lugar },
  { titulo: "Disponibles", className: "text-right", celda: (o) => `${o.disponibles} de ${o.cupo_maximo}` },
];

const COLUMNAS_INSUMOS: Columna<InsumoDto>[] = [
  {
    titulo: "Insumo",
    celda: (i) => (
      <Link href={`/insumos/${i.id}`} className="font-medium underline-offset-4 hover:underline">{i.nombre}</Link>
    ),
  },
  { titulo: "Stock", className: "text-right text-destructive", celda: (i) => formatearCantidad(i.stock_actual, i.unidad) },
  { titulo: "Mínimo", className: "text-right", celda: (i) => formatearCantidad(i.stock_minimo, i.unidad) },
];

const COLUMNAS_AVISTAMIENTOS: Columna<AvistamientoDto>[] = [
  { titulo: "Fecha", celda: (r) => formatearFechaHora(r.fecha) },
  { titulo: "Zona", celda: (r) => r.zona },
  { titulo: "Animales", className: "text-right", celda: (r) => r.cantidad_animales },
];

/** Turnos de hoy (común a todos los roles). */
function TurnosHoy({ turnos, descripcion }: { turnos: TurnoDto[]; descripcion: string }) {
  return (
    <Seccion titulo="Turnos de hoy" descripcion={descripcion}>
      <TablaDatos columnas={COLUMNAS_TURNOS} filas={turnos} claveFila={(t) => t.id} mensajeVacio="No hay turnos para hoy" />
    </Seccion>
  );
}

/** Contenido del inicio según el rol del usuario en sesión. */
export function PanelDashboard({ resumen }: { resumen: ResumenDashboard }) {
  if (resumen.tipo === "veterinario") {
    return resumen.motivo ? (
      <p role="alert" className="rounded-lg border p-4 text-sm text-muted-foreground">{resumen.motivo}</p>
    ) : (
      <TurnosHoy turnos={resumen.turnos_hoy} descripcion="Turnos de los operativos de hoy a los que está asignado/a." />
    );
  }

  const { totales } = resumen;
  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Total titulo="Vecinos activos" valor={totales.vecinos_activos} />
        <Total titulo="Animales registrados" valor={totales.animales} />
        <Total titulo="Animales castrados" valor={totales.castrados} />
        <Total titulo="Animales chipeados" valor={totales.chipeados} />
      </div>
      <TurnosHoy turnos={resumen.turnos_hoy} descripcion="Turnos no cancelados de los operativos de hoy." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Seccion titulo="Próximos operativos con cupo" href="/operativos">
          <TablaDatos
            columnas={COLUMNAS_OPERATIVOS}
            filas={resumen.proximos_operativos}
            claveFila={(o) => o.id}
            mensajeVacio="No hay operativos programados con cupo disponible"
          />
        </Seccion>
        <Seccion
          titulo="Insumos bajo el mínimo"
          descripcion={`${resumen.insumos_bajo_minimo.total} insumo(s) con stock en o por debajo del mínimo.`}
          href="/insumos"
        >
          <TablaDatos
            columnas={COLUMNAS_INSUMOS}
            filas={resumen.insumos_bajo_minimo.filas}
            claveFila={(i) => i.id}
            mensajeVacio="Todos los insumos están sobre el mínimo"
          />
        </Seccion>
        <Seccion
          titulo="Avistamientos pendientes"
          descripcion={`${resumen.avistamientos_pendientes.total} reporte(s) sin atender.`}
          href="/avistamientos"
        >
          <TablaDatos
            columnas={COLUMNAS_AVISTAMIENTOS}
            filas={resumen.avistamientos_pendientes.filas}
            claveFila={(r) => r.id}
            mensajeVacio="No hay avistamientos pendientes"
          />
        </Seccion>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Reemplazar completo `src/app/(panel)/dashboard/page.tsx`**

```tsx
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { PanelDashboard } from "@/components/dashboard/panel-dashboard";
import { ETIQUETAS_ROL } from "@/lib/etiquetas";
import { exigirPermisoPagina } from "@/lib/sesion";
import { resumenDashboard } from "@/services/dashboard";

/** Inicio del panel: panorama del programa (administrador y operador) o turnos del día (veterinario). */
export default async function PaginaDashboard() {
  const sesion = await exigirPermisoPagina("dashboard:ver");
  const resumen = await resumenDashboard(sesion);
  return (
    <>
      <EncabezadoPagina titulo={`Bienvenido/a, ${sesion.nombre}`} descripcion={`Ingresó como ${ETIQUETAS_ROL[sesion.rol]}.`} />
      <PanelDashboard resumen={resumen} />
    </>
  );
}
```

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit` → sin errores.

---

### Task 11: Refactorización, verificación completa y punto de control

**Files:**
- Create: `tests/humo/fase5.mjs`
- Modify: `docs/superpowers/desviaciones/fase5.md`

- [ ] **Step 1: Revisión de duplicación**

Buscar y corregir si aparece (registrar en desviaciones cualquier cambio fuera del plan):
- Cálculos de rango de días locales que no usen `condicionDiasLocales()` o `limitesDelRango()` (en `src/services/`).
- Divisiones para porcentajes fuera de `porcentaje()` (en `src/services/` y `src/components/`).
- Filtros de zona o de fecha escritos a mano en componentes nuevos (deben usar `FiltroZona` y `FiltroFecha`).
- Indexaciones de `ETIQUETAS_*` con columnas `CreationOptional` sin función tipada o cast (L1).

- [ ] **Step 2: Verificación estática y tests (con Docker levantado, L5)**

Run: `docker ps --format "{{.Names}} {{.Status}}"` → `sigcan-db … (healthy)`.
Run: `npx tsc --noEmit` → sin errores.
Run: `npm run lint` → 0 errores (1 advertencia previa aceptada en `src/lib/cliente-api.ts`).
Run: `npm test` → PASS, **152 tests**.

- [ ] **Step 3: Crear la prueba de humo `tests/humo/fase5.mjs`**

```js
/**
 * Prueba de humo de la Fase 5 contra el servidor de producción (`next start`).
 * Verifica F9 (alta, validaciones, filtros y atención de avistamientos), F13 (indicadores,
 * filtro de zona y validación del rango), el dashboard por rol y los permisos (401/403).
 * Uso (desde la raíz del proyecto): node tests/humo/fase5.mjs [url-base]
 * Resultado esperado: "Prueba de humo de la Fase 5: OK (28 verificaciones)".
 */
try {
  process.loadEnvFile(".env");
} catch {
  // Sin .env se usan los valores por defecto de .env.example.
}

const BASE = process.argv[2] ?? "http://localhost:3107";
/** Cookie de sesión por usuario: se prueban dos roles a la vez. */
const cookies = { admin: "", vet: "" };
/** Cantidad de verificaciones superadas (lección L6: se reporta el número exacto). */
let verificaciones = 0;

/** Llama a la API con la sesión indicada (o sin sesión) y guarda la cookie que devuelva el login. */
async function llamar(sesion, metodo, ruta, cuerpo) {
  const respuesta = await fetch(BASE + ruta, {
    method: metodo,
    redirect: "manual",
    headers: {
      ...(cuerpo !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(sesion && cookies[sesion] ? { Cookie: cookies[sesion] } : {}),
    },
    body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
  });
  const nuevaCookie = respuesta.headers.get("set-cookie");
  if (nuevaCookie && sesion) cookies[sesion] = nuevaCookie.split(";")[0];
  const texto = await respuesta.text();
  let datos = null;
  try {
    datos = texto ? JSON.parse(texto) : null;
  } catch {
    datos = texto.slice(0, 200);
  }
  return { estado: respuesta.status, datos };
}

/** Corta la prueba con el detalle si una verificación falla; si pasa, la cuenta. */
function verificar(paso, condicion, detalle) {
  if (!condicion) {
    console.error(`✗ ${paso}`, detalle === undefined ? "" : JSON.stringify(detalle));
    process.exit(1);
  }
  verificaciones += 1;
  console.log(`✓ ${paso}`);
}

/** Fecha local de Río Grande (UTC−3) desplazada `dias` días, en formato YYYY-MM-DD. */
const fechaLocal = (dias = 0) => new Date(Date.now() - 3 * 3_600_000 + dias * 86_400_000).toISOString().slice(0, 10);
const hoy = fechaLocal();
const mesActual = hoy.slice(0, 7);
const sufijo = String(Date.now()).slice(-7);
const passwordVet = "Clave1234";

// 1) Administrador y zonas
let r = await llamar("admin", "POST", "/api/auth/login", {
  email: process.env.SEED_ADMIN_EMAIL ?? "admin@sigcan.local",
  password: process.env.SEED_ADMIN_PASSWORD ?? "Admin1234",
});
verificar("login del administrador", r.estado === 200, r);
r = await llamar("admin", "GET", "/api/zonas/opciones");
const [zonaA, zonaB] = r.datos;

// 2) Avistamientos: alta, validaciones y listado
const reporte = {
  fecha: hoy, hora: "00:00", descripcion: `Humo 5 ${sufijo}: perros sueltos`, cantidad_animales: 4,
  direccion_referencia: "", zona_id: zonaA.id, vecino_id: null,
};
r = await llamar("admin", "POST", "/api/avistamientos", reporte);
verificar("alta de avistamiento pendiente (201)", r.estado === 201 && r.datos.estado === "pendiente", r);
const reporteId = r.datos.id;
r = await llamar("admin", "POST", "/api/avistamientos", { ...reporte, fecha: fechaLocal(1) });
verificar("fecha futura → 400 en el campo", r.estado === 400 && r.datos.error.campos?.fecha, r);
r = await llamar("admin", "POST", "/api/avistamientos", { ...reporte, cantidad_animales: 0 });
verificar("cantidad 0 → 400 en el campo", r.estado === 400 && r.datos.error.campos?.cantidad_animales, r);
r = await llamar("admin", "GET", `/api/avistamientos?estado=pendiente&busqueda=${encodeURIComponent(`Humo 5 ${sufijo}`)}`);
verificar("el reporte figura entre los pendientes", r.datos.filas.some((f) => f.id === reporteId), r);

// 3) Atención con operativo de la misma zona
const operativo = { fecha: fechaLocal(7), hora_inicio: "09:00", hora_fin: "13:00", lugar: "SUM humo 5", cupo_maximo: 10 };
r = await llamar("admin", "POST", "/api/operativos", { ...operativo, zona_id: zonaA.id });
verificar("alta de operativo en la zona del reporte", r.estado === 201, r);
const operativoA = r.datos.id;
r = await llamar("admin", "POST", "/api/operativos", { ...operativo, zona_id: zonaB.id });
verificar("alta de operativo en otra zona", r.estado === 201, r);
const operativoB = r.datos.id;
r = await llamar("admin", "GET", `/api/avistamientos/operativos?zona_id=${zonaA.id}`);
verificar(
  "opciones de atención: solo operativos de la zona",
  r.datos.some((o) => o.id === operativoA) && !r.datos.some((o) => o.id === operativoB),
  r,
);
r = await llamar("admin", "POST", `/api/avistamientos/${reporteId}/atender`, { operativo_id: operativoB });
verificar("operativo de otra zona → 400", r.estado === 400 && r.datos.error.campos?.operativo_id, r);
r = await llamar("admin", "POST", `/api/avistamientos/${reporteId}/atender`, { operativo_id: operativoA });
verificar("atención del reporte (200)", r.estado === 200 && r.datos.estado === "atendido" && r.datos.operativo_id === operativoA, r);
r = await llamar("admin", "PUT", `/api/avistamientos/${reporteId}`, reporte);
verificar("un reporte atendido no se edita → 409", r.estado === 409, r);
r = await llamar("admin", "DELETE", `/api/avistamientos/${reporteId}`);
verificar("un reporte atendido no se elimina → 409", r.estado === 409, r);

// 4) Reportes estadísticos
const periodo = `desde=${mesActual}-01&hasta=${fechaLocal(30)}`;
r = await llamar("admin", "GET", `/api/reportes?${periodo}`);
verificar(
  "reportes: el mes actual cuenta el avistamiento atendido",
  r.estado === 200 && r.datos.avistamientos.meses.find((m) => m.mes === mesActual)?.atendidos >= 1,
  r.estado,
);
verificar(
  "reportes: ocupación del operativo nuevo en 0 %",
  r.datos.ocupacion.operativos.some((o) => o.id === operativoA && o.asignados === 0 && o.porcentaje === 0),
  r.datos.ocupacion,
);
r = await llamar("admin", "GET", `/api/reportes?${periodo}&zona_id=${zonaB.id}`);
verificar(
  "reportes: el filtro de zona deja solo esa zona",
  r.estado === 200 && r.datos.ocupacion.operativos.every((o) => o.zona === zonaB.etiqueta),
  r.datos?.ocupacion,
);
r = await llamar("admin", "GET", `/api/reportes?desde=${hoy}&hasta=${fechaLocal(-1)}`);
verificar("rango invertido → 400", r.estado === 400, r);

// 5) Dashboard del administrador
r = await llamar("admin", "GET", "/api/dashboard");
verificar(
  "dashboard general con totales",
  r.estado === 200 && r.datos.tipo === "general" && Number.isInteger(r.datos.totales.animales),
  r,
);

// 6) Veterinario sin vínculo con el personal: permisos y dashboard propio
const emailVet = `humo5.vet.${sufijo}@prueba.local`;
r = await llamar("admin", "POST", "/api/usuarios", {
  nombre: "Vito", apellido: "Humo", email: emailVet, rol: "veterinario", activo: true, password: passwordVet,
});
verificar("alta de usuario veterinario", r.estado === 201, r);
r = await llamar("vet", "POST", "/api/auth/login", { email: emailVet, password: passwordVet });
verificar("login del veterinario", r.estado === 200, r);
r = await llamar("vet", "GET", "/api/dashboard");
verificar(
  "dashboard del veterinario con aviso de vínculo",
  r.datos.tipo === "veterinario" && r.datos.motivo?.includes("no está vinculado"),
  r,
);
r = await llamar("vet", "GET", "/api/avistamientos");
verificar("el veterinario consulta avistamientos (200)", r.estado === 200, r.estado);
r = await llamar("vet", "POST", "/api/avistamientos", reporte);
verificar("el veterinario no carga avistamientos → 403", r.estado === 403, r);
r = await llamar("vet", "GET", `/api/reportes?${periodo}`);
verificar("el veterinario no ve reportes → 403", r.estado === 403, r);
r = await llamar(null, "GET", `/api/reportes?${periodo}`);
verificar("reportes sin sesión → 401", r.estado === 401, r);

// 7) Páginas
for (const pagina of ["/dashboard", "/avistamientos", "/reportes"]) {
  r = await llamar("admin", "GET", pagina);
  verificar(`GET ${pagina} (administrador) → 200`, r.estado === 200, r.estado);
}
r = await llamar("vet", "GET", "/dashboard");
verificar("GET /dashboard (veterinario) → 200", r.estado === 200, r.estado);

console.log(`\nPrueba de humo de la Fase 5: OK (${verificaciones} verificaciones)`);
```

- [ ] **Step 4: Build y pruebas de humo contra la base de test**

Run: `npm run db:reset:test`
Run: `npm run build`
Expected: build exitoso.

Levantar el servidor apuntando a la base de test y con SMTP desactivado (en otra terminal; PowerShell):

```powershell
$env:DATABASE_URL = "postgres://sigcan:sigcan@localhost:5433/sigcan_test"; $env:SMTP_HOST = ""; npx next start -p 3107
```

(En bash: `DATABASE_URL=postgres://sigcan:sigcan@localhost:5433/sigcan_test SMTP_HOST= npx next start -p 3107`.)

Run: `node tests/humo/fase5.mjs http://localhost:3107`
Expected: 28 líneas con `✓` y al final `Prueba de humo de la Fase 5: OK (28 verificaciones)`.

Regresión (antes de las 22:55 hora de Río Grande, por la Fase 4):
Run: `node tests/humo/fase4.mjs http://localhost:3107` → `Prueba de humo de la Fase 4: OK` (27 verificaciones `✓`).
Run: `node tests/humo/fase3.mjs http://localhost:3107` → `Prueba de humo de la Fase 3: OK` (25 verificaciones `✓`).

Detener el servidor (Ctrl+C) y verificar que no quede ningún proceso escuchando en el puerto 3107.

- [ ] **Step 5: Recorrido manual por rol (navegador)**

- **Administrador / operador:** el inicio muestra los 4 totales, turnos de hoy, próximos operativos con cupo, insumos bajo mínimo y avistamientos pendientes (con "Ver todos"). En "Avistamientos": alta (fecha y hora actuales por defecto, vecino opcional), edición, atención con operativo de la zona y eliminación de un pendiente; un atendido no muestra acciones. En "Reportes": cambiar zona y fechas actualiza los cinco indicadores (gráfico + tabla); con "desde" posterior a "hasta" aparece el aviso y no se consulta.
- **Veterinario vinculado y asignado a un operativo de hoy:** el inicio muestra solo sus turnos del día. Ve "Avistamientos" sin botones de alta ni acciones; no ve "Reportes" y `/reportes` lo redirige al inicio.
- **Veterinario sin vínculo:** el inicio muestra el aviso "Su usuario no está vinculado…".
- Probar el tema oscuro en "Reportes": ejes, leyenda y tooltip legibles.

- [ ] **Step 6: Autocomparación final (L3 y L7)**

Comparar cada archivo "Create" de las Tasks 1–11 con su bloque del plan y revisar que cada bloque "Modify" quedó aplicado. Anotar cuántos archivos se compararon.

- [ ] **Step 7: Desviaciones y punto de control**

Completar `docs/superpowers/desviaciones/fase5.md` con: cambios respecto del plan (o "Sin desviaciones."), la línea `Autocomparación: N archivos creados y M modificados revisados contra el plan`, el resultado de `npm test` en número (`152 passed`) y el de cada humo en número (`Fase 5: 28/28`, `Fase 4: 27/27`, `Fase 3: 25/25`).

**Punto de control:** detenerse y avisar al usuario que la Fase 5 está lista para commitear (no ejecutar git).
