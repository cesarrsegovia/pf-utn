# SIGCAN Fase 3 (Operativos, turnos y notificaciones) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** F4 Operativos (alta, edición, personal asignado, cancelación con regla de 48 h/fuerza mayor, cambios de estado), F3 Turnos (solicitar, confirmar, reprogramar, cancelar, con cupo bajo bloqueo de fila) y F12 Notificaciones (generación dentro de las transacciones, recordatorio 24 h antes, procesador SMTP periódico y a demanda, reintentos).

**Architecture:** Igual que las Fases 1 y 2: Route Handler → `requerirSesion(accion)` → Zod → servicio con transacción. Las notificaciones se **registran** en la tabla `notificacion` dentro de la misma transacción que cambia el turno u operativo (servicio `notificaciones.ts`), y un **procesador** independiente las envía por SMTP (Nodemailer) cada minuto desde `src/instrumentation.ts`, a demanda (botón) o desde fuera con `CRON_SECRET`. El envío nunca forma parte de la transacción de negocio: si el SMTP falla, el turno igual queda registrado y la notificación pasa a `fallido`, reintentable.

**Tech Stack:** Next.js 16.4.3 (App Router), Sequelize 6, Zod 4, react-hook-form, SWR, shadcn/ui (Base UI), Vitest 3. **Dependencia nueva única: `nodemailer@10.2.1`** (trae sus propios tipos; no instalar `@types/nodemailer`).

**Spec:** `docs/superpowers/specs/2026-10-28-sigcan-design.md` — §4 (permisos), §5 F3, F4, F12 y "Estados", §6 (errores y UX), §7 (pruebas F3, F4, F12).

---

## 0. Reglas para quien implemente (leer antes de empezar)

1. **Git:** no ejecutar ningún comando de git (ni siquiera `git status`). Los "Puntos de control" son avisos al usuario (ver `CLAUDE.md`).
2. **Desviaciones:** crear `docs/superpowers/desviaciones/fase3.md` al empezar (Task 1, Step 1). Copiar el código tal como está; si algo no compila o no funciona con la versión instalada, hacer el cambio mínimo, **registrarlo** (archivo, qué decía el plan, qué se cambió y por qué) y dejar un comentario en el código. No hay desviaciones "silenciosas".
3. **Tests:** prohibido modificar un test del plan para que pase. Si un test parece incorrecto, detenerse y registrarlo como desviación. Tampoco se modifican los tests de las Fases 0, 1 y 2 (solo se **agregan** funciones a `tests/helpers/fabricas.ts`).
4. **Dependencias:** instalar únicamente `nodemailer@10.2.1` (Task 1). No ejecutar `npx shadcn add`: todos los componentes de UI necesarios ya existen.
5. **Modelos y migraciones:** no se crean ni modifican modelos ni migraciones. Las 16 tablas ya existen con sus restricciones (incluido el índice único `ux_turno_activo_por_animal`).
6. **shadcn/ui con Base UI:** usar la prop `render` (nunca `asChild`). `NativeSelect` en formularios lleva `className="w-full"`. Para un enlace con estilo de botón usar `buttonVariants` sobre `<Link>`.
7. **Comentarios:** todo archivo nuevo lleva comentarios profesionales, claros y concisos en español (ya incluidos en el código del plan; mantenerlos).
8. **Alcance:** no implementar nada de fases posteriores (registro de procedimientos F7, historial F8, avistamientos F9, reportes F13, dashboard). No crear un endpoint para eliminar operativos: el spec solo prevé cancelarlos.
9. **Archivos que no se tocan:** `CLAUDE.md`, `AGENTS.md`, `docs/` (salvo el archivo de desviaciones), `src/models/*`, `db/*`.
10. **Bloqueos de fila:** nunca combinar `lock` con `include` en la misma consulta (PostgreSQL rechaza `FOR UPDATE` sobre el lado opcional de un `LEFT JOIN`). El plan siempre bloquea la fila sola y después recarga con sus asociaciones.
11. **Verificación en producción obligatoria (Task 13):** además de `npm test`, se levanta `npm run build` + `next start` **contra la base de test** y se ejecuta la prueba de humo `tests/humo/fase3.mjs`.

## 1. Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `package.json` (modificar con npm) | Dependencia `nodemailer@10.2.1` |
| `next.config.ts` (modificar) | `nodemailer` en `serverExternalPackages` |
| `src/lib/constantes.ts` (modificar) | Estados de turno que ocupan cupo / activos, horas de anticipación, motivo "Cancelación del operativo", `incluyeCastracion()`, `incluyeChipeo()`, `esTurnoActivo()` |
| `src/lib/fechas.ts` (modificar) | `horaCorta()`, `instanteLocal()`, `MS_POR_HORA` |
| `src/lib/etiquetas.ts` (modificar) | Etiquetas de estados de operativo/turno, tipos de procedimiento y notificación, estados de envío; `nombreAnimal()` |
| `src/schemas/comun.ts` (modificar) | `fechaValida`, `horaValida`, `idSeleccionado()` |
| `src/schemas/{operativos,turnos,notificaciones}.ts` | Validación compartida cliente/servidor |
| `src/lib/mailer.ts` | Transporte Nodemailer, `enviarCorreo()`, `smtpConfigurado()`, asuntos por tipo |
| `src/services/notificaciones.ts` | Generación (aviso inmediato, recordatorio, anulación), procesador de envío, listado y reintento (F12) |
| `src/services/turnos.ts` | F3: solicitar, confirmar, reprogramar, cancelar, listar |
| `src/services/operativos.ts` | F4: alta, edición con avisos, personal, cancelación en cascada, cambios de estado, opciones |
| `src/services/animales.ts` (modificar) | `opcionesAnimales()` (animales que pueden pedir turno) |
| `src/services/personal.ts` (modificar) | `opcionesPersonal()` (personal activo para asignar) |
| `src/lib/procesador-notificaciones.ts` | Temporizador de 1 minuto que llama al procesador |
| `src/instrumentation.ts` | Arranca el procesador al iniciar el servidor (solo runtime Node.js) |
| `src/app/api/operativos/**`, `src/app/api/turnos/**`, `src/app/api/notificaciones/**`, `src/app/api/animales/opciones`, `src/app/api/personal/opciones` | API REST |
| `src/lib/navegacion.ts` (modificar) | Ítems Operativos, Turnos y Notificaciones |
| `src/components/comunes/badges-dominio.tsx` | Badges de estado de operativo, turno y envío |
| `src/components/comunes/formulario-dialogo.tsx` (modificar) | Prop opcional `textoEnviar` (botón principal con otro texto) |
| `src/components/operativos/*` | Listado, formulario, detalle, personal asignado y cancelación |
| `src/components/turnos/*` | Listado reutilizable (página de turnos y detalle de operativo) y formularios |
| `src/components/notificaciones/gestion-notificaciones.tsx` | Listado con filtros, "Procesar pendientes" y reintento |
| `src/app/(panel)/{operativos,turnos,notificaciones}/page.tsx`, `src/app/(panel)/operativos/[id]/page.tsx` | Páginas |
| `tests/helpers/fabricas.ts` (modificar) | `crearPersonalPrueba()`, `crearNotificacionPrueba()` |
| `tests/lib/dominio-fase3.test.ts`, `tests/services/{notificaciones,turnos,operativos}.test.ts` | Tests |
| `tests/humo/fase3.mjs` | Prueba de humo contra `next start` |
| `src/services/vecinos.ts` (modificar en Task 13) | Refactorización: usa `anularRecordatorios()` |

## 2. Decisiones de esta fase (para la defensa)

- **Hora local:** Río Grande está en UTC−3 todo el año (sin horario de verano). `instanteLocal(fecha, hora)` arma el instante con desfase fijo `-03:00`; con él se calculan las 48 h, el recordatorio de 24 h y si un turno ya pasó, independientemente de la zona horaria del servidor.
- **Franja del turno:** el horario debe cumplir `hora_inicio ≤ horario < hora_fin` (un turno a la hora de cierre no tendría tiempo de atención). Además, el instante del turno (fecha del operativo + horario) debe ser futuro.
- **"Fecha futura" al crear o reprogramar un operativo:** se exige que el instante de inicio (fecha + hora de inicio) sea futuro.
- **Cupo:** ocupan cupo los turnos `pendiente`, `confirmado` y `completado`; los cancelados lo liberan. Se calcula siempre en la base (subconsulta), nunca se guarda.
- **Concurrencia:** solicitar y reprogramar bloquean la fila del operativo de destino (`SELECT … FOR UPDATE`) antes de contar el cupo; el orden de bloqueo es siempre operativo → turno (igual que la cancelación de operativos) para evitar interbloqueos. El índice único `ux_turno_activo_por_animal` es el resguardo final de "un turno activo por animal".
- **Notificaciones:** se generan solo si el animal tiene tutor y el tutor tiene email. Confirmación, reprogramación y cancelación quedan programadas "ya" (`fecha_programada = ahora`); el recordatorio, 24 h antes del turno (si ese momento ya pasó, no se programa). Reprogramar o cancelar anula los recordatorios pendientes **o fallidos** del turno (así un reintento nunca recuerda un turno que ya cambió).
- **Turno pendiente reprogramado:** también recibe aviso de reprogramación (el vecino ya pidió el turno); el recordatorio solo existe para turnos confirmados.
- **Edición de operativo con turnos:** si cambian fecha, horario, lugar o zona, cada turno activo recibe aviso de reprogramación y su recordatorio se recalcula. Fecha y horario solo pueden cambiarse mientras el operativo está `programado`. Se rechaza un nuevo horario que deje turnos activos fuera de la franja (hay que reprogramarlos antes).
- **Cancelación de operativo:** los turnos activos pasan a `cancelado` con el motivo fijo "Cancelación del operativo" (el motivo del administrador queda en el operativo y viaja en el correo al vecino).
- **"No se presentó":** al finalizar un operativo los turnos que siguen activos se cancelan con ese motivo **sin** enviar correo (el turno ya pasó; el aviso no tendría utilidad).
- **Iniciar operativo:** solo el día del operativo (spec). Un operativo programado cuyo día pasó sin iniciarse queda así; se resolverá en la Fase 6 si hace falta.
- **Personal:** no se puede asignar a una persona a dos operativos no cancelados del mismo día con franjas superpuestas (`inicio_a < fin_b` y `fin_a > inicio_b`; franjas contiguas, como 09–13 y 13–15, no se superponen). Al cambiar fecha u horario de un operativo se revalida para todo su personal.
- **Procesador de envío:** toma hasta 50 notificaciones `pendiente` con `fecha_programada ≤ ahora`, bloqueándolas con `FOR UPDATE SKIP LOCKED` para que dos ejecuciones simultáneas (temporizador y botón) nunca envíen la misma. Si el SMTP no está configurado, el temporizador no arranca (se avisa en el log) y el procesamiento manual marca las notificaciones como `fallido`.
- **Endpoint externo:** `POST /api/notificaciones/procesar` acepta sesión con permiso `notificaciones:gestionar` **o** el encabezado `Authorization: Bearer <CRON_SECRET>`.

---

### Task 1: Dependencia y configuración

**Files:**
- Create: `docs/superpowers/desviaciones/fase3.md`
- Modify: `package.json` (vía npm), `next.config.ts`

- [ ] **Step 1: Crear el archivo de desviaciones**

Crear `docs/superpowers/desviaciones/fase3.md` con el contenido:

```markdown
# Registro de desviaciones — Fase 3 (Operativos, turnos y notificaciones)

Sin desviaciones.
```

(Reemplazar "Sin desviaciones." por entradas a medida que aparezcan.)

- [ ] **Step 2: Instalar Nodemailer con versión exacta**

Run: `npm install nodemailer@10.2.1 --save-exact`
Expected: `package.json` muestra `"nodemailer": "10.2.1"` en `dependencies`. No instalar `@types/nodemailer` (la versión 10 incluye sus tipos en `dist/cjs/nodemailer.d.ts`).

- [ ] **Step 3: Excluir Nodemailer del bundle del servidor en `next.config.ts`**

Reemplazar la línea de `serverExternalPackages` por:

```ts
  // Sequelize y pg resuelven drivers con require dinámicos que el bundler no puede
  // empaquetar; Nodemailer usa módulos nativos de Node (net, tls). Se excluyen del bundle
  // del servidor y se cargan desde node_modules.
  serverExternalPackages: ["sequelize", "pg", "pg-hstore", "nodemailer"],
```

(Borrar las dos líneas de comentario anteriores que estaban sobre `serverExternalPackages`, para no duplicarlas.)

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit`
Expected: sin errores.

---

### Task 2: Utilidades de dominio (TDD)

**Files:**
- Modify: `src/lib/constantes.ts`, `src/lib/fechas.ts`, `src/lib/etiquetas.ts`, `src/schemas/comun.ts`
- Test: `tests/lib/dominio-fase3.test.ts`

- [ ] **Step 1: Escribir el test que falla `tests/lib/dominio-fase3.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { esTurnoActivo, incluyeCastracion, incluyeChipeo } from "@/lib/constantes";
import { nombreAnimal } from "@/lib/etiquetas";
import { horaCorta, instanteLocal } from "@/lib/fechas";
import { horaValida } from "@/schemas/comun";

describe("fechas y horas locales", () => {
  it("recorta los segundos que devuelve PostgreSQL en las columnas TIME", () => {
    expect(horaCorta("09:30:00")).toBe("09:30");
    expect(horaCorta("09:30")).toBe("09:30");
  });

  it("interpreta fecha y hora en Río Grande (UTC-3) sin depender del servidor", () => {
    expect(instanteLocal("2026-11-05", "09:30:00").toISOString()).toBe("2026-11-05T12:30:00.000Z");
    expect(instanteLocal("2026-12-31", "22:00").toISOString()).toBe("2027-01-01T01:00:00.000Z");
  });

  it("valida horas HH:MM", () => {
    expect(horaValida.safeParse("09:05").success).toBe(true);
    expect(horaValida.safeParse("24:00").success).toBe(false);
    expect(horaValida.safeParse("9:05").success).toBe(false);
  });
});

describe("reglas de dominio", () => {
  it("desglosa el tipo de procedimiento", () => {
    expect([incluyeCastracion("castracion"), incluyeChipeo("castracion")]).toEqual([true, false]);
    expect([incluyeCastracion("chipeo"), incluyeChipeo("chipeo")]).toEqual([false, true]);
    expect([incluyeCastracion("castracion_y_chipeo"), incluyeChipeo("castracion_y_chipeo")]).toEqual([true, true]);
  });

  it("considera activos solo los turnos pendientes o confirmados", () => {
    expect(["pendiente", "confirmado", "completado", "cancelado"].map((e) => esTurnoActivo(e as never))).toEqual([
      true, true, false, false,
    ]);
  });

  it("nombra a los animales sin nombre por su número", () => {
    expect(nombreAnimal({ id: 7, nombre: "Toby" })).toBe("Toby");
    expect(nombreAnimal({ id: 7, nombre: null })).toBe("Animal #7");
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run tests/lib/dominio-fase3.test.ts`
Expected: FAIL (`esTurnoActivo`, `horaCorta`, `nombreAnimal`… no existen).

- [ ] **Step 3: `src/lib/constantes.ts`**

3a. Reemplazar el bloque `MOTIVOS_CANCELACION` completo por:

```ts
/** Motivos de cancelación de turnos generados automáticamente por el sistema. */
export const MOTIVOS_CANCELACION = {
  /** F1: el vecino fue dado de baja (cascada sobre sus turnos activos). */
  bajaVecino: "Baja del vecino",
  /** F4: el operativo finalizó y el turno seguía pendiente o confirmado. */
  noSePresento: "No se presentó",
  /** F4: el administrador canceló el operativo (su motivo queda en el operativo). */
  operativoCancelado: "Cancelación del operativo",
} as const;
```

3b. Agregar al final del archivo:

```ts

/** Estados de turno que ocupan un lugar del cupo del operativo (los cancelados lo liberan). */
export const ESTADOS_TURNO_CON_CUPO = ["pendiente", "confirmado", "completado"] as const;

/** Estados de turno activos: se pueden confirmar, reprogramar o cancelar. */
export const ESTADOS_TURNO_ACTIVOS = ["pendiente", "confirmado"] as const;

/** Indica si un turno sigue activo (pendiente o confirmado). */
export function esTurnoActivo(estado: EstadoTurno): boolean {
  return estado === "pendiente" || estado === "confirmado";
}

/** Anticipación mínima para cancelar un operativo sin invocar fuerza mayor (F4). */
export const HORAS_MINIMAS_CANCELACION = 48;

/** Anticipación con la que se programa el recordatorio de un turno confirmado (F3/F12). */
export const HORAS_RECORDATORIO = 24;

/** Indica si el tipo solicitado o realizado incluye castración. */
export function incluyeCastracion(tipo: TipoProcedimiento): boolean {
  return tipo !== "chipeo";
}

/** Indica si el tipo solicitado o realizado incluye chipeo. */
export function incluyeChipeo(tipo: TipoProcedimiento): boolean {
  return tipo !== "castracion";
}
```

- [ ] **Step 4: `src/lib/fechas.ts` — agregar al final**

```ts

/** Desfase de Río Grande respecto de UTC: UTC−3 todo el año (sin horario de verano). */
const DESFASE_LOCAL = "-03:00";

/** Milisegundos de una hora, para cálculos de anticipación (48 h, 24 h). */
export const MS_POR_HORA = 60 * 60 * 1000;

/** "09:30:00" o "09:30" → "09:30" (PostgreSQL devuelve las columnas TIME con segundos). */
export function horaCorta(hora: string): string {
  return hora.slice(0, 5);
}

/** Instante (Date) que corresponde a una fecha YYYY-MM-DD y una hora locales de Río Grande. */
export function instanteLocal(fecha: string, hora: string): Date {
  return new Date(`${fecha}T${horaCorta(hora)}:00${DESFASE_LOCAL}`);
}
```

- [ ] **Step 5: `src/lib/etiquetas.ts`**

5a. Reemplazar la primera línea (import) por:

```ts
import type {
  CondicionAnimal, EstadoEnvio, EstadoOperativo, EstadoTurno, NombreRol, SexoAnimal, TipoMovimiento,
  TipoNotificacion, TipoPersonal, TipoProcedimiento,
} from "./constantes";
```

5b. Agregar debajo de `ETIQUETAS_TIPO_MOVIMIENTO` (antes de `OpcionTexto`):

```ts
export const ETIQUETAS_ESTADO_OPERATIVO: Record<EstadoOperativo, string> = {
  programado: "Programado",
  en_curso: "En curso",
  realizado: "Realizado",
  cancelado: "Cancelado",
};

export const ETIQUETAS_ESTADO_TURNO: Record<EstadoTurno, string> = {
  pendiente: "Pendiente",
  confirmado: "Confirmado",
  completado: "Completado",
  cancelado: "Cancelado",
};

export const ETIQUETAS_TIPO_PROCEDIMIENTO: Record<TipoProcedimiento, string> = {
  castracion: "Castración",
  chipeo: "Chipeo",
  castracion_y_chipeo: "Castración y chipeo",
};

export const ETIQUETAS_TIPO_NOTIFICACION: Record<TipoNotificacion, string> = {
  recordatorio: "Recordatorio",
  confirmacion: "Confirmación",
  cancelacion: "Cancelación",
  reprogramacion: "Reprogramación",
};

export const ETIQUETAS_ESTADO_ENVIO: Record<EstadoEnvio, string> = {
  pendiente: "Pendiente",
  enviado: "Enviado",
  fallido: "Fallido",
  anulado: "Anulado",
};

/** Nombre visible de un animal: el registrado o, si no tiene, su número ("Animal #7"). */
export function nombreAnimal(animal: { id: number; nombre: string | null }): string {
  return animal.nombre || `Animal #${animal.id}`;
}
```

- [ ] **Step 6: `src/schemas/comun.ts` — agregar al final**

```ts

/** Fecha YYYY-MM-DD (inputs type="date"). */
export const fechaValida = z.iso.date("Ingrese una fecha válida");

/** Hora HH:MM entre 00:00 y 23:59 (inputs type="time"). */
export const horaValida = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Ingrese una hora válida (HH:MM)");

/** Id elegido en una lista desplegable; el mensaje se muestra también si no se eligió nada (null). */
export const idSeleccionado = (mensaje: string) => z.number(mensaje).int(mensaje).positive(mensaje);
```

- [ ] **Step 7: Correr y verificar que pasa**

Run: `npx vitest run tests/lib/dominio-fase3.test.ts`
Expected: PASS (6 tests).

---

### Task 3: Esquemas de validación

**Files:**
- Create: `src/schemas/operativos.ts`, `src/schemas/turnos.ts`, `src/schemas/notificaciones.ts`

- [ ] **Step 1: `src/schemas/operativos.ts`**

```ts
import { ESTADOS_OPERATIVO } from "@/lib/constantes";
import { esquemaListado, fechaValida, horaValida, idSeleccionado, textoRequerido, z } from "./comun";

/** Alta y edición de operativos (F4). Las horas HH:MM se comparan como texto. */
export const esquemaOperativo = z
  .object({
    fecha: fechaValida,
    hora_inicio: horaValida,
    hora_fin: horaValida,
    lugar: textoRequerido(150),
    cupo_maximo: z
      .number("Ingrese un número")
      .int("Ingrese un número entero")
      .min(1, "Debe ser mayor a 0")
      .max(500, "Máximo 500 turnos"),
    zona_id: idSeleccionado("Seleccione una zona"),
  })
  .refine((datos) => datos.hora_fin > datos.hora_inicio, {
    path: ["hora_fin"],
    message: "Debe ser posterior a la hora de inicio",
  });
export type DatosOperativo = z.infer<typeof esquemaOperativo>;

/** Listado de operativos: período (próximos por defecto), estado y zona opcionales. */
export const esquemaListadoOperativos = esquemaListado.extend({
  periodo: z.enum(["proximos", "pasados", "todos"]).default("proximos"),
  estado: z.enum(ESTADOS_OPERATIVO).optional(),
  zona_id: z.coerce.number().int().positive().optional(),
});
export type ParametrosListadoOperativos = z.infer<typeof esquemaListadoOperativos>;

/** Asignación o retiro de un integrante del personal. */
export const esquemaPersonalOperativo = z.object({
  veterinario_id: idSeleccionado("Seleccione un integrante del personal"),
});
export type DatosPersonalOperativo = z.infer<typeof esquemaPersonalOperativo>;

/** Cancelación (solo administrador): motivo obligatorio y casilla de fuerza mayor. */
export const esquemaCancelarOperativo = z.object({
  motivo: textoRequerido(255),
  fuerza_mayor: z.boolean(),
});
export type DatosCancelarOperativo = z.infer<typeof esquemaCancelarOperativo>;

/** Cambio de estado manual: iniciar (en curso) o finalizar (realizado). */
export const esquemaEstadoOperativo = z.object({
  estado: z.enum(["en_curso", "realizado"], "Estado no válido"),
});
export type DatosEstadoOperativo = z.infer<typeof esquemaEstadoOperativo>;
```

- [ ] **Step 2: `src/schemas/turnos.ts`**

```ts
import { ESTADOS_TURNO, TIPOS_PROCEDIMIENTO } from "@/lib/constantes";
import { esquemaListado, horaValida, idSeleccionado, textoRequerido, z } from "./comun";

/** Solicitud de turno (F3): animal, operativo, horario y tipo de procedimiento. */
export const esquemaSolicitarTurno = z.object({
  animal_id: idSeleccionado("Seleccione un animal"),
  operativo_id: idSeleccionado("Seleccione un operativo"),
  horario: horaValida,
  tipo_solicitado: z.enum(TIPOS_PROCEDIMIENTO, "Seleccione el tipo de procedimiento"),
});
export type DatosSolicitarTurno = z.infer<typeof esquemaSolicitarTurno>;

/** Reprogramación: nuevo operativo (puede ser el mismo) y nuevo horario. */
export const esquemaReprogramarTurno = z.object({
  operativo_id: idSeleccionado("Seleccione un operativo"),
  horario: horaValida,
});
export type DatosReprogramarTurno = z.infer<typeof esquemaReprogramarTurno>;

/** Cancelación de un turno: el motivo es obligatorio. */
export const esquemaCancelarTurno = z.object({ motivo: textoRequerido(255) });
export type DatosCancelarTurno = z.infer<typeof esquemaCancelarTurno>;

/** Listado de turnos: texto (animal o tutor), estado y operativo opcionales. */
export const esquemaListadoTurnos = esquemaListado.extend({
  estado: z.enum(ESTADOS_TURNO).optional(),
  operativo_id: z.coerce.number().int().positive().optional(),
});
export type ParametrosListadoTurnos = z.infer<typeof esquemaListadoTurnos>;
```

- [ ] **Step 3: `src/schemas/notificaciones.ts`**

```ts
import { ESTADOS_ENVIO, TIPOS_NOTIFICACION } from "@/lib/constantes";
import { esquemaListado, fechaValida, z } from "./comun";

/** Listado de notificaciones (F12): texto (vecino), tipo, estado y rango de fecha programada. */
export const esquemaListadoNotificaciones = esquemaListado.extend({
  tipo: z.enum(TIPOS_NOTIFICACION).optional(),
  estado: z.enum(ESTADOS_ENVIO).optional(),
  desde: fechaValida.optional(),
  hasta: fechaValida.optional(),
});
export type ParametrosListadoNotificaciones = z.infer<typeof esquemaListadoNotificaciones>;
```

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit`
Expected: sin errores.

---

### Task 4: Mailer y servicio de notificaciones (TDD)

**Files:**
- Create: `src/lib/mailer.ts`, `src/services/notificaciones.ts`
- Modify: `tests/helpers/fabricas.ts`
- Test: `tests/services/notificaciones.test.ts`

- [ ] **Step 1: Agregar fábricas en `tests/helpers/fabricas.ts`**

1a. Reemplazar las líneas de import de constantes y de `@/lib/db`:

```ts
import type { EstadoOperativo, EstadoTurno } from "@/lib/constantes";
import { Animal, Operativo, Rol, Turno, Usuario, Vecino, Zona } from "@/lib/db";
```

por:

```ts
import type { EstadoEnvio, EstadoOperativo, EstadoTurno, TipoNotificacion } from "@/lib/constantes";
import { Animal, Notificacion, Operativo, Rol, Turno, Usuario, Vecino, Veterinario, Zona } from "@/lib/db";
```

1b. Agregar al final del archivo:

```ts

/** Crea un integrante del personal: veterinario con matrícula única. */
export async function crearPersonalPrueba(opciones: { activo?: boolean } = {}): Promise<Veterinario> {
  secuencia += 1;
  return Veterinario.create({
    tipo: "veterinario",
    nombre: "Personal",
    apellido: `Prueba ${secuencia}`,
    matricula: `MP-${secuencia}`,
    activo: opciones.activo ?? true,
  });
}

/** Crea una notificación de un turno (por defecto, una confirmación lista para enviar). */
export async function crearNotificacionPrueba(
  turnoId: number,
  vecinoId: number,
  opciones: { tipo?: TipoNotificacion; estado?: EstadoEnvio; fechaProgramada?: Date } = {},
): Promise<Notificacion> {
  return Notificacion.create({
    tipo: opciones.tipo ?? "confirmacion",
    mensaje: "Mensaje de prueba",
    estado_envio: opciones.estado ?? "pendiente",
    fecha_programada: opciones.fechaProgramada ?? new Date(),
    turno_id: turnoId,
    vecino_id: vecinoId,
  });
}
```

- [ ] **Step 2: Escribir el test que falla `tests/services/notificaciones.test.ts`**

```ts
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sequelize, Vecino } from "@/lib/db";
import { hoyLocal, sumarDias } from "@/lib/fechas";
import type { Correo } from "@/lib/mailer";
import { listarNotificaciones, procesarPendientes, reintentarNotificacion } from "@/services/notificaciones";
import { reiniciarDatos } from "../helpers/bd";
import { crearAnimalPrueba, crearNotificacionPrueba, crearOperativoPrueba, crearTurnoPrueba } from "../helpers/fabricas";

beforeEach(reiniciarDatos);
afterEach(() => vi.restoreAllMocks());
afterAll(() => sequelize.close());

/** Turno confirmado de un animal con tutor (el tutor de las fábricas siempre tiene email). */
async function turnoConTutor() {
  const animal = await crearAnimalPrueba();
  const operativo = await crearOperativoPrueba();
  const turno = await crearTurnoPrueba(animal.id, operativo.id, "confirmado");
  const vecino = (await Vecino.findByPk(animal.vecino_id!))!;
  return { turno, vecino };
}

/** Envío simulado: registra los correos en lugar de mandarlos por SMTP. */
function envioSimulado() {
  const enviados: Correo[] = [];
  return { enviados, enviar: async (correo: Correo) => void enviados.push(correo) };
}

describe("procesador de envío (F12)", () => {
  it("envía las pendientes vencidas y deja las programadas a futuro", async () => {
    const { turno, vecino } = await turnoConTutor();
    const inmediata = await crearNotificacionPrueba(turno.id, vecino.id);
    const futura = await crearNotificacionPrueba(turno.id, vecino.id, {
      tipo: "recordatorio",
      fechaProgramada: new Date(Date.now() + 60 * 60 * 1000),
    });
    const { enviados, enviar } = envioSimulado();

    expect(await procesarPendientes(enviar)).toEqual({ enviadas: 1, fallidas: 0 });
    expect(enviados).toEqual([{ para: vecino.email, asunto: "SIGCAN – Turno confirmado", texto: "Mensaje de prueba" }]);
    await inmediata.reload();
    expect(inmediata.estado_envio).toBe("enviado");
    expect(inmediata.fecha_envio).not.toBeNull();
    await futura.reload();
    expect(futura.estado_envio).toBe("pendiente");
  });

  it("marca como fallidas las que no se pudieron enviar y permite reintentarlas", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { turno, vecino } = await turnoConTutor();
    const notificacion = await crearNotificacionPrueba(turno.id, vecino.id);

    const fallar = async () => {
      throw new Error("SMTP caído");
    };
    expect(await procesarPendientes(fallar)).toEqual({ enviadas: 0, fallidas: 1 });
    await notificacion.reload();
    expect(notificacion.estado_envio).toBe("fallido");

    await reintentarNotificacion(notificacion.id);
    await notificacion.reload();
    expect(notificacion.estado_envio).toBe("pendiente");
    expect(await procesarPendientes(envioSimulado().enviar)).toEqual({ enviadas: 1, fallidas: 0 });
  });

  it("falla la notificación si el vecino ya no tiene email", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { turno, vecino } = await turnoConTutor();
    await crearNotificacionPrueba(turno.id, vecino.id);
    await vecino.update({ email: null });
    expect(await procesarPendientes(envioSimulado().enviar)).toEqual({ enviadas: 0, fallidas: 1 });
  });

  it("solo reintenta notificaciones fallidas", async () => {
    const { turno, vecino } = await turnoConTutor();
    const notificacion = await crearNotificacionPrueba(turno.id, vecino.id);
    await expect(reintentarNotificacion(notificacion.id)).rejects.toThrow(
      "Solo se pueden reintentar las notificaciones fallidas",
    );
  });
});

describe("listado de notificaciones", () => {
  it("filtra por estado, tipo y rango de fechas", async () => {
    const { turno, vecino } = await turnoConTutor();
    await crearNotificacionPrueba(turno.id, vecino.id, { estado: "fallido" });
    await crearNotificacionPrueba(turno.id, vecino.id, { tipo: "cancelacion" });
    const base = { pagina: 1, tamanio: 10, busqueda: "" };

    expect((await listarNotificaciones({ ...base, estado: "fallido" })).total).toBe(1);
    expect((await listarNotificaciones({ ...base, tipo: "cancelacion" })).filas).toEqual([
      expect.objectContaining({ tipo: "cancelacion", email: vecino.email }),
    ]);
    expect((await listarNotificaciones({ ...base, desde: hoyLocal(), hasta: hoyLocal() })).total).toBe(2);
    expect((await listarNotificaciones({ ...base, hasta: sumarDias(hoyLocal(), -1) })).total).toBe(0);
  });
});
```

- [ ] **Step 3: Correr y verificar que falla**

Run: `npx vitest run tests/services/notificaciones.test.ts`
Expected: FAIL (no existen `@/lib/mailer` ni `@/services/notificaciones`).

- [ ] **Step 4: `src/lib/mailer.ts`**

```ts
import nodemailer from "nodemailer";
import type { TipoNotificacion } from "./constantes";

/**
 * Envío de correo por SMTP (F12) con Nodemailer. La configuración se toma de .env
 * (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM). Este módulo solo envía:
 * qué enviar y cuándo lo decide el servicio de notificaciones.
 */

/** Correo listo para enviar. */
export interface Correo {
  para: string;
  asunto: string;
  texto: string;
}

/** Asunto de cada tipo de notificación. */
export const ASUNTOS_NOTIFICACION: Record<TipoNotificacion, string> = {
  recordatorio: "SIGCAN – Recordatorio de turno",
  confirmacion: "SIGCAN – Turno confirmado",
  cancelacion: "SIGCAN – Turno cancelado",
  reprogramacion: "SIGCAN – Turno reprogramado",
};

/** Indica si están completos los datos mínimos del servidor SMTP. */
export function smtpConfigurado(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

/** Transporte reutilizable (se crea en el primer envío). */
let transporte: ReturnType<typeof nodemailer.createTransport> | null = null;

/** Devuelve el transporte SMTP o lanza un error si falta configuración. */
function obtenerTransporte() {
  if (!smtpConfigurado()) {
    throw new Error("El servidor SMTP no está configurado (SMTP_HOST, SMTP_USER y SMTP_PASS en .env)");
  }
  const puerto = Number(process.env.SMTP_PORT ?? 465);
  transporte ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: puerto,
    // El puerto 465 usa TLS desde el inicio; el 587 negocia STARTTLS.
    secure: puerto === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transporte;
}

/** Envía un correo de texto plano. Lanza un error si el servidor SMTP lo rechaza. */
export async function enviarCorreo(correo: Correo): Promise<void> {
  await obtenerTransporte().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: correo.para,
    subject: correo.asunto,
    text: correo.texto,
  });
}
```

- [ ] **Step 5: `src/services/notificaciones.ts`**

```ts
import { Op, type Transaction } from "sequelize";
import { HORAS_RECORDATORIO, type EstadoEnvio, type TipoNotificacion } from "@/lib/constantes";
import { condicionBusqueda } from "@/lib/busqueda";
import { Notificacion, sequelize, Turno, Vecino } from "@/lib/db";
import { ReglaNegocioError } from "@/lib/errores";
import { ETIQUETAS_TIPO_PROCEDIMIENTO, nombreAnimal } from "@/lib/etiquetas";
import { formatearFecha, horaCorta, instanteLocal, MS_POR_HORA, sumarDias } from "@/lib/fechas";
import { ASUNTOS_NOTIFICACION, enviarCorreo, type Correo } from "@/lib/mailer";
import type { ResultadoPaginado } from "@/schemas/comun";
import type { ParametrosListadoNotificaciones } from "@/schemas/notificaciones";
import { buscarPorId, paginacion } from "./comun";

/** Representación pública de una notificación (F12). Las fechas viajan en ISO 8601. */
export interface NotificacionDto {
  id: number;
  tipo: TipoNotificacion;
  estado_envio: EstadoEnvio;
  mensaje: string;
  fecha_programada: string;
  fecha_envio: string | null;
  turno_id: number;
  /** "Apellido, Nombre" del vecino destinatario. */
  vecino: string;
  email: string | null;
}

/** Resultado de una ejecución del procesador de envío. */
export interface ResultadoProcesamiento {
  enviadas: number;
  fallidas: number;
}

/** Cantidad máxima de notificaciones que envía cada ejecución del procesador. */
const LOTE_ENVIO = 50;

/* ───────────────────────── Generación (dentro de las transacciones de F3/F4) ───────────────────────── */

/**
 * Carga un turno con lo necesario para redactar un aviso: animal con su tutor y
 * operativo con su zona. Se llama después de bloquear y actualizar el turno.
 */
export async function cargarTurnoNotificable(turnoId: number, transaction: Transaction): Promise<Turno> {
  const turno = await Turno.findByPk(turnoId, {
    include: [
      { association: "animal", include: [{ association: "vecino" }] },
      { association: "operativo", include: [{ association: "zona" }] },
    ],
    transaction,
  });
  return turno!;
}

/** Redacta el cuerpo del correo según el tipo de notificación. */
function redactarMensaje(tipo: TipoNotificacion, turno: Turno, motivo?: string): string {
  const animal = turno.animal!;
  const operativo = turno.operativo!;
  const servicio = ETIQUETAS_TIPO_PROCEDIMIENTO[turno.tipo_solicitado].toLowerCase();
  const sujeto = `el turno de ${servicio} de ${nombreAnimal(animal)}`;
  const cuando = `el ${formatearFecha(operativo.fecha)} a las ${horaCorta(turno.horario)} h`;
  const donde = `en ${operativo.lugar} (${operativo.zona!.nombre})`;

  const cuerpos: Record<TipoNotificacion, string> = {
    confirmacion: `Le confirmamos ${sujeto} ${cuando} ${donde}.`,
    recordatorio: `Le recordamos que mañana tiene ${sujeto} ${cuando} ${donde}.`,
    reprogramacion: `Le informamos que ${sujeto} fue reprogramado para ${cuando} ${donde}.`,
    cancelacion: `Le informamos que ${sujeto} previsto para ${cuando} fue cancelado. Motivo: ${motivo ?? "no informado"}.`,
  };
  return `Hola ${animal.vecino!.nombre}:\n\n${cuerpos[tipo]}\n\nZoonosis – Municipio de Río Grande`;
}

/**
 * Registra un aviso inmediato (confirmación, reprogramación o cancelación) para el tutor
 * del turno. No se genera si el animal no tiene tutor o el tutor no tiene email (F12).
 * `turno` debe venir de `cargarTurnoNotificable()`.
 */
export async function notificar(
  turno: Turno,
  tipo: Exclude<TipoNotificacion, "recordatorio">,
  transaction: Transaction,
  motivo?: string,
): Promise<void> {
  const vecino = turno.animal?.vecino;
  if (!vecino?.email) return;
  await Notificacion.create(
    {
      tipo,
      mensaje: redactarMensaje(tipo, turno, motivo),
      fecha_programada: new Date(),
      turno_id: turno.id,
      vecino_id: vecino.id,
    },
    { transaction },
  );
}

/**
 * Programa el recordatorio 24 h antes de un turno confirmado. Si ese momento ya pasó
 * (turno muy próximo), no se programa. `turno` debe venir de `cargarTurnoNotificable()`.
 */
export async function programarRecordatorio(turno: Turno, transaction: Transaction): Promise<void> {
  const vecino = turno.animal?.vecino;
  if (turno.estado !== "confirmado" || !vecino?.email) return;

  const inicioTurno = instanteLocal(turno.operativo!.fecha, turno.horario);
  const momento = new Date(inicioTurno.getTime() - HORAS_RECORDATORIO * MS_POR_HORA);
  if (momento <= new Date()) return;

  await Notificacion.create(
    {
      tipo: "recordatorio",
      mensaje: redactarMensaje("recordatorio", turno),
      fecha_programada: momento,
      turno_id: turno.id,
      vecino_id: vecino.id,
    },
    { transaction },
  );
}

/**
 * Anula los recordatorios todavía no enviados (pendientes o fallidos) de los turnos
 * indicados: el turno fue cancelado, reprogramado o completado. No se borran (trazabilidad).
 */
export async function anularRecordatorios(turnoIds: number[], transaction: Transaction): Promise<void> {
  if (turnoIds.length === 0) return;
  await Notificacion.update(
    { estado_envio: "anulado" },
    {
      where: { turno_id: turnoIds, tipo: "recordatorio", estado_envio: { [Op.in]: ["pendiente", "fallido"] } },
      transaction,
    },
  );
}

/* ───────────────────────── Envío ───────────────────────── */

/**
 * Procesador de envío (F12): toma las notificaciones pendientes cuya fecha programada ya
 * llegó, las envía y las marca como enviadas (con fecha de envío) o fallidas.
 * Las filas se bloquean con FOR UPDATE SKIP LOCKED: si el temporizador y el botón
 * "Procesar pendientes" coinciden, cada notificación la envía una sola ejecución.
 * `enviar` se puede reemplazar en los tests para no usar SMTP real.
 */
export async function procesarPendientes(
  enviar: (correo: Correo) => Promise<void> = enviarCorreo,
): Promise<ResultadoProcesamiento> {
  return sequelize.transaction(async (transaction) => {
    const pendientes = await Notificacion.findAll({
      where: { estado_envio: "pendiente", fecha_programada: { [Op.lte]: new Date() } },
      order: [["fecha_programada", "ASC"], ["id", "ASC"]],
      limit: LOTE_ENVIO,
      lock: transaction.LOCK.UPDATE,
      skipLocked: true,
      transaction,
    });
    if (pendientes.length === 0) return { enviadas: 0, fallidas: 0 };

    // Emails actuales de los destinatarios (se consultan aparte: no se combina lock con include).
    const vecinos = await Vecino.findAll({
      attributes: ["id", "email"],
      where: { id: [...new Set(pendientes.map((notificacion) => notificacion.vecino_id))] },
      transaction,
    });
    const emails = new Map(vecinos.map((vecino) => [vecino.id, vecino.email]));

    const resultado: ResultadoProcesamiento = { enviadas: 0, fallidas: 0 };
    for (const notificacion of pendientes) {
      try {
        const para = emails.get(notificacion.vecino_id);
        if (!para) throw new Error("El vecino no tiene email registrado");
        await enviar({ para, asunto: ASUNTOS_NOTIFICACION[notificacion.tipo], texto: notificacion.mensaje });
        await notificacion.update({ estado_envio: "enviado", fecha_envio: new Date() }, { transaction });
        resultado.enviadas += 1;
      } catch (error) {
        console.error(`No se pudo enviar la notificación ${notificacion.id}:`, error);
        await notificacion.update({ estado_envio: "fallido" }, { transaction });
        resultado.fallidas += 1;
      }
    }
    return resultado;
  });
}

/** Vuelve a poner en cola una notificación fallida (se envía en la próxima ejecución). */
export async function reintentarNotificacion(id: number): Promise<void> {
  await sequelize.transaction(async (transaction) => {
    const notificacion = await buscarPorId(Notificacion, id, "La notificación no existe", {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (notificacion.estado_envio !== "fallido") {
      throw new ReglaNegocioError("Solo se pueden reintentar las notificaciones fallidas");
    }
    await notificacion.update({ estado_envio: "pendiente", fecha_programada: new Date() }, { transaction });
  });
}

/* ───────────────────────── Consulta ───────────────────────── */

/** Listado paginado (más recientes primero) con búsqueda por vecino y filtros de tipo, estado y fechas. */
export async function listarNotificaciones(
  parametros: ParametrosListadoNotificaciones,
): Promise<ResultadoPaginado<NotificacionDto>> {
  const { rows, count } = await Notificacion.findAndCountAll({
    where: {
      [Op.and]: [
        condicionBusqueda(["vecino.apellido", "vecino.nombre", "vecino.email"], parametros.busqueda),
        parametros.tipo ? { tipo: parametros.tipo } : {},
        parametros.estado ? { estado_envio: parametros.estado } : {},
        // Rango de días locales: desde las 00:00 de "desde" hasta antes de las 00:00 del día siguiente a "hasta".
        parametros.desde ? { fecha_programada: { [Op.gte]: instanteLocal(parametros.desde, "00:00") } } : {},
        parametros.hasta
          ? { fecha_programada: { [Op.lt]: instanteLocal(sumarDias(parametros.hasta, 1), "00:00") } }
          : {},
      ],
    },
    include: [{ association: "vecino", attributes: ["id", "nombre", "apellido", "email"] }],
    order: [["fecha_programada", "DESC"], ["id", "DESC"]],
    ...paginacion(parametros),
  });
  return {
    filas: rows.map((notificacion) => ({
      id: notificacion.id,
      tipo: notificacion.tipo,
      estado_envio: notificacion.estado_envio,
      mensaje: notificacion.mensaje,
      fecha_programada: notificacion.fecha_programada.toISOString(),
      fecha_envio: notificacion.fecha_envio?.toISOString() ?? null,
      turno_id: notificacion.turno_id,
      vecino: `${notificacion.vecino!.apellido}, ${notificacion.vecino!.nombre}`,
      email: notificacion.vecino!.email,
    })),
    total: count,
    pagina: parametros.pagina,
    tamanio: parametros.tamanio,
  };
}
```

- [ ] **Step 6: Correr y verificar que pasa**

Run: `npx vitest run tests/services/notificaciones.test.ts`
Expected: PASS (5 tests). Los `console.error` de los envíos fallidos están silenciados en el test.

---

### Task 5: Servicio de turnos — F3 (TDD)

**Files:**
- Create: `src/services/turnos.ts`
- Test: `tests/services/turnos.test.ts`

- [ ] **Step 1: Escribir el test que falla `tests/services/turnos.test.ts`**

```ts
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { HORAS_RECORDATORIO } from "@/lib/constantes";
import { Notificacion, sequelize, Vecino } from "@/lib/db";
import { instanteLocal, MS_POR_HORA } from "@/lib/fechas";
import type { DatosSolicitarTurno } from "@/schemas/turnos";
import { cancelarTurno, confirmarTurno, listarTurnos, reprogramarTurno, solicitarTurno } from "@/services/turnos";
import { reiniciarDatos } from "../helpers/bd";
import { crearAnimalPrueba, crearOperativoPrueba, crearTurnoPrueba, crearVecinoPrueba } from "../helpers/fabricas";

beforeEach(reiniciarDatos);
afterAll(() => sequelize.close());

/** Operativo a 7 días (09:00 a 13:00, cupo 20), animal con tutor y datos de una solicitud a las 10:00. */
async function escenario() {
  const operativo = await crearOperativoPrueba();
  const animal = await crearAnimalPrueba();
  const datos: DatosSolicitarTurno = {
    animal_id: animal.id,
    operativo_id: operativo.id,
    horario: "10:00",
    tipo_solicitado: "castracion",
  };
  return { operativo, animal, datos };
}

/** Notificaciones de un turno como pares [tipo, estado], en orden de creación. */
async function notificacionesDe(turnoId: number) {
  const filas = await Notificacion.findAll({ where: { turno_id: turnoId }, order: [["id", "ASC"]] });
  return filas.map((notificacion) => [notificacion.tipo, notificacion.estado_envio]);
}

describe("solicitar turno (F3)", () => {
  it("crea el turno pendiente sin generar notificaciones", async () => {
    const { datos } = await escenario();
    const turno = await solicitarTurno(datos);
    expect(turno).toMatchObject({ estado: "pendiente", horario: "10:00", tipo_solicitado: "castracion" });
    expect(await notificacionesDe(turno.id)).toEqual([]);
  });

  it("rechaza la solicitud si el operativo no tiene cupo; los turnos cancelados liberan cupo", async () => {
    const { operativo, datos } = await escenario();
    await operativo.update({ cupo_maximo: 1 });
    const ocupante = await crearTurnoPrueba((await crearAnimalPrueba()).id, operativo.id);
    await expect(solicitarTurno(datos)).rejects.toThrow("El operativo no tiene cupo disponible");

    await ocupante.update({ estado: "cancelado", motivo_cancelacion: "Prueba" });
    await expect(solicitarTurno(datos)).resolves.toMatchObject({ estado: "pendiente" });
  });

  it("rechaza un segundo turno activo para el mismo animal", async () => {
    const { datos } = await escenario();
    await solicitarTurno(datos);
    const otro = await crearOperativoPrueba({ diasDesdeHoy: 10 });
    await expect(solicitarTurno({ ...datos, operativo_id: otro.id })).rejects.toThrow(
      "El animal ya tiene un turno pendiente o confirmado",
    );
  });

  it("rechaza horarios fuera de la franja del operativo", async () => {
    const { datos } = await escenario();
    const error = { campos: { horario: "El horario debe estar entre las 09:00 y las 13:00" } };
    await expect(solicitarTurno({ ...datos, horario: "08:59" })).rejects.toMatchObject(error);
    await expect(solicitarTurno({ ...datos, horario: "13:00" })).rejects.toMatchObject(error);
  });

  it("rechaza animales cuyo tutor está dado de baja y acepta callejeros", async () => {
    const { datos } = await escenario();
    const tutorInactivo = await crearVecinoPrueba({ activo: false });
    const conTutorInactivo = await crearAnimalPrueba({ vecinoId: tutorInactivo.id });
    await expect(solicitarTurno({ ...datos, animal_id: conTutorInactivo.id })).rejects.toThrow(
      "El tutor del animal está dado de baja",
    );

    const callejero = await crearAnimalPrueba({ vecinoId: null });
    await expect(solicitarTurno({ ...datos, animal_id: callejero.id })).resolves.toMatchObject({ tutor: null });
  });

  it("no solicita castración para un animal castrado ni chipeo para uno chipeado", async () => {
    const { animal, datos } = await escenario();
    await animal.update({ castrado: true, numero_chip: "123456789012345" });
    await expect(solicitarTurno(datos)).rejects.toThrow("El animal ya está castrado");
    await expect(solicitarTurno({ ...datos, tipo_solicitado: "chipeo" })).rejects.toThrow(
      "El animal ya tiene chip colocado",
    );
  });

  it("rechaza operativos que no están programados", async () => {
    const { operativo, datos } = await escenario();
    await operativo.update({ estado: "en_curso" });
    await expect(solicitarTurno(datos)).rejects.toThrow("El operativo no admite turnos: está en curso");
  });
});

describe("confirmar turno", () => {
  it("genera la confirmación y programa el recordatorio 24 h antes del turno", async () => {
    const { operativo, datos } = await escenario();
    const turno = await confirmarTurno((await solicitarTurno(datos)).id);
    expect(turno.estado).toBe("confirmado");
    expect(await notificacionesDe(turno.id)).toEqual([
      ["confirmacion", "pendiente"],
      ["recordatorio", "pendiente"],
    ]);

    const recordatorio = await Notificacion.findOne({ where: { turno_id: turno.id, tipo: "recordatorio" } });
    const esperado = instanteLocal(operativo.fecha, "10:00").getTime() - HORAS_RECORDATORIO * MS_POR_HORA;
    expect(recordatorio!.fecha_programada.getTime()).toBe(esperado);
    expect(recordatorio!.mensaje).toContain("a las 10:00 h");
  });

  it("no programa el recordatorio si faltan menos de 24 h", async () => {
    const operativo = await crearOperativoPrueba({ diasDesdeHoy: 0 });
    const turno = await crearTurnoPrueba((await crearAnimalPrueba()).id, operativo.id);
    await confirmarTurno(turno.id);
    expect(await notificacionesDe(turno.id)).toEqual([["confirmacion", "pendiente"]]);
  });

  it("no genera notificaciones si el tutor no tiene email", async () => {
    const { animal, datos } = await escenario();
    await Vecino.update({ email: null }, { where: { id: animal.vecino_id! } });
    const turno = await confirmarTurno((await solicitarTurno(datos)).id);
    expect(await notificacionesDe(turno.id)).toEqual([]);
  });

  it("solo confirma turnos pendientes", async () => {
    const { datos } = await escenario();
    const turno = await confirmarTurno((await solicitarTurno(datos)).id);
    await expect(confirmarTurno(turno.id)).rejects.toThrow("Solo se pueden confirmar turnos pendientes");
  });
});

describe("reprogramar turno", () => {
  it("cambia operativo y horario, anula el recordatorio anterior y programa uno nuevo", async () => {
    const { datos } = await escenario();
    const turno = await confirmarTurno((await solicitarTurno(datos)).id);
    const destino = await crearOperativoPrueba({ diasDesdeHoy: 10 });

    const reprogramado = await reprogramarTurno(turno.id, { operativo_id: destino.id, horario: "11:30" });
    expect(reprogramado).toMatchObject({ operativo_id: destino.id, horario: "11:30", estado: "confirmado" });
    expect(await notificacionesDe(turno.id)).toEqual([
      ["confirmacion", "pendiente"],
      ["recordatorio", "anulado"],
      ["reprogramacion", "pendiente"],
      ["recordatorio", "pendiente"],
    ]);
  });

  it("valida el cupo del operativo de destino", async () => {
    const { datos } = await escenario();
    const turno = await solicitarTurno(datos);
    const destino = await crearOperativoPrueba({ diasDesdeHoy: 10 });
    await destino.update({ cupo_maximo: 1 });
    await crearTurnoPrueba((await crearAnimalPrueba()).id, destino.id);
    await expect(reprogramarTurno(turno.id, { operativo_id: destino.id, horario: "11:00" })).rejects.toThrow(
      "El operativo no tiene cupo disponible",
    );
  });

  it("permite cambiar solo el horario dentro del mismo operativo aunque esté completo", async () => {
    const { operativo, datos } = await escenario();
    await operativo.update({ cupo_maximo: 1 });
    const turno = await solicitarTurno(datos);
    const reprogramado = await reprogramarTurno(turno.id, { operativo_id: operativo.id, horario: "12:00" });
    expect(reprogramado.horario).toBe("12:00");
    await expect(reprogramarTurno(turno.id, { operativo_id: operativo.id, horario: "12:00" })).rejects.toMatchObject({
      campos: { horario: "Indique un horario u operativo distinto del actual" },
    });
  });
});

describe("cancelar turno", () => {
  it("anula el recordatorio y avisa la cancelación con el motivo; no cancela dos veces", async () => {
    const { datos } = await escenario();
    const turno = await confirmarTurno((await solicitarTurno(datos)).id);

    const cancelado = await cancelarTurno(turno.id, { motivo: "El vecino no puede asistir" });
    expect(cancelado).toMatchObject({ estado: "cancelado", motivo_cancelacion: "El vecino no puede asistir" });
    expect(await notificacionesDe(turno.id)).toEqual([
      ["confirmacion", "pendiente"],
      ["recordatorio", "anulado"],
      ["cancelacion", "pendiente"],
    ]);
    const aviso = await Notificacion.findOne({ where: { turno_id: turno.id, tipo: "cancelacion" } });
    expect(aviso!.mensaje).toContain("Motivo: El vecino no puede asistir");

    await expect(cancelarTurno(turno.id, { motivo: "Otra vez" })).rejects.toThrow(
      "No se puede cancelar un turno cancelado",
    );
  });
});

describe("listado de turnos", () => {
  it("filtra por estado y operativo y busca por DNI del tutor", async () => {
    const { operativo, animal, datos } = await escenario();
    await solicitarTurno(datos);
    await crearTurnoPrueba((await crearAnimalPrueba()).id, operativo.id, "cancelado");
    const base = { pagina: 1, tamanio: 10, busqueda: "" };

    expect((await listarTurnos({ ...base, operativo_id: operativo.id })).total).toBe(2);
    expect((await listarTurnos({ ...base, estado: "pendiente" })).filas).toEqual([
      expect.objectContaining({ animal_id: animal.id, zona: "Centro" }),
    ]);
    const tutor = (await Vecino.findByPk(animal.vecino_id!))!;
    expect((await listarTurnos({ ...base, busqueda: tutor.dni })).total).toBe(1);
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run tests/services/turnos.test.ts`
Expected: FAIL (no existe `@/services/turnos`).

- [ ] **Step 3: `src/services/turnos.ts`**

```ts
import { Op, type Includeable, type Transaction } from "sequelize";
import {
  ESTADOS_TURNO_ACTIVOS, ESTADOS_TURNO_CON_CUPO, esTurnoActivo, incluyeCastracion, incluyeChipeo,
  type EstadoTurno, type TipoProcedimiento,
} from "@/lib/constantes";
import { condicionBusqueda } from "@/lib/busqueda";
import { Animal, Operativo, sequelize, Turno, Vecino } from "@/lib/db";
import { ReglaNegocioError, ValidacionError } from "@/lib/errores";
import { ETIQUETAS_ESTADO_OPERATIVO, ETIQUETAS_ESTADO_TURNO, nombreAnimal } from "@/lib/etiquetas";
import { horaCorta, instanteLocal } from "@/lib/fechas";
import type { ResultadoPaginado } from "@/schemas/comun";
import type {
  DatosCancelarTurno, DatosReprogramarTurno, DatosSolicitarTurno, ParametrosListadoTurnos,
} from "@/schemas/turnos";
import { buscarPorId, exigirReferencia, paginacion } from "./comun";
import { anularRecordatorios, cargarTurnoNotificable, notificar, programarRecordatorio } from "./notificaciones";

/** Representación pública de un turno (F3), con los datos del animal, tutor y operativo. */
export interface TurnoDto {
  id: number;
  /** HH:MM */
  horario: string;
  tipo_solicitado: TipoProcedimiento;
  estado: EstadoTurno;
  motivo_cancelacion: string | null;
  /** Fecha y hora de la solicitud en ISO 8601. */
  fecha_solicitud: string;
  animal_id: number;
  animal: string;
  /** "Apellido, Nombre" del tutor, o null si el animal no tiene. */
  tutor: string | null;
  operativo_id: number;
  /** Fecha del operativo (YYYY-MM-DD). */
  fecha: string;
  lugar: string;
  zona: string;
}

/** Asociaciones que necesita el DTO: animal con tutor y operativo con zona. */
const INCLUIR_DETALLE: Includeable[] = [
  {
    association: "animal",
    attributes: ["id", "nombre", "vecino_id"],
    include: [{ association: "vecino", attributes: ["id", "nombre", "apellido", "dni"], required: false }],
  },
  {
    association: "operativo",
    attributes: ["id", "fecha", "lugar"],
    include: [{ association: "zona", attributes: ["id", "nombre"] }],
  },
];

/** Convierte el modelo (con sus asociaciones) al DTO público. */
function aDto(turno: Turno): TurnoDto {
  const animal = turno.animal!;
  const operativo = turno.operativo!;
  return {
    id: turno.id,
    horario: horaCorta(turno.horario),
    tipo_solicitado: turno.tipo_solicitado,
    estado: turno.estado,
    motivo_cancelacion: turno.motivo_cancelacion,
    fecha_solicitud: turno.fecha_solicitud.toISOString(),
    animal_id: turno.animal_id,
    animal: nombreAnimal(animal),
    tutor: animal.vecino ? `${animal.vecino.apellido}, ${animal.vecino.nombre}` : null,
    operativo_id: turno.operativo_id,
    fecha: operativo.fecha,
    lugar: operativo.lugar,
    zona: operativo.zona!.nombre,
  };
}

/** Obtiene el DTO de un turno (404 si no existe). */
async function obtenerTurnoDto(id: number, transaction?: Transaction): Promise<TurnoDto> {
  return aDto(await buscarPorId(Turno, id, "El turno no existe", { include: INCLUIR_DETALLE, transaction }));
}

/** Listado paginado con búsqueda por animal o tutor (apellido o DNI) y filtros de estado y operativo. */
export async function listarTurnos(parametros: ParametrosListadoTurnos): Promise<ResultadoPaginado<TurnoDto>> {
  const { rows, count } = await Turno.findAndCountAll({
    where: {
      [Op.and]: [
        // "animal->vecino" es el alias que Sequelize da al tutor incluido dentro del animal.
        condicionBusqueda(["animal.nombre", "animal->vecino.apellido", "animal->vecino.dni"], parametros.busqueda),
        parametros.estado ? { estado: parametros.estado } : {},
        parametros.operativo_id ? { operativo_id: parametros.operativo_id } : {},
      ],
    },
    include: INCLUIR_DETALLE,
    order: [["operativo", "fecha", "DESC"], ["horario", "ASC"], ["id", "ASC"]],
    ...paginacion(parametros),
  });
  return { filas: rows.map(aDto), total: count, pagina: parametros.pagina, tamanio: parametros.tamanio };
}

/**
 * Bloquea la fila del operativo elegido (SELECT … FOR UPDATE): serializa las solicitudes
 * que compiten por su cupo. Si no existe, es un error del campo `operativo_id`.
 */
async function bloquearOperativo(id: number, transaction: Transaction): Promise<Operativo> {
  const operativo = await Operativo.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
  if (!operativo) {
    throw new ValidacionError("Revise los datos ingresados", { operativo_id: "El operativo seleccionado no existe" });
  }
  return operativo;
}

/** Bloquea la fila del turno (404 si no existe). */
function bloquearTurno(id: number, transaction: Transaction): Promise<Turno> {
  return buscarPorId(Turno, id, "El turno no existe", { transaction, lock: transaction.LOCK.UPDATE });
}

/** Exige que el turno esté pendiente o confirmado para la acción indicada. */
function exigirActivo(turno: Turno, accion: string): void {
  if (!esTurnoActivo(turno.estado)) {
    throw new ReglaNegocioError(`No se puede ${accion} un turno ${ETIQUETAS_ESTADO_TURNO[turno.estado].toLowerCase()}`);
  }
}

/**
 * Verifica que el operativo (ya bloqueado) admita un turno en ese horario: estado programado,
 * horario dentro de la franja, instante futuro y cupo disponible. `excluirTurnoId` descuenta
 * el turno que se está reprogramando (no compite consigo mismo por el cupo).
 */
async function validarDisponibilidad(
  operativo: Operativo,
  horario: string,
  transaction: Transaction,
  excluirTurnoId?: number,
): Promise<void> {
  if (operativo.estado !== "programado") {
    throw new ReglaNegocioError(
      `El operativo no admite turnos: está ${ETIQUETAS_ESTADO_OPERATIVO[operativo.estado].toLowerCase()}`,
    );
  }
  const inicio = horaCorta(operativo.hora_inicio);
  const fin = horaCorta(operativo.hora_fin);
  if (horario < inicio || horario >= fin) {
    throw new ValidacionError("Revise los datos ingresados", {
      horario: `El horario debe estar entre las ${inicio} y las ${fin}`,
    });
  }
  if (instanteLocal(operativo.fecha, horario) <= new Date()) {
    throw new ValidacionError("Revise los datos ingresados", { horario: "El horario del turno ya pasó" });
  }
  const ocupados = await Turno.count({
    where: {
      operativo_id: operativo.id,
      estado: { [Op.in]: ESTADOS_TURNO_CON_CUPO },
      ...(excluirTurnoId ? { id: { [Op.ne]: excluirTurnoId } } : {}),
    },
    transaction,
  });
  if (ocupados >= operativo.cupo_maximo) {
    throw new ReglaNegocioError("El operativo no tiene cupo disponible");
  }
}

/**
 * Verifica que el animal pueda pedir el turno: tutor activo (si tiene), que no esté ya
 * castrado o chipeado según lo solicitado y que no tenga otro turno activo.
 */
async function validarAnimal(animal: Animal, tipo: TipoProcedimiento, transaction: Transaction): Promise<void> {
  if (animal.vecino_id !== null) {
    const tutor = await Vecino.findByPk(animal.vecino_id, { transaction });
    if (!tutor?.activo) {
      throw new ReglaNegocioError("El tutor del animal está dado de baja: no puede solicitar turnos");
    }
  }
  if (incluyeCastracion(tipo) && animal.castrado) {
    throw new ReglaNegocioError("El animal ya está castrado");
  }
  if (incluyeChipeo(tipo) && animal.numero_chip) {
    throw new ReglaNegocioError("El animal ya tiene chip colocado");
  }
  const activos = await Turno.count({
    where: { animal_id: animal.id, estado: { [Op.in]: ESTADOS_TURNO_ACTIVOS } },
    transaction,
  });
  // El índice único ux_turno_activo_por_animal es el resguardo ante solicitudes simultáneas.
  if (activos > 0) {
    throw new ReglaNegocioError("El animal ya tiene un turno pendiente o confirmado");
  }
}

/** Solicitud de turno (F3): queda pendiente hasta que se confirma. No genera notificaciones. */
export async function solicitarTurno(datos: DatosSolicitarTurno): Promise<TurnoDto> {
  return sequelize.transaction(async (transaction) => {
    const operativo = await bloquearOperativo(datos.operativo_id, transaction);
    const animal = await exigirReferencia(Animal, datos.animal_id, "animal_id", "El animal seleccionado no existe", transaction);
    await validarAnimal(animal, datos.tipo_solicitado, transaction);
    await validarDisponibilidad(operativo, datos.horario, transaction);
    const turno = await Turno.create(
      { horario: datos.horario, tipo_solicitado: datos.tipo_solicitado, animal_id: animal.id, operativo_id: operativo.id },
      { transaction },
    );
    return obtenerTurnoDto(turno.id, transaction);
  });
}

/** Confirma un turno pendiente: aviso de confirmación y recordatorio 24 h antes (F3/F12). */
export async function confirmarTurno(id: number): Promise<TurnoDto> {
  return sequelize.transaction(async (transaction) => {
    const turno = await bloquearTurno(id, transaction);
    if (turno.estado !== "pendiente") {
      throw new ReglaNegocioError(
        `Solo se pueden confirmar turnos pendientes (el turno está ${ETIQUETAS_ESTADO_TURNO[turno.estado].toLowerCase()})`,
      );
    }
    await turno.update({ estado: "confirmado" }, { transaction });

    const notificable = await cargarTurnoNotificable(id, transaction);
    await notificar(notificable, "confirmacion", transaction);
    await programarRecordatorio(notificable, transaction);
    return obtenerTurnoDto(id, transaction);
  });
}

/**
 * Reprograma un turno activo a otro horario y/o operativo, revalidando el destino.
 * Anula el recordatorio anterior, avisa la reprogramación y, si está confirmado,
 * programa el recordatorio nuevo.
 */
export async function reprogramarTurno(id: number, datos: DatosReprogramarTurno): Promise<TurnoDto> {
  return sequelize.transaction(async (transaction) => {
    // Orden de bloqueo: operativo y después turno (el mismo que usa la cancelación de operativos).
    const destino = await bloquearOperativo(datos.operativo_id, transaction);
    const turno = await bloquearTurno(id, transaction);
    exigirActivo(turno, "reprogramar");
    if (turno.operativo_id === destino.id && horaCorta(turno.horario) === datos.horario) {
      throw new ValidacionError("Revise los datos ingresados", {
        horario: "Indique un horario u operativo distinto del actual",
      });
    }
    await validarDisponibilidad(destino, datos.horario, transaction, turno.id);
    await turno.update({ operativo_id: destino.id, horario: datos.horario }, { transaction });

    await anularRecordatorios([id], transaction);
    const notificable = await cargarTurnoNotificable(id, transaction);
    await notificar(notificable, "reprogramacion", transaction);
    await programarRecordatorio(notificable, transaction);
    return obtenerTurnoDto(id, transaction);
  });
}

/** Cancela un turno activo con motivo: anula su recordatorio y avisa al tutor. */
export async function cancelarTurno(id: number, datos: DatosCancelarTurno): Promise<TurnoDto> {
  return sequelize.transaction(async (transaction) => {
    const turno = await bloquearTurno(id, transaction);
    exigirActivo(turno, "cancelar");
    await turno.update({ estado: "cancelado", motivo_cancelacion: datos.motivo }, { transaction });

    await anularRecordatorios([id], transaction);
    const notificable = await cargarTurnoNotificable(id, transaction);
    await notificar(notificable, "cancelacion", transaction, datos.motivo);
    return obtenerTurnoDto(id, transaction);
  });
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npx vitest run tests/services/turnos.test.ts`
Expected: PASS (16 tests).

---

### Task 6: Servicio de operativos — F4, y opciones de animales y personal (TDD)

**Files:**
- Create: `src/services/operativos.ts`
- Modify: `src/services/animales.ts`, `src/services/personal.ts`
- Test: `tests/services/operativos.test.ts`

- [ ] **Step 1: Escribir el test que falla `tests/services/operativos.test.ts`**

```ts
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { MOTIVOS_CANCELACION } from "@/lib/constantes";
import { Notificacion, sequelize, Turno } from "@/lib/db";
import { hoyLocal, sumarDias } from "@/lib/fechas";
import type { DatosOperativo } from "@/schemas/operativos";
import { opcionesAnimales } from "@/services/animales";
import {
  actualizarOperativo, asignarPersonal, cambiarEstadoOperativo, cancelarOperativo, crearOperativo,
  listarOperativos, opcionesOperativos, quitarPersonal,
} from "@/services/operativos";
import { opcionesPersonal } from "@/services/personal";
import { confirmarTurno } from "@/services/turnos";
import { reiniciarDatos } from "../helpers/bd";
import {
  adminSemilla, crearAnimalPrueba, crearOperativoPrueba, crearPersonalPrueba, crearTurnoPrueba,
  crearVecinoPrueba, zonaSemilla,
} from "../helpers/fabricas";

beforeEach(reiniciarDatos);
afterAll(() => sequelize.close());

/** Datos válidos de un operativo a 7 días en la zona Centro. */
async function datosOperativo(cambios: Partial<DatosOperativo> = {}): Promise<DatosOperativo> {
  return {
    fecha: sumarDias(hoyLocal(), 7),
    hora_inicio: "09:00",
    hora_fin: "13:00",
    lugar: "SUM municipal",
    cupo_maximo: 10,
    zona_id: (await zonaSemilla()).id,
    ...cambios,
  };
}

/** Crea un turno de un animal nuevo con tutor en el operativo indicado. */
async function turnoEn(operativoId: number, estado: Parameters<typeof crearTurnoPrueba>[2] = "pendiente") {
  return crearTurnoPrueba((await crearAnimalPrueba()).id, operativoId, estado);
}

describe("alta, listado y edición (F4)", () => {
  it("crea un operativo programado con su cupo disponible", async () => {
    const operativo = await crearOperativo(await datosOperativo());
    expect(operativo).toMatchObject({
      estado: "programado", hora_inicio: "09:00", hora_fin: "13:00", cupo_maximo: 10,
      ocupados: 0, disponibles: 10, zona: "Centro", personal: [],
    });
  });

  it("rechaza fechas pasadas", async () => {
    await expect(crearOperativo(await datosOperativo({ fecha: sumarDias(hoyLocal(), -1) }))).rejects.toMatchObject({
      campos: { fecha: "La fecha y hora de inicio deben ser futuras" },
    });
  });

  it("calcula el cupo ocupado sin contar los turnos cancelados", async () => {
    const operativo = await crearOperativoPrueba();
    await turnoEn(operativo.id, "pendiente");
    await turnoEn(operativo.id, "cancelado");
    const { filas } = await listarOperativos({ pagina: 1, tamanio: 10, busqueda: "", periodo: "proximos" });
    expect(filas).toEqual([expect.objectContaining({ id: operativo.id, ocupados: 1, disponibles: 19 })]);
    expect(await opcionesOperativos()).toEqual([expect.objectContaining({ id: operativo.id })]);
  });

  it("no deja el cupo por debajo de los turnos ocupados", async () => {
    const operativo = await crearOperativoPrueba();
    await turnoEn(operativo.id);
    await turnoEn(operativo.id);
    await expect(
      actualizarOperativo(operativo.id, await datosOperativo({ fecha: operativo.fecha, cupo_maximo: 1 })),
    ).rejects.toMatchObject({ campos: { cupo_maximo: "No puede ser menor a los 2 turnos ya asignados" } });
  });

  it("si cambia la fecha avisa la reprogramación y recalcula los recordatorios", async () => {
    const operativo = await crearOperativoPrueba();
    const turno = await turnoEn(operativo.id);
    await confirmarTurno(turno.id);

    await actualizarOperativo(operativo.id, await datosOperativo({ fecha: sumarDias(hoyLocal(), 8), cupo_maximo: 20 }));
    const notificaciones = await Notificacion.findAll({ where: { turno_id: turno.id }, order: [["id", "ASC"]] });
    expect(notificaciones.map((n) => [n.tipo, n.estado_envio])).toEqual([
      ["confirmacion", "pendiente"],
      ["recordatorio", "anulado"],
      ["reprogramacion", "pendiente"],
      ["recordatorio", "pendiente"],
    ]);
  });

  it("rechaza un horario que deja turnos afuera y la edición de operativos realizados", async () => {
    const operativo = await crearOperativoPrueba();
    await turnoEn(operativo.id); // turno a las 09:30
    await expect(
      actualizarOperativo(operativo.id, await datosOperativo({ fecha: operativo.fecha, hora_inicio: "10:00", cupo_maximo: 20 })),
    ).rejects.toThrow("1 turno quedaría fuera del nuevo horario");

    await operativo.update({ estado: "realizado" });
    await expect(actualizarOperativo(operativo.id, await datosOperativo({ fecha: operativo.fecha }))).rejects.toThrow(
      "No se puede editar un operativo realizado",
    );
  });
});

describe("personal asignado", () => {
  it("asigna y quita personal activo, sin repetir", async () => {
    const operativo = await crearOperativoPrueba();
    const veterinario = await crearPersonalPrueba();

    const detalle = await asignarPersonal(operativo.id, { veterinario_id: veterinario.id });
    expect(detalle.personal).toEqual([expect.objectContaining({ id: veterinario.id, tipo: "veterinario" })]);
    await expect(asignarPersonal(operativo.id, { veterinario_id: veterinario.id })).rejects.toMatchObject({
      campos: { veterinario_id: "Ya está asignado a este operativo" },
    });
    expect((await quitarPersonal(operativo.id, { veterinario_id: veterinario.id })).personal).toEqual([]);
  });

  it("rechaza personal inactivo y lo excluye de las opciones", async () => {
    const operativo = await crearOperativoPrueba();
    const inactivo = await crearPersonalPrueba({ activo: false });
    await expect(asignarPersonal(operativo.id, { veterinario_id: inactivo.id })).rejects.toMatchObject({
      campos: { veterinario_id: "Solo se puede asignar personal activo" },
    });
    expect(await opcionesPersonal()).toEqual([]);
  });

  it("rechaza la superposición horaria el mismo día; las franjas contiguas se permiten", async () => {
    const veterinario = await crearPersonalPrueba();
    const manana = await crearOperativoPrueba(); // 09:00 a 13:00
    const superpuesto = await crearOperativoPrueba(); // misma franja y día
    await asignarPersonal(manana.id, { veterinario_id: veterinario.id });
    await expect(asignarPersonal(superpuesto.id, { veterinario_id: veterinario.id })).rejects.toThrow(
      "ya está asignado a otro operativo",
    );

    await superpuesto.update({ hora_inicio: "13:00", hora_fin: "15:00" });
    await expect(asignarPersonal(superpuesto.id, { veterinario_id: veterinario.id })).resolves.toBeDefined();
  });
});

describe("cancelación (F4)", () => {
  it("exige 48 h de anticipación salvo fuerza mayor", async () => {
    const admin = await adminSemilla();
    const operativo = await crearOperativoPrueba({ diasDesdeHoy: 1 });
    await expect(
      cancelarOperativo(operativo.id, { motivo: "Lluvia", fuerza_mayor: false }, admin.id),
    ).rejects.toThrow("Faltan menos de 48 h");
    await expect(
      cancelarOperativo(operativo.id, { motivo: "Temporal de nieve: rutas cortadas", fuerza_mayor: true }, admin.id),
    ).resolves.toEqual({ turnosCancelados: 0 });
  });

  it("con más de 48 h no requiere fuerza mayor", async () => {
    const admin = await adminSemilla();
    const operativo = await crearOperativoPrueba({ diasDesdeHoy: 3 });
    await expect(
      cancelarOperativo(operativo.id, { motivo: "Reasignación de personal", fuerza_mayor: false }, admin.id),
    ).resolves.toEqual({ turnosCancelados: 0 });
  });

  it("no cancela un operativo que ya comenzó ni uno en curso", async () => {
    const admin = await adminSemilla();
    const ayer = await crearOperativoPrueba({ diasDesdeHoy: -1 });
    await expect(cancelarOperativo(ayer.id, { motivo: "Tarde", fuerza_mayor: true }, admin.id)).rejects.toThrow(
      "El operativo ya comenzó",
    );
    const enCurso = await crearOperativoPrueba({ diasDesdeHoy: 0, estado: "en_curso" });
    await expect(cancelarOperativo(enCurso.id, { motivo: "Tarde", fuerza_mayor: true }, admin.id)).rejects.toThrow(
      "No se puede cancelar un operativo en curso",
    );
  });

  it("cancela en cascada los turnos activos, anula recordatorios y avisa a los vecinos con correo", async () => {
    const admin = await adminSemilla();
    const operativo = await crearOperativoPrueba({ diasDesdeHoy: 5 });
    const confirmado = await turnoEn(operativo.id);
    await confirmarTurno(confirmado.id);
    await turnoEn(operativo.id);
    await crearTurnoPrueba((await crearAnimalPrueba({ vecinoId: null })).id, operativo.id); // callejero: sin aviso

    const resultado = await cancelarOperativo(operativo.id, { motivo: "Falta de insumos", fuerza_mayor: false }, admin.id);
    expect(resultado).toEqual({ turnosCancelados: 3 });

    await operativo.reload();
    expect(operativo.estado).toBe("cancelado");
    expect(operativo.motivo_cancelacion).toBe("Falta de insumos");
    expect(operativo.usuario_cancelacion_id).toBe(admin.id);
    expect(operativo.fecha_cancelacion).not.toBeNull();

    const turnos = await Turno.findAll({ where: { operativo_id: operativo.id } });
    expect(turnos.map((t) => [t.estado, t.motivo_cancelacion])).toEqual(
      Array(3).fill(["cancelado", MOTIVOS_CANCELACION.operativoCancelado]),
    );
    expect(await Notificacion.count({ where: { tipo: "recordatorio", estado_envio: "pendiente" } })).toBe(0);
    expect(await Notificacion.count({ where: { tipo: "cancelacion" } })).toBe(2);
  });
});

describe("cambios de estado", () => {
  it("solo inicia el operativo el día programado", async () => {
    const futuro = await crearOperativoPrueba({ diasDesdeHoy: 7 });
    await expect(cambiarEstadoOperativo(futuro.id, { estado: "en_curso" })).rejects.toThrow(
      "solo se puede iniciar el día programado",
    );
    const deHoy = await crearOperativoPrueba({ diasDesdeHoy: 0 });
    await expect(cambiarEstadoOperativo(deHoy.id, { estado: "en_curso" })).resolves.toEqual({ turnosCancelados: 0 });
    await expect(cambiarEstadoOperativo(deHoy.id, { estado: "en_curso" })).rejects.toThrow(
      "Solo se puede iniciar un operativo programado",
    );
  });

  it("al finalizar cancela con 'No se presentó' los turnos que siguen activos, sin enviar avisos", async () => {
    const operativo = await crearOperativoPrueba({ diasDesdeHoy: 0, estado: "en_curso" });
    const ausente = await turnoEn(operativo.id, "confirmado");
    const atendido = await turnoEn(operativo.id, "completado");

    expect(await cambiarEstadoOperativo(operativo.id, { estado: "realizado" })).toEqual({ turnosCancelados: 1 });
    await ausente.reload();
    expect([ausente.estado, ausente.motivo_cancelacion]).toEqual(["cancelado", MOTIVOS_CANCELACION.noSePresento]);
    await atendido.reload();
    expect(atendido.estado).toBe("completado");
    expect(await Notificacion.count()).toBe(0);
  });
});

describe("opciones para el formulario de turnos", () => {
  it("ofrece animales sin tutor o con tutor activo", async () => {
    const callejero = await crearAnimalPrueba({ vecinoId: null });
    const conTutor = await crearAnimalPrueba();
    await crearAnimalPrueba({ vecinoId: (await crearVecinoPrueba({ activo: false })).id });
    const ids = (await opcionesAnimales()).map((opcion) => opcion.id).sort((a, b) => a - b);
    expect(ids).toEqual([callejero.id, conTutor.id].sort((a, b) => a - b));
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run tests/services/operativos.test.ts`
Expected: FAIL (no existen `@/services/operativos`, `opcionesAnimales`, `opcionesPersonal`).

- [ ] **Step 3: `src/services/operativos.ts`**

```ts
import { Op, type Includeable, type ProjectionAlias, type Transaction } from "sequelize";
import {
  ESTADOS_TURNO_ACTIVOS, ESTADOS_TURNO_CON_CUPO, HORAS_MINIMAS_CANCELACION, MOTIVOS_CANCELACION,
  type EstadoOperativo, type TipoPersonal,
} from "@/lib/constantes";
import { condicionBusqueda } from "@/lib/busqueda";
import { Operativo, OperativoVeterinario, sequelize, Turno, Veterinario, Zona } from "@/lib/db";
import { NoEncontradoError, ReglaNegocioError, ValidacionError } from "@/lib/errores";
import { ETIQUETAS_ESTADO_OPERATIVO } from "@/lib/etiquetas";
import { formatearFecha, horaCorta, hoyLocal, instanteLocal, MS_POR_HORA } from "@/lib/fechas";
import type { Opcion, ResultadoPaginado } from "@/schemas/comun";
import type {
  DatosCancelarOperativo, DatosEstadoOperativo, DatosOperativo, DatosPersonalOperativo,
  ParametrosListadoOperativos,
} from "@/schemas/operativos";
import { buscarPorId, exigirReferencia, paginacion } from "./comun";
import { anularRecordatorios, cargarTurnoNotificable, notificar, programarRecordatorio } from "./notificaciones";

/** Representación pública de un operativo (F4). El cupo ocupado se calcula en la base. */
export interface OperativoDto {
  id: number;
  /** YYYY-MM-DD */
  fecha: string;
  /** HH:MM */
  hora_inicio: string;
  hora_fin: string;
  lugar: string;
  cupo_maximo: number;
  /** Turnos pendientes, confirmados o completados. */
  ocupados: number;
  disponibles: number;
  estado: EstadoOperativo;
  zona_id: number;
  zona: string;
  motivo_cancelacion: string | null;
}

/** Integrante del personal asignado a un operativo. */
export interface PersonalAsignadoDto {
  id: number;
  /** "Apellido, Nombre" */
  nombre: string;
  tipo: TipoPersonal;
  matricula: string | null;
}

/** Detalle de un operativo: datos, cupo y personal asignado. */
export interface OperativoDetalleDto extends OperativoDto {
  personal: PersonalAsignadoDto[];
}

/** Resultado de una cancelación o cambio de estado: cuántos turnos se cancelaron en cascada. */
export interface ResultadoCambioEstado {
  turnosCancelados: number;
}

/** Subconsulta del cupo ocupado. `"Operativo"` es el alias del modelo principal en la consulta. */
const ATRIBUTO_OCUPADOS: ProjectionAlias = [
  sequelize.literal(
    `(SELECT COUNT(*) FROM turno AS t WHERE t.operativo_id = "Operativo"."id" AND t.estado IN (${ESTADOS_TURNO_CON_CUPO.map(
      (estado) => `'${estado}'`,
    ).join(", ")}))`,
  ),
  "ocupados",
];

const INCLUIR_ZONA: Includeable = { association: "zona", attributes: ["id", "nombre"] };
const INCLUIR_PERSONAL: Includeable = {
  association: "personal",
  attributes: ["id", "nombre", "apellido", "tipo", "matricula"],
  through: { attributes: [] },
};

/** Estado en minúsculas para los mensajes ("en curso", "realizado"…). */
const estadoEnTexto = (estado: EstadoOperativo) => ETIQUETAS_ESTADO_OPERATIVO[estado].toLowerCase();

/** Convierte el modelo (con zona y el atributo calculado `ocupados`) al DTO público. */
function aDto(operativo: Operativo): OperativoDto {
  const ocupados = Number(operativo.get("ocupados"));
  return {
    id: operativo.id,
    fecha: operativo.fecha,
    hora_inicio: horaCorta(operativo.hora_inicio),
    hora_fin: horaCorta(operativo.hora_fin),
    lugar: operativo.lugar,
    cupo_maximo: operativo.cupo_maximo,
    ocupados,
    disponibles: Math.max(operativo.cupo_maximo - ocupados, 0),
    estado: operativo.estado,
    zona_id: operativo.zona_id,
    zona: operativo.zona!.nombre,
    motivo_cancelacion: operativo.motivo_cancelacion,
  };
}

/** Obtiene el detalle de un operativo con su personal (404 si no existe). */
async function obtenerDetalle(id: number, transaction?: Transaction): Promise<OperativoDetalleDto> {
  const operativo = await buscarPorId(Operativo, id, "El operativo no existe", {
    attributes: { include: [ATRIBUTO_OCUPADOS] },
    include: [INCLUIR_ZONA, INCLUIR_PERSONAL],
    order: [["personal", "apellido", "ASC"]],
    transaction,
  });
  return {
    ...aDto(operativo),
    personal: (operativo.personal ?? []).map((persona) => ({
      id: persona.id,
      nombre: `${persona.apellido}, ${persona.nombre}`,
      tipo: persona.tipo,
      matricula: persona.matricula,
    })),
  };
}

/** Bloquea la fila del operativo (404 si no existe). */
function bloquearOperativo(id: number, transaction: Transaction): Promise<Operativo> {
  return buscarPorId(Operativo, id, "El operativo no existe", { transaction, lock: transaction.LOCK.UPDATE });
}

/** Los operativos realizados o cancelados ya no admiten cambios. */
function exigirVigente(operativo: Operativo, accion: string): void {
  if (operativo.estado === "realizado" || operativo.estado === "cancelado") {
    throw new ReglaNegocioError(`No se puede ${accion} un operativo ${estadoEnTexto(operativo.estado)}`);
  }
}

/** El inicio (fecha + hora de inicio) debe ser futuro. */
function exigirInicioFuturo(fecha: string, horaInicio: string): void {
  if (instanteLocal(fecha, horaInicio) <= new Date()) {
    throw new ValidacionError("Revise los datos ingresados", { fecha: "La fecha y hora de inicio deben ser futuras" });
  }
}

/**
 * Verifica que ninguna de las personas indicadas esté asignada a otro operativo no cancelado
 * del mismo día con franja superpuesta (inicio_a < fin_b y fin_a > inicio_b).
 */
async function verificarSinSuperposicion(
  franja: { id: number; fecha: string; hora_inicio: string; hora_fin: string },
  veterinarioIds: number[],
  transaction: Transaction,
): Promise<void> {
  if (veterinarioIds.length === 0) return;
  const conflicto = await Operativo.findOne({
    where: {
      id: { [Op.ne]: franja.id },
      fecha: franja.fecha,
      estado: { [Op.ne]: "cancelado" },
      hora_inicio: { [Op.lt]: franja.hora_fin },
      hora_fin: { [Op.gt]: franja.hora_inicio },
    },
    include: [
      { association: "personal", where: { id: veterinarioIds }, attributes: ["nombre", "apellido"], through: { attributes: [] } },
    ],
    // Sin subconsulta: findOne agrega LIMIT 1 y el filtro está en la tabla incluida.
    subQuery: false,
    transaction,
  });
  if (conflicto) {
    const persona = conflicto.personal![0];
    throw new ReglaNegocioError(
      `${persona.apellido}, ${persona.nombre} ya está asignado a otro operativo el ${formatearFecha(franja.fecha)} ` +
        `de ${horaCorta(conflicto.hora_inicio)} a ${horaCorta(conflicto.hora_fin)}`,
    );
  }
}

/** Cancela los turnos activos del operativo con el motivo indicado y anula sus recordatorios. */
async function cancelarTurnosActivos(operativoId: number, motivo: string, transaction: Transaction): Promise<number[]> {
  const activos = await Turno.findAll({
    attributes: ["id"],
    where: { operativo_id: operativoId, estado: { [Op.in]: ESTADOS_TURNO_ACTIVOS } },
    transaction,
  });
  const ids = activos.map((turno) => turno.id);
  if (ids.length > 0) {
    await Turno.update({ estado: "cancelado", motivo_cancelacion: motivo }, { where: { id: ids }, transaction });
    await anularRecordatorios(ids, transaction);
  }
  return ids;
}

/** Atributos del modelo a partir del formulario. */
function aAtributos(datos: DatosOperativo) {
  return {
    fecha: datos.fecha,
    hora_inicio: datos.hora_inicio,
    hora_fin: datos.hora_fin,
    lugar: datos.lugar,
    cupo_maximo: datos.cupo_maximo,
    zona_id: datos.zona_id,
  };
}

/** Listado paginado: próximos (ascendente), pasados o todos (descendente), con filtros. */
export async function listarOperativos(
  parametros: ParametrosListadoOperativos,
): Promise<ResultadoPaginado<OperativoDto>> {
  const hoy = hoyLocal();
  const periodo = {
    proximos: { fecha: { [Op.gte]: hoy } },
    pasados: { fecha: { [Op.lt]: hoy } },
    todos: {},
  }[parametros.periodo];
  const direccion = parametros.periodo === "proximos" ? "ASC" : "DESC";

  const { rows, count } = await Operativo.findAndCountAll({
    attributes: { include: [ATRIBUTO_OCUPADOS] },
    where: {
      [Op.and]: [
        condicionBusqueda(["Operativo.lugar", "zona.nombre"], parametros.busqueda),
        periodo,
        parametros.estado ? { estado: parametros.estado } : {},
        parametros.zona_id ? { zona_id: parametros.zona_id } : {},
      ],
    },
    include: [INCLUIR_ZONA],
    order: [["fecha", direccion], ["hora_inicio", direccion]],
    ...paginacion(parametros),
  });
  return { filas: rows.map(aDto), total: count, pagina: parametros.pagina, tamanio: parametros.tamanio };
}

/** Operativos que admiten turnos (programados, de hoy en adelante) para las listas desplegables. */
export async function opcionesOperativos(): Promise<Opcion[]> {
  const operativos = await Operativo.findAll({
    attributes: { include: [ATRIBUTO_OCUPADOS] },
    where: { estado: "programado", fecha: { [Op.gte]: hoyLocal() } },
    include: [INCLUIR_ZONA],
    order: [["fecha", "ASC"], ["hora_inicio", "ASC"]],
  });
  return operativos.map(aDto).map((o) => ({
    id: o.id,
    etiqueta: `${formatearFecha(o.fecha)} ${o.hora_inicio}–${o.hora_fin} · ${o.zona} · ${o.lugar} (${o.disponibles} libres)`,
  }));
}

/** Detalle de un operativo (404 si no existe). */
export function obtenerOperativo(id: number): Promise<OperativoDetalleDto> {
  return obtenerDetalle(id);
}

/** Alta de operativo: inicio futuro y zona existente; queda programado. */
export async function crearOperativo(datos: DatosOperativo): Promise<OperativoDetalleDto> {
  return sequelize.transaction(async (transaction) => {
    exigirInicioFuturo(datos.fecha, datos.hora_inicio);
    await exigirReferencia(Zona, datos.zona_id, "zona_id", "La zona seleccionada no existe", transaction);
    const operativo = await Operativo.create(aAtributos(datos), { transaction });
    return obtenerDetalle(operativo.id, transaction);
  });
}

/**
 * Edición (F4). No se editan operativos realizados ni cancelados; fecha y horario solo
 * cambian mientras está programado. El cupo no puede quedar por debajo de los turnos
 * ocupados ni la franja dejar turnos activos afuera. Si cambian fecha, horario, lugar o
 * zona, cada turno activo recibe aviso de reprogramación y su recordatorio se recalcula.
 */
export async function actualizarOperativo(id: number, datos: DatosOperativo): Promise<OperativoDetalleDto> {
  return sequelize.transaction(async (transaction) => {
    const operativo = await bloquearOperativo(id, transaction);
    exigirVigente(operativo, "editar");
    await exigirReferencia(Zona, datos.zona_id, "zona_id", "La zona seleccionada no existe", transaction);

    const cambiaFechaHorario =
      operativo.fecha !== datos.fecha ||
      horaCorta(operativo.hora_inicio) !== datos.hora_inicio ||
      horaCorta(operativo.hora_fin) !== datos.hora_fin;
    const cambiaLugar = operativo.lugar !== datos.lugar || operativo.zona_id !== datos.zona_id;

    if (cambiaFechaHorario) {
      if (operativo.estado !== "programado") {
        throw new ReglaNegocioError("La fecha y el horario solo se pueden cambiar en operativos programados");
      }
      exigirInicioFuturo(datos.fecha, datos.hora_inicio);
    }

    const ocupados = await Turno.count({
      where: { operativo_id: id, estado: { [Op.in]: ESTADOS_TURNO_CON_CUPO } },
      transaction,
    });
    if (datos.cupo_maximo < ocupados) {
      throw new ValidacionError("Revise los datos ingresados", {
        cupo_maximo: `No puede ser menor a los ${ocupados} turnos ya asignados`,
      });
    }

    const activos = await Turno.findAll({
      attributes: ["id", "horario"],
      where: { operativo_id: id, estado: { [Op.in]: ESTADOS_TURNO_ACTIVOS } },
      transaction,
    });
    const fuera = activos.filter(
      (turno) => horaCorta(turno.horario) < datos.hora_inicio || horaCorta(turno.horario) >= datos.hora_fin,
    ).length;
    if (fuera > 0) {
      throw new ReglaNegocioError(
        `${fuera} ${fuera === 1 ? "turno quedaría" : "turnos quedarían"} fuera del nuevo horario: reprográmelos antes de cambiarlo`,
      );
    }

    if (cambiaFechaHorario) {
      const asignados = await OperativoVeterinario.findAll({ where: { operativo_id: id }, transaction });
      await verificarSinSuperposicion(
        { id, ...datos },
        asignados.map((asignacion) => asignacion.veterinario_id),
        transaction,
      );
    }

    await operativo.update(aAtributos(datos), { transaction });

    if (cambiaFechaHorario || cambiaLugar) {
      const ids = activos.map((turno) => turno.id);
      await anularRecordatorios(ids, transaction);
      for (const turnoId of ids) {
        const notificable = await cargarTurnoNotificable(turnoId, transaction);
        await notificar(notificable, "reprogramacion", transaction);
        await programarRecordatorio(notificable, transaction);
      }
    }
    return obtenerDetalle(id, transaction);
  });
}

/** Asigna un integrante activo del personal, sin superposición horaria con otro operativo. */
export async function asignarPersonal(id: number, datos: DatosPersonalOperativo): Promise<OperativoDetalleDto> {
  return sequelize.transaction(async (transaction) => {
    const operativo = await bloquearOperativo(id, transaction);
    exigirVigente(operativo, "modificar el personal de");
    const persona = await exigirReferencia(
      Veterinario, datos.veterinario_id, "veterinario_id", "El integrante seleccionado no existe", transaction,
    );
    if (!persona.activo) {
      throw new ValidacionError("Revise los datos ingresados", { veterinario_id: "Solo se puede asignar personal activo" });
    }
    const yaAsignado = await OperativoVeterinario.count({
      where: { operativo_id: id, veterinario_id: persona.id },
      transaction,
    });
    if (yaAsignado > 0) {
      throw new ValidacionError("Revise los datos ingresados", { veterinario_id: "Ya está asignado a este operativo" });
    }
    await verificarSinSuperposicion(operativo, [persona.id], transaction);
    await OperativoVeterinario.create({ operativo_id: id, veterinario_id: persona.id }, { transaction });
    return obtenerDetalle(id, transaction);
  });
}

/** Quita a un integrante del personal de un operativo vigente. */
export async function quitarPersonal(id: number, datos: DatosPersonalOperativo): Promise<OperativoDetalleDto> {
  return sequelize.transaction(async (transaction) => {
    const operativo = await bloquearOperativo(id, transaction);
    exigirVigente(operativo, "modificar el personal de");
    const quitados = await OperativoVeterinario.destroy({
      where: { operativo_id: id, veterinario_id: datos.veterinario_id },
      transaction,
    });
    if (quitados === 0) {
      throw new NoEncontradoError("El integrante no está asignado a este operativo");
    }
    return obtenerDetalle(id, transaction);
  });
}

/**
 * Cancelación (F4, solo administrador). Requiere 48 h de anticipación al inicio; con
 * "fuerza mayor" alcanza con que no haya comenzado. En la misma transacción: estado,
 * fecha y usuario de la cancelación; turnos activos cancelados; recordatorios anulados;
 * aviso de cancelación (con el motivo) a cada vecino con correo.
 */
export async function cancelarOperativo(
  id: number,
  datos: DatosCancelarOperativo,
  usuarioId: number,
): Promise<ResultadoCambioEstado> {
  return sequelize.transaction(async (transaction) => {
    const operativo = await bloquearOperativo(id, transaction);
    if (operativo.estado === "cancelado") {
      throw new ReglaNegocioError("El operativo ya está cancelado");
    }
    if (operativo.estado !== "programado") {
      throw new ReglaNegocioError(`No se puede cancelar un operativo ${estadoEnTexto(operativo.estado)}`);
    }

    const ahora = new Date();
    const inicio = instanteLocal(operativo.fecha, operativo.hora_inicio);
    if (datos.fuerza_mayor) {
      if (inicio <= ahora) {
        throw new ReglaNegocioError("El operativo ya comenzó: no se puede cancelar");
      }
    } else if (inicio.getTime() - ahora.getTime() < HORAS_MINIMAS_CANCELACION * MS_POR_HORA) {
      throw new ReglaNegocioError(
        `Faltan menos de ${HORAS_MINIMAS_CANCELACION} h para el inicio: solo se puede cancelar por fuerza mayor ` +
          "(marque la casilla y justifíquela en el motivo)",
      );
    }

    await operativo.update(
      { estado: "cancelado", motivo_cancelacion: datos.motivo, fecha_cancelacion: ahora, usuario_cancelacion_id: usuarioId },
      { transaction },
    );
    const ids = await cancelarTurnosActivos(id, MOTIVOS_CANCELACION.operativoCancelado, transaction);
    for (const turnoId of ids) {
      const notificable = await cargarTurnoNotificable(turnoId, transaction);
      await notificar(notificable, "cancelacion", transaction, datos.motivo);
    }
    return { turnosCancelados: ids.length };
  });
}

/**
 * Cambio de estado manual: programado → en curso (solo el día del operativo) y
 * en curso → realizado (los turnos que siguen activos se cancelan con "No se presentó").
 */
export async function cambiarEstadoOperativo(id: number, datos: DatosEstadoOperativo): Promise<ResultadoCambioEstado> {
  return sequelize.transaction(async (transaction) => {
    const operativo = await bloquearOperativo(id, transaction);

    if (datos.estado === "en_curso") {
      if (operativo.estado !== "programado") {
        throw new ReglaNegocioError("Solo se puede iniciar un operativo programado");
      }
      if (operativo.fecha !== hoyLocal()) {
        throw new ReglaNegocioError(`El operativo solo se puede iniciar el día programado (${formatearFecha(operativo.fecha)})`);
      }
      await operativo.update({ estado: "en_curso" }, { transaction });
      return { turnosCancelados: 0 };
    }

    if (operativo.estado !== "en_curso") {
      throw new ReglaNegocioError("Solo se puede finalizar un operativo en curso");
    }
    await operativo.update({ estado: "realizado" }, { transaction });
    const ids = await cancelarTurnosActivos(id, MOTIVOS_CANCELACION.noSePresento, transaction);
    return { turnosCancelados: ids.length };
  });
}
```

- [ ] **Step 4: `src/services/animales.ts` — opciones para turnos**

4a. Agregar `Opcion` al import de tipos de `@/schemas/comun` (la línea queda):

```ts
import type { Opcion, ResultadoPaginado } from "@/schemas/comun";
```

4b. Agregar al import de `@/lib/etiquetas` (crear la línea si no existe):

```ts
import { ETIQUETAS_CONDICION, nombreAnimal } from "@/lib/etiquetas";
```

4c. Agregar debajo de `listarAnimales`:

```ts

/**
 * Animales que pueden pedir turno (F3): callejeros/asilvestrados y los que tienen tutor
 * activo. La etiqueta muestra el tutor para distinguir animales con el mismo nombre.
 */
export async function opcionesAnimales(): Promise<Opcion[]> {
  const animales = await Animal.findAll({
    attributes: ["id", "nombre", "condicion"],
    include: [{ association: "vecino", attributes: ["id", "nombre", "apellido", "activo"], required: false }],
    where: { [Op.or]: [{ vecino_id: null }, { "$vecino.activo$": true }] },
    order: [["nombre", "ASC"], ["id", "ASC"]],
  });
  return animales.map((animal) => ({
    id: animal.id,
    etiqueta: `${nombreAnimal(animal)} (#${animal.id}) · ${
      animal.vecino ? `Tutor: ${animal.vecino.apellido}, ${animal.vecino.nombre}` : ETIQUETAS_CONDICION[animal.condicion]
    }`,
  }));
}
```

(Si `ETIQUETAS_CONDICION` ya estaba importado en el archivo, no duplicar el import: solo agregar `nombreAnimal`.)

- [ ] **Step 5: `src/services/personal.ts` — opciones para asignar a operativos**

5a. Agregar el import:

```ts
import { ETIQUETAS_TIPO_PERSONAL } from "@/lib/etiquetas";
```

5b. Agregar debajo de `opcionesUsuariosVinculables`:

```ts

/** Personal activo, para asignar a operativos (F4). */
export async function opcionesPersonal(): Promise<Opcion[]> {
  const personal = await Veterinario.findAll({
    attributes: ["id", "nombre", "apellido", "tipo", "matricula"],
    where: { activo: true },
    order: [["apellido", "ASC"], ["nombre", "ASC"]],
  });
  return personal.map((persona) => ({
    id: persona.id,
    etiqueta: `${persona.apellido}, ${persona.nombre} (${ETIQUETAS_TIPO_PERSONAL[persona.tipo]}${
      persona.matricula ? ` · Mat. ${persona.matricula}` : ""
    })`,
  }));
}
```

- [ ] **Step 6: Correr y verificar que pasa**

Run: `npx vitest run tests/services/operativos.test.ts`
Expected: PASS (16 tests).

- [ ] **Step 7: Correr toda la suite**

Run: `npm test`
Expected: PASS (75 tests previos + 6 + 5 + 16 + 16 = 118).

---

### Task 7: API REST

**Files:** (todos nuevos)
- `src/app/api/operativos/route.ts`, `src/app/api/operativos/opciones/route.ts`, `src/app/api/operativos/[id]/route.ts`, `src/app/api/operativos/[id]/personal/route.ts`, `src/app/api/operativos/[id]/cancelar/route.ts`, `src/app/api/operativos/[id]/estado/route.ts`
- `src/app/api/turnos/route.ts`, `src/app/api/turnos/[id]/confirmar/route.ts`, `src/app/api/turnos/[id]/reprogramar/route.ts`, `src/app/api/turnos/[id]/cancelar/route.ts`
- `src/app/api/notificaciones/route.ts`, `src/app/api/notificaciones/procesar/route.ts`, `src/app/api/notificaciones/[id]/reintentar/route.ts`
- `src/app/api/animales/opciones/route.ts`, `src/app/api/personal/opciones/route.ts`

- [ ] **Step 1: `src/app/api/operativos/route.ts`**

```ts
import { NextResponse } from "next/server";
import { leerCuerpo, leerParametros, manejarApi } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { esquemaListadoOperativos, esquemaOperativo } from "@/schemas/operativos";
import { crearOperativo, listarOperativos } from "@/services/operativos";

/** GET /api/operativos?pagina=&tamanio=&busqueda=&periodo=&estado=&zona_id= — listado (todos los roles). */
export const GET = manejarApi(async (request) => {
  await requerirSesion("operativos:ver");
  return NextResponse.json(await listarOperativos(leerParametros(request, esquemaListadoOperativos)));
});

/** POST /api/operativos — alta (administrador y operador). */
export const POST = manejarApi(async (request) => {
  await requerirSesion("operativos:gestionar");
  const datos = await leerCuerpo(request, esquemaOperativo);
  return NextResponse.json(await crearOperativo(datos), { status: 201 });
});
```

- [ ] **Step 2: `src/app/api/operativos/opciones/route.ts`**

```ts
import { NextResponse } from "next/server";
import { manejarApi } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { opcionesOperativos } from "@/services/operativos";

/** GET /api/operativos/opciones — operativos que admiten turnos, para listas desplegables. */
export const GET = manejarApi(async () => {
  await requerirSesion("turnos:ver");
  return NextResponse.json(await opcionesOperativos());
});
```

- [ ] **Step 3: `src/app/api/operativos/[id]/route.ts`**

```ts
import { NextResponse } from "next/server";
import { leerCuerpo, leerId, manejarApi, type ContextoId } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { esquemaOperativo } from "@/schemas/operativos";
import { actualizarOperativo, obtenerOperativo } from "@/services/operativos";

/** GET /api/operativos/:id — detalle con cupo y personal asignado. */
export const GET = manejarApi<ContextoId>(async (_request, { params }) => {
  await requerirSesion("operativos:ver");
  return NextResponse.json(await obtenerOperativo(await leerId(params)));
});

/** PUT /api/operativos/:id — edición; avisa a los turnos activos si cambian fecha, horario o lugar. */
export const PUT = manejarApi<ContextoId>(async (request, { params }) => {
  await requerirSesion("operativos:gestionar");
  const id = await leerId(params);
  const datos = await leerCuerpo(request, esquemaOperativo);
  return NextResponse.json(await actualizarOperativo(id, datos));
});
```

- [ ] **Step 4: `src/app/api/operativos/[id]/personal/route.ts`**

```ts
import { NextResponse } from "next/server";
import { leerCuerpo, leerId, manejarApi, type ContextoId } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { esquemaPersonalOperativo } from "@/schemas/operativos";
import { asignarPersonal, quitarPersonal } from "@/services/operativos";

/** POST /api/operativos/:id/personal — asigna un integrante ({ veterinario_id }). Devuelve el detalle. */
export const POST = manejarApi<ContextoId>(async (request, { params }) => {
  await requerirSesion("operativos:gestionar");
  const id = await leerId(params);
  const datos = await leerCuerpo(request, esquemaPersonalOperativo);
  return NextResponse.json(await asignarPersonal(id, datos));
});

/** DELETE /api/operativos/:id/personal — quita un integrante ({ veterinario_id }). Devuelve el detalle. */
export const DELETE = manejarApi<ContextoId>(async (request, { params }) => {
  await requerirSesion("operativos:gestionar");
  const id = await leerId(params);
  const datos = await leerCuerpo(request, esquemaPersonalOperativo);
  return NextResponse.json(await quitarPersonal(id, datos));
});
```

- [ ] **Step 5: `src/app/api/operativos/[id]/cancelar/route.ts`**

```ts
import { NextResponse } from "next/server";
import { leerCuerpo, leerId, manejarApi, type ContextoId } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { esquemaCancelarOperativo } from "@/schemas/operativos";
import { cancelarOperativo } from "@/services/operativos";

/** POST /api/operativos/:id/cancelar — solo administrador; registra al usuario en sesión. */
export const POST = manejarApi<ContextoId>(async (request, { params }) => {
  const sesion = await requerirSesion("operativos:cancelar");
  const id = await leerId(params);
  const datos = await leerCuerpo(request, esquemaCancelarOperativo);
  return NextResponse.json(await cancelarOperativo(id, datos, sesion.usuarioId));
});
```

- [ ] **Step 6: `src/app/api/operativos/[id]/estado/route.ts`**

```ts
import { NextResponse } from "next/server";
import { leerCuerpo, leerId, manejarApi, type ContextoId } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { esquemaEstadoOperativo } from "@/schemas/operativos";
import { cambiarEstadoOperativo } from "@/services/operativos";

/** POST /api/operativos/:id/estado — iniciar ({ estado: "en_curso" }) o finalizar ({ estado: "realizado" }). */
export const POST = manejarApi<ContextoId>(async (request, { params }) => {
  await requerirSesion("operativos:gestionar");
  const id = await leerId(params);
  const datos = await leerCuerpo(request, esquemaEstadoOperativo);
  return NextResponse.json(await cambiarEstadoOperativo(id, datos));
});
```

- [ ] **Step 7: `src/app/api/turnos/route.ts`**

```ts
import { NextResponse } from "next/server";
import { leerCuerpo, leerParametros, manejarApi } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { esquemaListadoTurnos, esquemaSolicitarTurno } from "@/schemas/turnos";
import { listarTurnos, solicitarTurno } from "@/services/turnos";

/** GET /api/turnos?pagina=&tamanio=&busqueda=&estado=&operativo_id= — listado (todos los roles). */
export const GET = manejarApi(async (request) => {
  await requerirSesion("turnos:ver");
  return NextResponse.json(await listarTurnos(leerParametros(request, esquemaListadoTurnos)));
});

/** POST /api/turnos — solicitud de turno (queda pendiente). */
export const POST = manejarApi(async (request) => {
  await requerirSesion("turnos:gestionar");
  const datos = await leerCuerpo(request, esquemaSolicitarTurno);
  return NextResponse.json(await solicitarTurno(datos), { status: 201 });
});
```

- [ ] **Step 8: `src/app/api/turnos/[id]/confirmar/route.ts`**

```ts
import { NextResponse } from "next/server";
import { leerId, manejarApi, type ContextoId } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { confirmarTurno } from "@/services/turnos";

/** POST /api/turnos/:id/confirmar — confirma un turno pendiente (aviso + recordatorio). */
export const POST = manejarApi<ContextoId>(async (_request, { params }) => {
  await requerirSesion("turnos:gestionar");
  return NextResponse.json(await confirmarTurno(await leerId(params)));
});
```

- [ ] **Step 9: `src/app/api/turnos/[id]/reprogramar/route.ts`**

```ts
import { NextResponse } from "next/server";
import { leerCuerpo, leerId, manejarApi, type ContextoId } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { esquemaReprogramarTurno } from "@/schemas/turnos";
import { reprogramarTurno } from "@/services/turnos";

/** POST /api/turnos/:id/reprogramar — nuevo operativo y/o horario ({ operativo_id, horario }). */
export const POST = manejarApi<ContextoId>(async (request, { params }) => {
  await requerirSesion("turnos:gestionar");
  const id = await leerId(params);
  const datos = await leerCuerpo(request, esquemaReprogramarTurno);
  return NextResponse.json(await reprogramarTurno(id, datos));
});
```

- [ ] **Step 10: `src/app/api/turnos/[id]/cancelar/route.ts`**

```ts
import { NextResponse } from "next/server";
import { leerCuerpo, leerId, manejarApi, type ContextoId } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { esquemaCancelarTurno } from "@/schemas/turnos";
import { cancelarTurno } from "@/services/turnos";

/** POST /api/turnos/:id/cancelar — cancela un turno activo ({ motivo }). */
export const POST = manejarApi<ContextoId>(async (request, { params }) => {
  await requerirSesion("turnos:gestionar");
  const id = await leerId(params);
  const datos = await leerCuerpo(request, esquemaCancelarTurno);
  return NextResponse.json(await cancelarTurno(id, datos));
});
```

- [ ] **Step 11: `src/app/api/notificaciones/route.ts`**

```ts
import { NextResponse } from "next/server";
import { leerParametros, manejarApi } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { esquemaListadoNotificaciones } from "@/schemas/notificaciones";
import { listarNotificaciones } from "@/services/notificaciones";

/** GET /api/notificaciones?pagina=&tamanio=&busqueda=&tipo=&estado=&desde=&hasta= — administrador y operador. */
export const GET = manejarApi(async (request) => {
  await requerirSesion("notificaciones:ver");
  return NextResponse.json(await listarNotificaciones(leerParametros(request, esquemaListadoNotificaciones)));
});
```

- [ ] **Step 12: `src/app/api/notificaciones/procesar/route.ts`**

```ts
import { NextResponse } from "next/server";
import { manejarApi } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { procesarPendientes } from "@/services/notificaciones";

/**
 * POST /api/notificaciones/procesar — envía las notificaciones pendientes vencidas.
 * Lo usa el botón "Procesar pendientes" (sesión con permiso de gestión) o un programador
 * externo con el encabezado `Authorization: Bearer <CRON_SECRET>`.
 */
export const POST = manejarApi(async (request) => {
  const secreto = process.env.CRON_SECRET;
  const autorizadoPorSecreto = Boolean(secreto) && request.headers.get("authorization") === `Bearer ${secreto}`;
  if (!autorizadoPorSecreto) {
    await requerirSesion("notificaciones:gestionar");
  }
  return NextResponse.json(await procesarPendientes());
});
```

- [ ] **Step 13: `src/app/api/notificaciones/[id]/reintentar/route.ts`**

```ts
import { NextResponse } from "next/server";
import { leerId, manejarApi, type ContextoId } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { reintentarNotificacion } from "@/services/notificaciones";

/** POST /api/notificaciones/:id/reintentar — vuelve a poner en cola una notificación fallida (204). */
export const POST = manejarApi<ContextoId>(async (_request, { params }) => {
  await requerirSesion("notificaciones:gestionar");
  await reintentarNotificacion(await leerId(params));
  return new NextResponse(null, { status: 204 });
});
```

- [ ] **Step 14: `src/app/api/animales/opciones/route.ts`**

```ts
import { NextResponse } from "next/server";
import { manejarApi } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { opcionesAnimales } from "@/services/animales";

/** GET /api/animales/opciones — animales que pueden pedir turno (sin tutor o con tutor activo). */
export const GET = manejarApi(async () => {
  await requerirSesion("animales:ver");
  return NextResponse.json(await opcionesAnimales());
});
```

- [ ] **Step 15: `src/app/api/personal/opciones/route.ts`**

```ts
import { NextResponse } from "next/server";
import { manejarApi } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { opcionesPersonal } from "@/services/personal";

/** GET /api/personal/opciones — personal activo para asignar a operativos. */
export const GET = manejarApi(async () => {
  await requerirSesion("personal:ver");
  return NextResponse.json(await opcionesPersonal());
});
```

- [ ] **Step 16: Verificar**

Run: `npx tsc --noEmit`
Expected: sin errores.

---

### Task 8: Navegación y componentes comunes

**Files:**
- Modify: `src/lib/navegacion.ts`, `src/components/comunes/formulario-dialogo.tsx`
- Create: `src/components/comunes/badges-dominio.tsx`

- [ ] **Step 1: `src/lib/navegacion.ts` — reemplazar el archivo completo**

```ts
import {
  CalendarClock, CalendarDays, LayoutDashboard, Mail, MapPin, Package, PawPrint, Stethoscope, UserCog, Users,
  type LucideIcon,
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
  { titulo: "Personal", href: "/personal", icono: Stethoscope, accion: "personal:ver" },
  { titulo: "Insumos", href: "/insumos", icono: Package, accion: "insumos:ver" },
  { titulo: "Notificaciones", href: "/notificaciones", icono: Mail, accion: "notificaciones:ver" },
  { titulo: "Zonas", href: "/zonas", icono: MapPin, accion: "zonas:ver" },
  { titulo: "Usuarios", href: "/usuarios", icono: UserCog, accion: "usuarios:gestionar" },
];
```

- [ ] **Step 2: `src/components/comunes/formulario-dialogo.tsx` — texto del botón principal configurable**

2a. En la desestructuración de props, agregar `textoEnviar` después de `amplio`:

```tsx
export function FormularioDialogo({ titulo, descripcion, idFormulario, enviando, amplio, textoEnviar, onCerrar, children }: {
```

2b. En el tipo de props, debajo de `amplio?: boolean;`, agregar:

```tsx
  /** Texto del botón principal cuando no es "Guardar" (ej.: "Cancelar turno"). El de cierre pasa a "Volver". */
  textoEnviar?: string;
```

2c. Reemplazar el `<DialogFooter>` completo por:

```tsx
        <DialogFooter>
          {/* Con una acción distinta de "Guardar", el botón de cierre dice "Volver" para no confundir con "Cancelar …". */}
          <Button variant="outline" onClick={onCerrar} disabled={enviando}>{textoEnviar ? "Volver" : "Cancelar"}</Button>
          <Button type="submit" form={idFormulario} disabled={enviando}>
            {enviando ? (textoEnviar ? "Procesando…" : "Guardando…") : (textoEnviar ?? "Guardar")}
          </Button>
        </DialogFooter>
```

- [ ] **Step 3: `src/components/comunes/badges-dominio.tsx`**

```tsx
import type { EstadoEnvio, EstadoOperativo, EstadoTurno } from "@/lib/constantes";
import { ETIQUETAS_ESTADO_ENVIO, ETIQUETAS_ESTADO_OPERATIVO, ETIQUETAS_ESTADO_TURNO } from "@/lib/etiquetas";
import { BadgeEstado, type TonoEstado } from "./badge-estado";

/** Color de cada estado de operativo, turno y envío (spec §6: badges de color por estado). */
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
```

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit`
Expected: sin errores.

---

### Task 9: Pantalla de operativos (listado y formulario)

**Files:**
- Create: `src/components/operativos/formulario-operativo.tsx`, `src/components/operativos/gestion-operativos.tsx`, `src/app/(panel)/operativos/page.tsx`

- [ ] **Step 1: `src/components/operativos/formulario-operativo.tsx`**

```tsx
"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { CampoFormulario } from "@/components/comunes/campo-formulario";
import { FormularioDialogo } from "@/components/comunes/formulario-dialogo";
import { SelectOpciones } from "@/components/comunes/select-opciones";
import { Input } from "@/components/ui/input";
import { llamarApi } from "@/lib/cliente-api";
import { mostrarErrorFormulario } from "@/lib/formularios";
import { esquemaOperativo, type DatosOperativo } from "@/schemas/operativos";
import type { OperativoDto } from "@/services/operativos";

/** Valores del formulario: franja 09:00–13:00 y cupo 20 para un alta; los del operativo para edición. */
function valoresIniciales(operativo: OperativoDto | null): DatosOperativo {
  return {
    fecha: operativo?.fecha ?? "",
    hora_inicio: operativo?.hora_inicio ?? "09:00",
    hora_fin: operativo?.hora_fin ?? "13:00",
    lugar: operativo?.lugar ?? "",
    cupo_maximo: operativo?.cupo_maximo ?? 20,
    // null hasta que se elige una zona (el esquema responde "Seleccione una zona").
    zona_id: operativo?.zona_id ?? (null as unknown as number),
  };
}

/** Diálogo de alta/edición de operativo (F4). */
export function FormularioOperativo({ operativo, onCerrar, onGuardado }: {
  operativo: OperativoDto | null;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const { register, control, handleSubmit, setError, formState } = useForm<DatosOperativo>({
    resolver: zodResolver(esquemaOperativo),
    defaultValues: valoresIniciales(operativo),
  });

  async function guardar(datos: DatosOperativo) {
    try {
      await llamarApi(operativo ? `/api/operativos/${operativo.id}` : "/api/operativos", {
        metodo: operativo ? "PUT" : "POST",
        cuerpo: datos,
      });
      toast.success(operativo ? "Operativo actualizado" : "Operativo creado");
      onGuardado();
    } catch (error) {
      mostrarErrorFormulario(error, setError, "No se pudo guardar el operativo");
    }
  }

  const errores = formState.errors;
  return (
    <FormularioDialogo
      titulo={operativo ? "Editar operativo" : "Nuevo operativo"}
      descripcion={
        operativo
          ? "Si cambia la fecha, el horario o el lugar, se avisa por correo a los vecinos con turno."
          : "La fecha y hora de inicio deben ser futuras."
      }
      idFormulario="formulario-operativo"
      enviando={formState.isSubmitting}
      amplio
      onCerrar={onCerrar}
    >
      <form id="formulario-operativo" onSubmit={handleSubmit(guardar)} className="grid gap-4 sm:grid-cols-2" noValidate>
        <CampoFormulario id="fecha" etiqueta="Fecha" error={errores.fecha?.message}>
          <Input id="fecha" type="date" {...register("fecha")} />
        </CampoFormulario>
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
        <CampoFormulario id="hora_inicio" etiqueta="Hora de inicio" error={errores.hora_inicio?.message}>
          <Input id="hora_inicio" type="time" {...register("hora_inicio")} />
        </CampoFormulario>
        <CampoFormulario id="hora_fin" etiqueta="Hora de fin" error={errores.hora_fin?.message}>
          <Input id="hora_fin" type="time" {...register("hora_fin")} />
        </CampoFormulario>
        <CampoFormulario id="lugar" etiqueta="Lugar" error={errores.lugar?.message}>
          <Input id="lugar" placeholder="SUM, centro vecinal, escuela…" {...register("lugar")} />
        </CampoFormulario>
        <CampoFormulario id="cupo_maximo" etiqueta="Cupo máximo de turnos" error={errores.cupo_maximo?.message}>
          <Input id="cupo_maximo" type="number" min={1} {...register("cupo_maximo", { valueAsNumber: true })} />
        </CampoFormulario>
      </form>
    </FormularioDialogo>
  );
}
```

- [ ] **Step 2: `src/components/operativos/gestion-operativos.tsx`**

```tsx
"use client";

import Link from "next/link";
import { Eye, Plus } from "lucide-react";
import { AccionesFila } from "@/components/comunes/acciones-fila";
import { BadgeOperativo } from "@/components/comunes/badges-dominio";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FiltroSelect } from "@/components/comunes/filtro-select";
import { ListadoPaginado } from "@/components/comunes/listado-paginado";
import type { Columna } from "@/components/comunes/tabla-datos";
import { Button, buttonVariants } from "@/components/ui/button";
import { useEdicion } from "@/hooks/use-edicion";
import { useListado } from "@/hooks/use-listado";
import type { EstadoOperativo } from "@/lib/constantes";
import { ETIQUETAS_ESTADO_OPERATIVO, opcionesDeEtiquetas, type OpcionTexto } from "@/lib/etiquetas";
import { formatearFecha } from "@/lib/fechas";
import type { OperativoDto } from "@/services/operativos";
import { FormularioOperativo } from "./formulario-operativo";

const OPCIONES_PERIODO: OpcionTexto[] = [
  { valor: "proximos", etiqueta: "Próximos" },
  { valor: "pasados", etiqueta: "Pasados" },
  { valor: "todos", etiqueta: "Todos" },
];

/** Un operativo admite cambios mientras está programado o en curso. */
export function esVigente(estado: EstadoOperativo): boolean {
  return estado === "programado" || estado === "en_curso";
}

/** Cupo en texto: ocupados sobre el máximo y lugares libres. */
export function textoCupo(operativo: OperativoDto): string {
  return `${operativo.ocupados}/${operativo.cupo_maximo} (${operativo.disponibles} libres)`;
}

/** Pantalla de F4: listado de operativos con cupo disponible, alta y edición. La fecha abre el detalle. */
export function GestionOperativos({ puedeGestionar }: { puedeGestionar: boolean }) {
  const listado = useListado<OperativoDto>("/api/operativos", { periodo: "proximos", estado: "" });
  const edicion = useEdicion<OperativoDto>();

  const columnas: Columna<OperativoDto>[] = [
    {
      titulo: "Fecha",
      celda: (o) => (
        <Link href={`/operativos/${o.id}`} className="font-medium underline-offset-4 hover:underline">
          {formatearFecha(o.fecha)}
        </Link>
      ),
    },
    { titulo: "Horario", celda: (o) => `${o.hora_inicio} a ${o.hora_fin}` },
    { titulo: "Zona", celda: (o) => o.zona },
    { titulo: "Lugar", celda: (o) => o.lugar },
    { titulo: "Cupo", celda: textoCupo },
    { titulo: "Estado", celda: (o) => <BadgeOperativo estado={o.estado} /> },
    {
      titulo: "Acciones",
      className: "w-28 text-right",
      celda: (o) => (
        <AccionesFila onEditar={puedeGestionar && esVigente(o.estado) ? () => edicion.abrirEdicion(o) : undefined}>
          <Link
            href={`/operativos/${o.id}`}
            className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
            aria-label="Ver detalle"
            title="Ver detalle"
          >
            <Eye />
          </Link>
        </AccionesFila>
      ),
    },
  ];

  return (
    <>
      <EncabezadoPagina
        titulo="Operativos"
        descripcion="Jornadas de castración y chipeo por zona, con su cupo de turnos."
        acciones={puedeGestionar && <Button onClick={edicion.abrirAlta}><Plus /> Nuevo operativo</Button>}
      />
      <ListadoPaginado
        listado={listado}
        columnas={columnas}
        claveFila={(o) => o.id}
        placeholderBusqueda="Buscar por lugar o zona"
        filtros={
          <>
            <FiltroSelect
              etiqueta="Período"
              valor={listado.filtros.periodo}
              opciones={OPCIONES_PERIODO}
              onCambiar={(valor) => listado.filtrar("periodo", valor)}
            />
            <FiltroSelect
              etiqueta="Estado"
              valor={listado.filtros.estado}
              opciones={opcionesDeEtiquetas(ETIQUETAS_ESTADO_OPERATIVO)}
              etiquetaTodos="Todos los estados"
              onCambiar={(valor) => listado.filtrar("estado", valor)}
            />
          </>
        }
      />

      {edicion.formulario && (
        <FormularioOperativo
          operativo={edicion.formulario.registro}
          onCerrar={edicion.cerrarFormulario}
          onGuardado={async () => {
            edicion.cerrarFormulario();
            await listado.recargar();
          }}
        />
      )}
    </>
  );
}
```

- [ ] **Step 3: `src/app/(panel)/operativos/page.tsx`**

```tsx
import { GestionOperativos } from "@/components/operativos/gestion-operativos";
import { tienePermiso } from "@/lib/permisos";
import { exigirPermisoPagina } from "@/lib/sesion";

/** F4 — Operativos (gestión: administrador y operador; consulta: veterinario). */
export default async function PaginaOperativos() {
  const sesion = await exigirPermisoPagina("operativos:ver");
  return <GestionOperativos puedeGestionar={tienePermiso(sesion.rol, "operativos:gestionar")} />;
}
```

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit`
Expected: sin errores.

---

### Task 10: Pantalla de turnos (listado reutilizable y formularios)

**Files:**
- Create: `src/components/turnos/formulario-turno.tsx`, `src/components/turnos/formulario-reprogramar.tsx`, `src/components/turnos/formulario-cancelar-turno.tsx`, `src/components/turnos/listado-turnos.tsx`, `src/app/(panel)/turnos/page.tsx`

- [ ] **Step 1: `src/components/turnos/formulario-turno.tsx`**

```tsx
"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { CampoFormulario } from "@/components/comunes/campo-formulario";
import { FormularioDialogo } from "@/components/comunes/formulario-dialogo";
import { SelectOpciones } from "@/components/comunes/select-opciones";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { llamarApi } from "@/lib/cliente-api";
import { TIPOS_PROCEDIMIENTO } from "@/lib/constantes";
import { ETIQUETAS_TIPO_PROCEDIMIENTO } from "@/lib/etiquetas";
import { mostrarErrorFormulario } from "@/lib/formularios";
import { esquemaSolicitarTurno, type DatosSolicitarTurno } from "@/schemas/turnos";

/** Diálogo de solicitud de turno (F3). Desde el detalle de un operativo, llega preseleccionado. */
export function FormularioTurno({ operativoId, onCerrar, onGuardado }: {
  operativoId?: number;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const { register, control, handleSubmit, setError, formState } = useForm<DatosSolicitarTurno>({
    resolver: zodResolver(esquemaSolicitarTurno),
    defaultValues: {
      // null hasta que se elige (el esquema responde "Seleccione …").
      animal_id: null as unknown as number,
      operativo_id: operativoId ?? (null as unknown as number),
      horario: "",
      tipo_solicitado: "castracion_y_chipeo",
    },
  });

  async function guardar(datos: DatosSolicitarTurno) {
    try {
      await llamarApi("/api/turnos", { metodo: "POST", cuerpo: datos });
      toast.success("Turno solicitado: queda pendiente de confirmación");
      onGuardado();
    } catch (error) {
      mostrarErrorFormulario(error, setError, "No se pudo solicitar el turno");
    }
  }

  const errores = formState.errors;
  return (
    <FormularioDialogo
      titulo="Nuevo turno"
      descripcion="Solo se listan los animales sin tutor o con tutor activo y los operativos programados."
      idFormulario="formulario-turno"
      enviando={formState.isSubmitting}
      amplio
      onCerrar={onCerrar}
    >
      <form id="formulario-turno" onSubmit={handleSubmit(guardar)} className="grid gap-4" noValidate>
        <CampoFormulario id="animal_id" etiqueta="Animal" error={errores.animal_id?.message}>
          <Controller
            control={control}
            name="animal_id"
            render={({ field }) => (
              <SelectOpciones
                id="animal_id"
                url="/api/animales/opciones"
                valor={field.value}
                onCambiar={field.onChange}
                invalido={!!errores.animal_id}
              />
            )}
          />
        </CampoFormulario>
        <CampoFormulario id="operativo_id" etiqueta="Operativo" error={errores.operativo_id?.message}>
          <Controller
            control={control}
            name="operativo_id"
            render={({ field }) => (
              <SelectOpciones
                id="operativo_id"
                url="/api/operativos/opciones"
                valor={field.value}
                onCambiar={field.onChange}
                invalido={!!errores.operativo_id}
              />
            )}
          />
        </CampoFormulario>
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoFormulario id="horario" etiqueta="Horario" error={errores.horario?.message}>
            <Input id="horario" type="time" {...register("horario")} />
          </CampoFormulario>
          <CampoFormulario id="tipo_solicitado" etiqueta="Procedimiento" error={errores.tipo_solicitado?.message}>
            <NativeSelect id="tipo_solicitado" className="w-full" {...register("tipo_solicitado")}>
              {TIPOS_PROCEDIMIENTO.map((tipo) => (
                <NativeSelectOption key={tipo} value={tipo}>{ETIQUETAS_TIPO_PROCEDIMIENTO[tipo]}</NativeSelectOption>
              ))}
            </NativeSelect>
          </CampoFormulario>
        </div>
      </form>
    </FormularioDialogo>
  );
}
```

- [ ] **Step 2: `src/components/turnos/formulario-reprogramar.tsx`**

```tsx
"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { CampoFormulario } from "@/components/comunes/campo-formulario";
import { FormularioDialogo } from "@/components/comunes/formulario-dialogo";
import { SelectOpciones } from "@/components/comunes/select-opciones";
import { Input } from "@/components/ui/input";
import { llamarApi } from "@/lib/cliente-api";
import { formatearFecha } from "@/lib/fechas";
import { mostrarErrorFormulario } from "@/lib/formularios";
import { esquemaReprogramarTurno, type DatosReprogramarTurno } from "@/schemas/turnos";
import type { TurnoDto } from "@/services/turnos";

/** Diálogo para reprogramar un turno activo: otro horario y/o otro operativo (F3). */
export function FormularioReprogramar({ turno, onCerrar, onGuardado }: {
  turno: TurnoDto;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const { register, control, handleSubmit, setError, formState } = useForm<DatosReprogramarTurno>({
    resolver: zodResolver(esquemaReprogramarTurno),
    defaultValues: { operativo_id: turno.operativo_id, horario: turno.horario },
  });

  async function guardar(datos: DatosReprogramarTurno) {
    try {
      await llamarApi(`/api/turnos/${turno.id}/reprogramar`, { metodo: "POST", cuerpo: datos });
      toast.success("Turno reprogramado. Se avisará al vecino por correo.");
      onGuardado();
    } catch (error) {
      mostrarErrorFormulario(error, setError, "No se pudo reprogramar el turno");
    }
  }

  const errores = formState.errors;
  return (
    <FormularioDialogo
      titulo={`Reprogramar turno de ${turno.animal}`}
      descripcion={`Actual: ${formatearFecha(turno.fecha)} a las ${turno.horario} en ${turno.lugar} (${turno.zona}).`}
      idFormulario="formulario-reprogramar"
      enviando={formState.isSubmitting}
      textoEnviar="Reprogramar"
      onCerrar={onCerrar}
    >
      <form id="formulario-reprogramar" onSubmit={handleSubmit(guardar)} className="grid gap-4" noValidate>
        <CampoFormulario id="operativo_id" etiqueta="Operativo" error={errores.operativo_id?.message}>
          <Controller
            control={control}
            name="operativo_id"
            render={({ field }) => (
              <SelectOpciones
                id="operativo_id"
                url="/api/operativos/opciones"
                valor={field.value}
                onCambiar={field.onChange}
                invalido={!!errores.operativo_id}
              />
            )}
          />
        </CampoFormulario>
        <CampoFormulario id="horario" etiqueta="Horario" error={errores.horario?.message}>
          <Input id="horario" type="time" {...register("horario")} />
        </CampoFormulario>
      </form>
    </FormularioDialogo>
  );
}
```

- [ ] **Step 3: `src/components/turnos/formulario-cancelar-turno.tsx`**

```tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { CampoFormulario } from "@/components/comunes/campo-formulario";
import { FormularioDialogo } from "@/components/comunes/formulario-dialogo";
import { Input } from "@/components/ui/input";
import { llamarApi } from "@/lib/cliente-api";
import { mostrarErrorFormulario } from "@/lib/formularios";
import { esquemaCancelarTurno, type DatosCancelarTurno } from "@/schemas/turnos";
import type { TurnoDto } from "@/services/turnos";

/** Diálogo de cancelación de un turno: el motivo es obligatorio y viaja en el correo al vecino. */
export function FormularioCancelarTurno({ turno, onCerrar, onGuardado }: {
  turno: TurnoDto;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const { register, handleSubmit, setError, formState } = useForm<DatosCancelarTurno>({
    resolver: zodResolver(esquemaCancelarTurno),
    defaultValues: { motivo: "" },
  });

  async function cancelar(datos: DatosCancelarTurno) {
    try {
      await llamarApi(`/api/turnos/${turno.id}/cancelar`, { metodo: "POST", cuerpo: datos });
      toast.success("Turno cancelado");
      onGuardado();
    } catch (error) {
      mostrarErrorFormulario(error, setError, "No se pudo cancelar el turno");
    }
  }

  return (
    <FormularioDialogo
      titulo={`Cancelar turno de ${turno.animal}`}
      descripcion="Se anulará el recordatorio y se avisará al vecino por correo."
      idFormulario="formulario-cancelar-turno"
      enviando={formState.isSubmitting}
      textoEnviar="Cancelar turno"
      onCerrar={onCerrar}
    >
      <form id="formulario-cancelar-turno" onSubmit={handleSubmit(cancelar)} className="grid gap-4" noValidate>
        <CampoFormulario id="motivo" etiqueta="Motivo" error={formState.errors.motivo?.message}>
          <Input id="motivo" {...register("motivo")} />
        </CampoFormulario>
      </form>
    </FormularioDialogo>
  );
}
```

- [ ] **Step 4: `src/components/turnos/listado-turnos.tsx`**

```tsx
"use client";

import { useState } from "react";
import { CalendarClock, Check, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { AccionesFila } from "@/components/comunes/acciones-fila";
import { BadgeTurno } from "@/components/comunes/badges-dominio";
import { ConfirmarDialogo } from "@/components/comunes/confirmar-dialogo";
import { FiltroSelect } from "@/components/comunes/filtro-select";
import { ListadoPaginado } from "@/components/comunes/listado-paginado";
import type { Columna } from "@/components/comunes/tabla-datos";
import { Button } from "@/components/ui/button";
import { useListado } from "@/hooks/use-listado";
import { llamarApi } from "@/lib/cliente-api";
import { esTurnoActivo } from "@/lib/constantes";
import { ETIQUETAS_ESTADO_TURNO, ETIQUETAS_TIPO_PROCEDIMIENTO, opcionesDeEtiquetas } from "@/lib/etiquetas";
import { formatearFecha } from "@/lib/fechas";
import { mensajeDeError } from "@/lib/formularios";
import type { TurnoDto } from "@/services/turnos";
import { FormularioCancelarTurno } from "./formulario-cancelar-turno";
import { FormularioReprogramar } from "./formulario-reprogramar";
import { FormularioTurno } from "./formulario-turno";

/**
 * Listado de turnos con sus acciones (F3): confirmar, reprogramar y cancelar.
 * Se usa en la página de turnos y, filtrado por `operativoId`, en el detalle de un operativo;
 * `onCambio` avisa a la pantalla contenedora para refrescar datos dependientes (ej.: el cupo).
 */
export function ListadoTurnos({ operativoId, puedeGestionar, permitirAlta = true, onCambio }: {
  operativoId?: number;
  puedeGestionar: boolean;
  /** Muestra "Nuevo turno" (en el detalle, solo si el operativo admite turnos). */
  permitirAlta?: boolean;
  onCambio?: () => void;
}) {
  const listado = useListado<TurnoDto>("/api/turnos", {
    estado: "",
    operativo_id: operativoId ? String(operativoId) : "",
  });
  const [nuevo, setNuevo] = useState(false);
  const [aConfirmar, setAConfirmar] = useState<TurnoDto | null>(null);
  const [aReprogramar, setAReprogramar] = useState<TurnoDto | null>(null);
  const [aCancelar, setACancelar] = useState<TurnoDto | null>(null);

  /** Refresca el listado y avisa a la pantalla contenedora. */
  async function actualizar() {
    await listado.recargar();
    onCambio?.();
  }

  async function confirmar() {
    if (!aConfirmar) return;
    try {
      await llamarApi(`/api/turnos/${aConfirmar.id}/confirmar`, { metodo: "POST" });
      toast.success("Turno confirmado. Se avisará al vecino por correo.");
      setAConfirmar(null);
      await actualizar();
    } catch (error) {
      toast.error(mensajeDeError(error, "No se pudo confirmar el turno"));
    }
  }

  /** Cierra un diálogo de edición y refresca. */
  function alGuardar(cerrar: () => void) {
    return async () => {
      cerrar();
      await actualizar();
    };
  }

  const columnas: Columna<TurnoDto>[] = [
    { titulo: "Fecha y hora", celda: (t) => `${formatearFecha(t.fecha)} ${t.horario}` },
    { titulo: "Animal", celda: (t) => t.animal },
    { titulo: "Tutor", celda: (t) => t.tutor ?? "Sin tutor" },
    { titulo: "Procedimiento", celda: (t) => ETIQUETAS_TIPO_PROCEDIMIENTO[t.tipo_solicitado] },
    // En el detalle de un operativo el lugar es siempre el mismo: la columna se omite.
    ...(operativoId ? [] : [{ titulo: "Lugar", celda: (t: TurnoDto) => `${t.lugar} (${t.zona})` }]),
    {
      titulo: "Estado",
      celda: (t) => (
        <span title={t.motivo_cancelacion ?? undefined}>
          <BadgeTurno estado={t.estado} />
        </span>
      ),
    },
    ...(puedeGestionar
      ? [{
          titulo: "Acciones",
          className: "w-32 text-right",
          celda: (t: TurnoDto) =>
            esTurnoActivo(t.estado) && (
              <AccionesFila>
                {t.estado === "pendiente" && (
                  <Button variant="ghost" size="icon-sm" aria-label="Confirmar" title="Confirmar" onClick={() => setAConfirmar(t)}>
                    <Check />
                  </Button>
                )}
                <Button variant="ghost" size="icon-sm" aria-label="Reprogramar" title="Reprogramar" onClick={() => setAReprogramar(t)}>
                  <CalendarClock />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label="Cancelar turno" title="Cancelar turno" onClick={() => setACancelar(t)}>
                  <X />
                </Button>
              </AccionesFila>
            ),
        }]
      : []),
  ];

  return (
    <>
      <ListadoPaginado
        listado={listado}
        columnas={columnas}
        claveFila={(t) => t.id}
        placeholderBusqueda="Buscar por animal o tutor (apellido o DNI)"
        mensajeVacio="No hay turnos para mostrar"
        filtros={
          <>
            <FiltroSelect
              etiqueta="Estado"
              valor={listado.filtros.estado}
              opciones={opcionesDeEtiquetas(ETIQUETAS_ESTADO_TURNO)}
              etiquetaTodos="Todos los estados"
              onCambiar={(valor) => listado.filtrar("estado", valor)}
            />
            {puedeGestionar && permitirAlta && (
              <Button className="ml-auto" onClick={() => setNuevo(true)}><Plus /> Nuevo turno</Button>
            )}
          </>
        }
      />

      {nuevo && (
        <FormularioTurno operativoId={operativoId} onCerrar={() => setNuevo(false)} onGuardado={alGuardar(() => setNuevo(false))} />
      )}
      {aReprogramar && (
        <FormularioReprogramar
          turno={aReprogramar}
          onCerrar={() => setAReprogramar(null)}
          onGuardado={alGuardar(() => setAReprogramar(null))}
        />
      )}
      {aCancelar && (
        <FormularioCancelarTurno
          turno={aCancelar}
          onCerrar={() => setACancelar(null)}
          onGuardado={alGuardar(() => setACancelar(null))}
        />
      )}
      <ConfirmarDialogo
        abierto={aConfirmar !== null}
        titulo="Confirmar turno"
        descripcion={`¿Confirmar el turno de ${aConfirmar?.animal}? Se enviará la confirmación por correo y un recordatorio 24 h antes.`}
        textoConfirmar="Confirmar"
        onConfirmar={confirmar}
        onCerrar={() => setAConfirmar(null)}
      />
    </>
  );
}
```

- [ ] **Step 5: `src/app/(panel)/turnos/page.tsx`**

```tsx
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { ListadoTurnos } from "@/components/turnos/listado-turnos";
import { tienePermiso } from "@/lib/permisos";
import { exigirPermisoPagina } from "@/lib/sesion";

/** F3 — Turnos (gestión: administrador y operador; consulta: veterinario). */
export default async function PaginaTurnos() {
  const sesion = await exigirPermisoPagina("turnos:ver");
  return (
    <>
      <EncabezadoPagina
        titulo="Turnos"
        descripcion="Solicitud, confirmación, reprogramación y cancelación. Los cambios se avisan al vecino por correo."
      />
      <ListadoTurnos puedeGestionar={tienePermiso(sesion.rol, "turnos:gestionar")} />
    </>
  );
}
```

- [ ] **Step 6: Verificar**

Run: `npx tsc --noEmit`
Expected: sin errores.

---

### Task 11: Detalle de operativo (personal, estado, cancelación y turnos)

**Files:**
- Create: `src/components/operativos/personal-operativo.tsx`, `src/components/operativos/formulario-cancelar-operativo.tsx`, `src/components/operativos/detalle-operativo.tsx`, `src/app/(panel)/operativos/[id]/page.tsx`

- [ ] **Step 1: `src/components/operativos/personal-operativo.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { SelectOpciones } from "@/components/comunes/select-opciones";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { llamarApi } from "@/lib/cliente-api";
import { ETIQUETAS_TIPO_PERSONAL } from "@/lib/etiquetas";
import { mensajeDeError } from "@/lib/formularios";
import type { OperativoDetalleDto } from "@/services/operativos";

/** Personal asignado a un operativo, con alta y retiro (F4). */
export function PersonalOperativo({ operativo, puedeGestionar, onCambio }: {
  operativo: OperativoDetalleDto;
  puedeGestionar: boolean;
  onCambio: () => Promise<unknown>;
}) {
  const [seleccionado, setSeleccionado] = useState<number | null>(null);
  const [procesando, setProcesando] = useState(false);

  /** Asigna (POST) o quita (DELETE) a un integrante y refresca el detalle. */
  async function modificar(metodo: "POST" | "DELETE", veterinarioId: number) {
    setProcesando(true);
    try {
      await llamarApi(`/api/operativos/${operativo.id}/personal`, { metodo, cuerpo: { veterinario_id: veterinarioId } });
      toast.success(metodo === "POST" ? "Personal asignado" : "Personal quitado");
      setSeleccionado(null);
      await onCambio();
    } catch (error) {
      toast.error(mensajeDeError(error, "No se pudo modificar el personal"));
    } finally {
      setProcesando(false);
    }
  }

  return (
    <section className="rounded-lg border p-4">
      <h2 className="mb-3 text-lg font-semibold">Personal asignado</h2>
      {operativo.personal.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin personal asignado.</p>
      ) : (
        <ul className="grid gap-2">
          {operativo.personal.map((persona) => (
            <li key={persona.id} className="flex items-center justify-between gap-2 text-sm">
              <span>
                {persona.nombre}
                <span className="text-muted-foreground">
                  {" · "}{ETIQUETAS_TIPO_PERSONAL[persona.tipo]}{persona.matricula ? ` · Mat. ${persona.matricula}` : ""}
                </span>
              </span>
              {puedeGestionar && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Quitar"
                  title="Quitar"
                  disabled={procesando}
                  onClick={() => modificar("DELETE", persona.id)}
                >
                  <X />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {puedeGestionar && (
        <div className="mt-4 flex gap-2">
          <Label htmlFor="veterinario_id" className="sr-only">Personal a asignar</Label>
          <SelectOpciones
            id="veterinario_id"
            url="/api/personal/opciones"
            valor={seleccionado}
            onCambiar={setSeleccionado}
            placeholder="Agregar personal…"
          />
          <Button
            disabled={seleccionado === null || procesando}
            onClick={() => seleccionado !== null && modificar("POST", seleccionado)}
          >
            <Plus /> Asignar
          </Button>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: `src/components/operativos/formulario-cancelar-operativo.tsx`**

```tsx
"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { CampoFormulario } from "@/components/comunes/campo-formulario";
import { FormularioDialogo } from "@/components/comunes/formulario-dialogo";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { llamarApi } from "@/lib/cliente-api";
import { mostrarErrorFormulario } from "@/lib/formularios";
import { esquemaCancelarOperativo, type DatosCancelarOperativo } from "@/schemas/operativos";
import type { OperativoDto, ResultadoCambioEstado } from "@/services/operativos";

/** Diálogo de cancelación de operativo (F4, solo administrador): motivo y casilla de fuerza mayor. */
export function FormularioCancelarOperativo({ operativo, onCerrar, onCancelado }: {
  operativo: OperativoDto;
  onCerrar: () => void;
  onCancelado: () => void;
}) {
  const { register, control, handleSubmit, setError, formState } = useForm<DatosCancelarOperativo>({
    resolver: zodResolver(esquemaCancelarOperativo),
    defaultValues: { motivo: "", fuerza_mayor: false },
  });

  async function cancelar(datos: DatosCancelarOperativo) {
    try {
      const { turnosCancelados } = await llamarApi<ResultadoCambioEstado>(`/api/operativos/${operativo.id}/cancelar`, {
        metodo: "POST",
        cuerpo: datos,
      });
      toast.success(`Operativo cancelado. Turnos cancelados: ${turnosCancelados}`);
      onCancelado();
    } catch (error) {
      mostrarErrorFormulario(error, setError, "No se pudo cancelar el operativo");
    }
  }

  return (
    <FormularioDialogo
      titulo="Cancelar operativo"
      descripcion="Se cancelarán los turnos pendientes y confirmados y se avisará por correo a los vecinos. Requiere 48 h de anticipación, salvo fuerza mayor."
      idFormulario="formulario-cancelar-operativo"
      enviando={formState.isSubmitting}
      textoEnviar="Cancelar operativo"
      onCerrar={onCerrar}
    >
      <form id="formulario-cancelar-operativo" onSubmit={handleSubmit(cancelar)} className="grid gap-4" noValidate>
        <CampoFormulario id="motivo" etiqueta="Motivo" error={formState.errors.motivo?.message}>
          <Input id="motivo" {...register("motivo")} />
        </CampoFormulario>
        <Controller
          control={control}
          name="fuerza_mayor"
          render={({ field }) => (
            <div className="flex items-start gap-2">
              <Checkbox id="fuerza_mayor" checked={field.value} onCheckedChange={(marcado) => field.onChange(marcado === true)} />
              <Label htmlFor="fuerza_mayor" className="leading-snug">
                Fuerza mayor: permite cancelar con menos de 48 h (antes del inicio). Justifíquela en el motivo.
              </Label>
            </div>
          )}
        />
      </form>
    </FormularioDialogo>
  );
}
```

- [ ] **Step 3: `src/components/operativos/detalle-operativo.tsx`**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ArrowLeft, Ban, CheckCircle2, Pencil, Play } from "lucide-react";
import { toast } from "sonner";
import { BadgeOperativo } from "@/components/comunes/badges-dominio";
import { ConfirmarDialogo } from "@/components/comunes/confirmar-dialogo";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { ListadoTurnos } from "@/components/turnos/listado-turnos";
import { Button, buttonVariants } from "@/components/ui/button";
import { llamarApi, obtenerJson } from "@/lib/cliente-api";
import { formatearFecha } from "@/lib/fechas";
import { mensajeDeError } from "@/lib/formularios";
import type { OperativoDetalleDto, ResultadoCambioEstado } from "@/services/operativos";
import { FormularioCancelarOperativo } from "./formulario-cancelar-operativo";
import { FormularioOperativo } from "./formulario-operativo";
import { esVigente, textoCupo } from "./gestion-operativos";
import { PersonalOperativo } from "./personal-operativo";

/** Detalle de un operativo (F4): datos, cupo, personal, cambios de estado, cancelación y turnos. */
export function DetalleOperativo({ id, puedeGestionar, puedeCancelar, puedeGestionarTurnos }: {
  id: number;
  puedeGestionar: boolean;
  puedeCancelar: boolean;
  puedeGestionarTurnos: boolean;
}) {
  const { data: operativo, error, mutate } = useSWR<OperativoDetalleDto>(`/api/operativos/${id}`, obtenerJson);
  const [editando, setEditando] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [nuevoEstado, setNuevoEstado] = useState<"en_curso" | "realizado" | null>(null);

  const volver = (
    <Link href="/operativos" className={buttonVariants({ variant: "outline" })}>
      <ArrowLeft /> Volver
    </Link>
  );
  if (error) return <EncabezadoPagina titulo="Operativo no encontrado" descripcion={error.message} acciones={volver} />;
  if (!operativo) return <p className="text-sm text-muted-foreground">Cargando…</p>;

  /** Inicia o finaliza el operativo, según el estado elegido en la confirmación. */
  async function cambiarEstado() {
    if (!nuevoEstado) return;
    try {
      const { turnosCancelados } = await llamarApi<ResultadoCambioEstado>(`/api/operativos/${id}/estado`, {
        metodo: "POST",
        cuerpo: { estado: nuevoEstado },
      });
      toast.success(
        nuevoEstado === "en_curso"
          ? "Operativo iniciado"
          : `Operativo finalizado. Turnos sin presentarse: ${turnosCancelados}`,
      );
      setNuevoEstado(null);
      await mutate();
    } catch (error) {
      toast.error(mensajeDeError(error, "No se pudo cambiar el estado del operativo"));
    }
  }

  const vigente = esVigente(operativo.estado);
  return (
    <>
      <EncabezadoPagina
        titulo={`Operativo del ${formatearFecha(operativo.fecha)}`}
        descripcion={`${operativo.hora_inicio} a ${operativo.hora_fin} · ${operativo.lugar} (${operativo.zona}) · Cupo: ${textoCupo(operativo)}`}
        acciones={
          <>
            {volver}
            {puedeGestionar && vigente && (
              <Button variant="outline" onClick={() => setEditando(true)}><Pencil /> Editar</Button>
            )}
            {puedeGestionar && operativo.estado === "programado" && (
              <Button onClick={() => setNuevoEstado("en_curso")}><Play /> Iniciar</Button>
            )}
            {puedeGestionar && operativo.estado === "en_curso" && (
              <Button onClick={() => setNuevoEstado("realizado")}><CheckCircle2 /> Finalizar</Button>
            )}
            {puedeCancelar && operativo.estado === "programado" && (
              <Button variant="destructive" onClick={() => setCancelando(true)}><Ban /> Cancelar</Button>
            )}
          </>
        }
      />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <BadgeOperativo estado={operativo.estado} />
        {operativo.motivo_cancelacion && (
          <span className="text-sm text-muted-foreground">Motivo de cancelación: {operativo.motivo_cancelacion}</span>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <PersonalOperativo operativo={operativo} puedeGestionar={puedeGestionar && vigente} onCambio={mutate} />
        <section>
          <h2 className="mb-3 text-lg font-semibold">Turnos</h2>
          <ListadoTurnos
            operativoId={id}
            puedeGestionar={puedeGestionarTurnos}
            permitirAlta={operativo.estado === "programado"}
            onCambio={() => void mutate()}
          />
        </section>
      </div>

      {editando && (
        <FormularioOperativo
          operativo={operativo}
          onCerrar={() => setEditando(false)}
          onGuardado={async () => {
            setEditando(false);
            await mutate();
          }}
        />
      )}
      {cancelando && (
        <FormularioCancelarOperativo
          operativo={operativo}
          onCerrar={() => setCancelando(false)}
          onCancelado={async () => {
            setCancelando(false);
            await mutate();
          }}
        />
      )}
      <ConfirmarDialogo
        abierto={nuevoEstado !== null}
        titulo={nuevoEstado === "en_curso" ? "Iniciar operativo" : "Finalizar operativo"}
        descripcion={
          nuevoEstado === "en_curso"
            ? "El operativo pasará a estar en curso (solo es posible el día programado)."
            : "El operativo pasará a realizado. Los turnos que sigan pendientes o confirmados se cancelarán con el motivo \"No se presentó\"."
        }
        textoConfirmar={nuevoEstado === "en_curso" ? "Iniciar" : "Finalizar"}
        onConfirmar={cambiarEstado}
        onCerrar={() => setNuevoEstado(null)}
      />
    </>
  );
}
```

- [ ] **Step 4: `src/app/(panel)/operativos/[id]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { DetalleOperativo } from "@/components/operativos/detalle-operativo";
import { tienePermiso } from "@/lib/permisos";
import { exigirPermisoPagina } from "@/lib/sesion";
import { esquemaId } from "@/schemas/comun";

/** F4 — Detalle de un operativo: personal, estado, cancelación (solo administrador) y turnos. */
export default async function PaginaDetalleOperativo({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await exigirPermisoPagina("operativos:ver");
  const id = esquemaId.safeParse((await params).id);
  if (!id.success) notFound();
  return (
    <DetalleOperativo
      id={id.data}
      puedeGestionar={tienePermiso(sesion.rol, "operativos:gestionar")}
      puedeCancelar={tienePermiso(sesion.rol, "operativos:cancelar")}
      puedeGestionarTurnos={tienePermiso(sesion.rol, "turnos:gestionar")}
    />
  );
}
```

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit` y `npm run lint`
Expected: tsc sin errores; lint con 0 errores (se acepta la advertencia previa de `src/lib/cliente-api.ts`).

---

### Task 12: Pantalla de notificaciones y procesador automático

**Files:**
- Create: `src/components/notificaciones/gestion-notificaciones.tsx`, `src/app/(panel)/notificaciones/page.tsx`, `src/lib/procesador-notificaciones.ts`, `src/instrumentation.ts`

- [ ] **Step 1: `src/components/notificaciones/gestion-notificaciones.tsx`**

```tsx
"use client";

import { useState } from "react";
import { RotateCcw, Send } from "lucide-react";
import { toast } from "sonner";
import { AccionesFila } from "@/components/comunes/acciones-fila";
import { BadgeEnvio } from "@/components/comunes/badges-dominio";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FiltroSelect } from "@/components/comunes/filtro-select";
import { ListadoPaginado } from "@/components/comunes/listado-paginado";
import type { Columna } from "@/components/comunes/tabla-datos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useListado } from "@/hooks/use-listado";
import { llamarApi } from "@/lib/cliente-api";
import { ETIQUETAS_ESTADO_ENVIO, ETIQUETAS_TIPO_NOTIFICACION, opcionesDeEtiquetas } from "@/lib/etiquetas";
import { formatearFechaHora } from "@/lib/fechas";
import { mensajeDeError } from "@/lib/formularios";
import type { NotificacionDto, ResultadoProcesamiento } from "@/services/notificaciones";

/** Pantalla de F12: notificaciones por correo con filtros, envío a demanda y reintento de fallidas. */
export function GestionNotificaciones({ puedeGestionar }: { puedeGestionar: boolean }) {
  const listado = useListado<NotificacionDto>("/api/notificaciones", { tipo: "", estado: "", desde: "", hasta: "" });
  const [procesando, setProcesando] = useState(false);

  /** Envía ahora las notificaciones pendientes vencidas (además del envío automático cada minuto). */
  async function procesar() {
    setProcesando(true);
    try {
      const { enviadas, fallidas } = await llamarApi<ResultadoProcesamiento>("/api/notificaciones/procesar", {
        metodo: "POST",
      });
      toast.success(`Enviadas: ${enviadas} · Fallidas: ${fallidas}`);
      await listado.recargar();
    } catch (error) {
      toast.error(mensajeDeError(error, "No se pudieron procesar las notificaciones"));
    } finally {
      setProcesando(false);
    }
  }

  async function reintentar(notificacion: NotificacionDto) {
    try {
      await llamarApi(`/api/notificaciones/${notificacion.id}/reintentar`, { metodo: "POST" });
      toast.success("La notificación volvió a la cola de envío");
      await listado.recargar();
    } catch (error) {
      toast.error(mensajeDeError(error, "No se pudo reintentar la notificación"));
    }
  }

  const columnas: Columna<NotificacionDto>[] = [
    { titulo: "Programada", celda: (n) => formatearFechaHora(n.fecha_programada) },
    { titulo: "Tipo", celda: (n) => ETIQUETAS_TIPO_NOTIFICACION[n.tipo] },
    {
      titulo: "Vecino",
      celda: (n) => (
        <div>
          <div>{n.vecino}</div>
          <div className="text-xs text-muted-foreground">{n.email ?? "Sin email"}</div>
        </div>
      ),
    },
    {
      titulo: "Mensaje",
      celda: (n) => (
        <span className="line-clamp-2 max-w-xs text-xs whitespace-normal" title={n.mensaje}>{n.mensaje}</span>
      ),
    },
    { titulo: "Estado", celda: (n) => <BadgeEnvio estado={n.estado_envio} /> },
    { titulo: "Enviada", celda: (n) => (n.fecha_envio ? formatearFechaHora(n.fecha_envio) : "—") },
    ...(puedeGestionar
      ? [{
          titulo: "Acciones",
          className: "w-20 text-right",
          celda: (n: NotificacionDto) =>
            n.estado_envio === "fallido" && (
              <AccionesFila>
                <Button variant="ghost" size="icon-sm" aria-label="Reintentar" title="Reintentar" onClick={() => reintentar(n)}>
                  <RotateCcw />
                </Button>
              </AccionesFila>
            ),
        }]
      : []),
  ];

  return (
    <>
      <EncabezadoPagina
        titulo="Notificaciones"
        descripcion="Correos a los vecinos sobre sus turnos. Las pendientes se envían automáticamente cada minuto."
        acciones={
          puedeGestionar && (
            <Button onClick={procesar} disabled={procesando}>
              <Send /> {procesando ? "Procesando…" : "Procesar pendientes"}
            </Button>
          )
        }
      />
      <ListadoPaginado
        listado={listado}
        columnas={columnas}
        claveFila={(n) => n.id}
        placeholderBusqueda="Buscar por vecino o email"
        mensajeVacio="No hay notificaciones para mostrar"
        filtros={
          <>
            <FiltroSelect
              etiqueta="Tipo"
              valor={listado.filtros.tipo}
              opciones={opcionesDeEtiquetas(ETIQUETAS_TIPO_NOTIFICACION)}
              etiquetaTodos="Todos los tipos"
              onCambiar={(valor) => listado.filtrar("tipo", valor)}
            />
            <FiltroSelect
              etiqueta="Estado"
              valor={listado.filtros.estado}
              opciones={opcionesDeEtiquetas(ETIQUETAS_ESTADO_ENVIO)}
              etiquetaTodos="Todos los estados"
              onCambiar={(valor) => listado.filtrar("estado", valor)}
            />
            <Input
              type="date"
              aria-label="Desde"
              title="Programadas desde"
              className="w-auto"
              value={listado.filtros.desde}
              onChange={(evento) => listado.filtrar("desde", evento.target.value)}
            />
            <Input
              type="date"
              aria-label="Hasta"
              title="Programadas hasta"
              className="w-auto"
              value={listado.filtros.hasta}
              onChange={(evento) => listado.filtrar("hasta", evento.target.value)}
            />
          </>
        }
      />
    </>
  );
}
```

- [ ] **Step 2: `src/app/(panel)/notificaciones/page.tsx`**

```tsx
import { GestionNotificaciones } from "@/components/notificaciones/gestion-notificaciones";
import { tienePermiso } from "@/lib/permisos";
import { exigirPermisoPagina } from "@/lib/sesion";

/** F12 — Notificaciones (gestión: administrador; consulta: operador). */
export default async function PaginaNotificaciones() {
  const sesion = await exigirPermisoPagina("notificaciones:ver");
  return <GestionNotificaciones puedeGestionar={tienePermiso(sesion.rol, "notificaciones:gestionar")} />;
}
```

- [ ] **Step 3: `src/lib/procesador-notificaciones.ts`**

```ts
import { setInterval } from "node:timers";
import { procesarPendientes } from "@/services/notificaciones";
import { smtpConfigurado } from "./mailer";

/** Frecuencia del envío automático de notificaciones (F12). */
const INTERVALO_MS = 60_000;

/** El temporizador se guarda en globalThis para no duplicarlo si el módulo se vuelve a evaluar. */
const almacenGlobal = globalThis as unknown as { temporizadorNotificaciones?: NodeJS.Timeout };

/**
 * Arranca el procesador periódico de notificaciones. Si el SMTP no está configurado no
 * arranca (lo avisa en el log): las notificaciones quedan pendientes y pueden enviarse
 * luego con "Procesar pendientes".
 */
export function iniciarProcesadorNotificaciones(): void {
  if (almacenGlobal.temporizadorNotificaciones) return;
  if (!smtpConfigurado()) {
    console.warn("[SIGCAN] SMTP sin configurar: el envío automático de notificaciones está desactivado.");
    return;
  }

  // Evita que una ejecución lenta (SMTP demorado) se superponga con la siguiente.
  let enCurso = false;
  almacenGlobal.temporizadorNotificaciones = setInterval(async () => {
    if (enCurso) return;
    enCurso = true;
    try {
      const { enviadas, fallidas } = await procesarPendientes();
      if (enviadas + fallidas > 0) {
        console.info(`[SIGCAN] Notificaciones: ${enviadas} enviadas, ${fallidas} fallidas`);
      }
    } catch (error) {
      console.error("[SIGCAN] Error en el procesador de notificaciones:", error);
    } finally {
      enCurso = false;
    }
  }, INTERVALO_MS);
  // No impide que el proceso termine (por ejemplo, al detener el servidor).
  almacenGlobal.temporizadorNotificaciones.unref();
}
```

- [ ] **Step 4: `src/instrumentation.ts`**

```ts
/**
 * Next.js ejecuta `register()` una vez al iniciar el servidor. Arranca el procesador
 * periódico de notificaciones (F12) solo en el runtime de Node.js (no en Edge) y nunca
 * durante `next build`. El import dinámico evita cargar Sequelize en otros runtimes.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NEXT_PHASE !== "phase-production-build") {
    const { iniciarProcesadorNotificaciones } = await import("./lib/procesador-notificaciones");
    iniciarProcesadorNotificaciones();
  }
}
```

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit` y `npm run lint`
Expected: tsc sin errores; lint con 0 errores.

Run: `npm run dev` y abrir `http://localhost:3000`
Expected: el servidor arranca; si `SMTP_USER`/`SMTP_PASS` están vacíos, el log muestra `[SIGCAN] SMTP sin configurar…`. El menú del administrador muestra Operativos, Turnos y Notificaciones. Detener el servidor (Ctrl+C).

---

### Task 13: Refactorización, verificación completa y punto de control

**Files:**
- Modify: `src/services/vecinos.ts`
- Create: `tests/humo/fase3.mjs`
- Modify: `docs/superpowers/desviaciones/fase3.md` (si hubo desviaciones)

- [ ] **Step 1: Refactorización — la baja de vecinos usa `anularRecordatorios()`**

En `src/services/vecinos.ts`:

1a. Agregar el import:

```ts
import { anularRecordatorios } from "./notificaciones";
```

1b. En `eliminarVecino`, reemplazar:

```ts
      await Notificacion.update(
        { estado_envio: "anulado" },
        { where: { turno_id: idsTurnos, tipo: "recordatorio", estado_envio: "pendiente" }, transaction },
      );
```

por:

```ts
      await anularRecordatorios(idsTurnos, transaction);
```

1c. En el `where` de los turnos activos de esa misma función, reemplazar `estado: { [Op.in]: ["pendiente", "confirmado"] }` por `estado: { [Op.in]: ESTADOS_TURNO_ACTIVOS }` y cambiar el import de constantes a:

```ts
import { ESTADOS_TURNO_ACTIVOS, MOTIVOS_CANCELACION } from "@/lib/constantes";
```

(`Notificacion` sigue importado porque se usa en el conteo de registros asociados.)

- [ ] **Step 2: Revisión de duplicación**

Buscar con el buscador del editor y corregir si aparece:
- Literales `["pendiente", "confirmado"]` o `["pendiente", "confirmado", "completado"]` en `src/` fuera de `src/lib/constantes.ts` → usar `ESTADOS_TURNO_ACTIVOS` / `ESTADOS_TURNO_CON_CUPO`.
- `.slice(0, 5)` aplicado a horas fuera de `src/lib/fechas.ts` → usar `horaCorta()`.
- `nombre ?? "Sin nombre"` o similares para animales → usar `nombreAnimal()`.

Registrar en el archivo de desviaciones cualquier cambio hecho fuera de lo indicado en el plan.

- [ ] **Step 3: Verificación estática y tests**

Run: `npx tsc --noEmit` → sin errores.
Run: `npm run lint` → 0 errores (1 advertencia previa aceptada en `src/lib/cliente-api.ts`).
Run: `npm test` → PASS, 118 tests.

- [ ] **Step 4: Crear la prueba de humo `tests/humo/fase3.mjs`**

```js
/**
 * Prueba de humo de la Fase 3 contra el servidor de producción (`next start`).
 * Recorre por la API el circuito completo: operativo, turno, confirmación, notificaciones,
 * procesamiento, reprogramación y cancelaciones, más los controles de acceso y las páginas.
 * Uso (desde la raíz del proyecto): node tests/humo/fase3.mjs [url-base]
 */
try {
  process.loadEnvFile(".env");
} catch {
  // Sin .env se usan los valores por defecto de .env.example.
}

const BASE = process.argv[2] ?? "http://localhost:3107";
let cookie = "";

/** Llama a la API; guarda la cookie de sesión que devuelva el login. */
async function llamar(metodo, ruta, cuerpo, { sinSesion = false, encabezados = {} } = {}) {
  const respuesta = await fetch(BASE + ruta, {
    method: metodo,
    redirect: "manual",
    headers: {
      ...(cuerpo !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(cookie && !sinSesion ? { Cookie: cookie } : {}),
      ...encabezados,
    },
    body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
  });
  const nuevaCookie = respuesta.headers.get("set-cookie");
  if (nuevaCookie && !sinSesion) cookie = nuevaCookie.split(";")[0];
  const texto = await respuesta.text();
  let datos = null;
  try {
    datos = texto ? JSON.parse(texto) : null;
  } catch {
    datos = texto.slice(0, 200);
  }
  return { estado: respuesta.status, datos };
}

/** Corta la prueba con el detalle si una verificación falla. */
function verificar(paso, condicion, detalle) {
  if (!condicion) {
    console.error(`✗ ${paso}`, detalle === undefined ? "" : JSON.stringify(detalle));
    process.exit(1);
  }
  console.log(`✓ ${paso}`);
}

/** Fecha local de Río Grande (UTC-3) desplazada en días, como YYYY-MM-DD. */
function fechaLocal(dias) {
  return new Date(Date.now() - 3 * 3_600_000 + dias * 86_400_000).toISOString().slice(0, 10);
}

const sufijo = String(Date.now()).slice(-7);

// 1) Controles de acceso y login
let r = await llamar("GET", "/api/turnos", undefined, { sinSesion: true });
verificar("GET /api/turnos sin sesión → 401", r.estado === 401, r);
r = await llamar("POST", "/api/notificaciones/procesar", undefined, { sinSesion: true });
verificar("POST /api/notificaciones/procesar sin sesión ni secreto → 401", r.estado === 401, r);
r = await llamar("POST", "/api/auth/login", {
  email: process.env.SEED_ADMIN_EMAIL ?? "admin@sigcan.local",
  password: process.env.SEED_ADMIN_PASSWORD ?? "Admin1234",
});
verificar("login del administrador", r.estado === 200 && cookie !== "", r);

// 2) Datos base con la API de la Fase 2: zona, vecino con email y animal
r = await llamar("GET", "/api/zonas/opciones");
const zonaId = r.datos[0].id;
r = await llamar("POST", "/api/vecinos", {
  nombre: "Humo", apellido: "Fase Tres", dni: `9${sufijo}`, telefono: "2964000000",
  email: "humo.fase3@prueba.local", direccion: "Calle 1", zona_id: zonaId,
});
verificar("alta de vecino", r.estado === 201, r);
const vecinoId = r.datos.id;
r = await llamar("POST", "/api/animales", {
  nombre: "Humo", raza: "", sexo: "M", edad_estimada: null, condicion: "con_tutor",
  vecino_id: vecinoId, numero_chip: "", castrado: false,
});
verificar("alta de animal", r.estado === 201, r);
const animalId = r.datos.id;

// 3) Operativo
const datosOperativo = {
  fecha: fechaLocal(7), hora_inicio: "09:00", hora_fin: "13:00", lugar: "SUM humo", cupo_maximo: 5, zona_id: zonaId,
};
r = await llamar("POST", "/api/operativos", { ...datosOperativo, hora_fin: "08:00" });
verificar("operativo con hora de fin anterior → 400 en hora_fin", r.estado === 400 && r.datos.error.campos?.hora_fin, r);
r = await llamar("POST", "/api/operativos", datosOperativo);
verificar("alta de operativo (201, 5 lugares libres)", r.estado === 201 && r.datos.disponibles === 5, r);
const operativoId = r.datos.id;
r = await llamar("GET", "/api/operativos/opciones");
verificar("el operativo aparece en las opciones", r.datos.some((o) => o.id === operativoId), r);
r = await llamar("GET", "/api/animales/opciones");
verificar("el animal aparece en las opciones", r.datos.some((a) => a.id === animalId), r);
r = await llamar("GET", "/api/personal/opciones");
verificar("opciones de personal", r.estado === 200 && Array.isArray(r.datos), r);

// 4) Turno: solicitud, duplicado, confirmación y notificaciones
const datosTurno = { animal_id: animalId, operativo_id: operativoId, horario: "10:00", tipo_solicitado: "castracion_y_chipeo" };
r = await llamar("POST", "/api/turnos", datosTurno);
verificar("solicitud de turno (201, pendiente)", r.estado === 201 && r.datos.estado === "pendiente", r);
const turnoId = r.datos.id;
r = await llamar("POST", "/api/turnos", datosTurno);
verificar("segundo turno activo del mismo animal → 409", r.estado === 409, r);
r = await llamar("POST", `/api/turnos/${turnoId}/confirmar`);
verificar("confirmación del turno", r.estado === 200 && r.datos.estado === "confirmado", r);
r = await llamar("GET", "/api/notificaciones?busqueda=Fase%20Tres");
verificar("confirmación y recordatorio registrados", r.datos.total === 2, r);

const autorizacion = process.env.CRON_SECRET
  ? { sinSesion: true, encabezados: { Authorization: `Bearer ${process.env.CRON_SECRET}` } }
  : {};
r = await llamar("POST", "/api/notificaciones/procesar", undefined, autorizacion);
verificar(
  `procesamiento ${process.env.CRON_SECRET ? "con CRON_SECRET" : "con sesión"} (procesó la confirmación)`,
  r.estado === 200 && r.datos.enviadas + r.datos.fallidas >= 1,
  r,
);
r = await llamar("GET", "/api/notificaciones?busqueda=Fase%20Tres&tipo=confirmacion");
const confirmacion = r.datos.filas[0];
verificar("la confirmación quedó enviada o fallida", ["enviado", "fallido"].includes(confirmacion.estado_envio), r);
if (confirmacion.estado_envio === "fallido") {
  r = await llamar("POST", `/api/notificaciones/${confirmacion.id}/reintentar`);
  verificar("reintento de la notificación fallida → 204", r.estado === 204, r);
}

// 5) Reprogramación y cancelaciones
r = await llamar("POST", `/api/turnos/${turnoId}/reprogramar`, { operativo_id: operativoId, horario: "11:00" });
verificar("reprogramación del turno a las 11:00", r.estado === 200 && r.datos.horario === "11:00", r);
r = await llamar("POST", `/api/turnos/${turnoId}/cancelar`, { motivo: "Prueba de humo" });
verificar("cancelación del turno", r.estado === 200 && r.datos.estado === "cancelado", r);
r = await llamar("POST", `/api/operativos/${operativoId}/cancelar`, { motivo: "Prueba de humo", fuerza_mayor: false });
verificar("cancelación del operativo (más de 48 h)", r.estado === 200 && r.datos.turnosCancelados === 0, r);
r = await llamar("PUT", `/api/operativos/${operativoId}`, datosOperativo);
verificar("no se edita un operativo cancelado → 409", r.estado === 409, r);

// 6) Páginas
for (const pagina of ["/operativos", `/operativos/${operativoId}`, "/turnos", "/notificaciones"]) {
  r = await llamar("GET", pagina);
  verificar(`GET ${pagina} → 200`, r.estado === 200, r.estado);
}

console.log("\nPrueba de humo de la Fase 3: OK");
```

- [ ] **Step 5: Build y prueba de humo contra la base de test**

La prueba se corre contra `sigcan_test` para no dejar datos en la base de desarrollo (los tests la reinician en cada corrida).

Run: `npm run db:reset:test`
Run: `npm run build`
Expected: build exitoso, sin errores de tipos.

Levantar el servidor apuntando a la base de test (en otra terminal; PowerShell):

```powershell
$env:DATABASE_URL = "postgres://sigcan:sigcan@localhost:5433/sigcan_test"; npx next start -p 3107
```

(En bash: `DATABASE_URL=postgres://sigcan:sigcan@localhost:5433/sigcan_test npx next start -p 3107`.)

Run: `node tests/humo/fase3.mjs http://localhost:3107`
Expected: todas las líneas con `✓` y al final `Prueba de humo de la Fase 3: OK`.

Detener el servidor (Ctrl+C) y, en PowerShell, cerrar esa terminal o ejecutar `Remove-Item Env:DATABASE_URL`.

- [ ] **Step 6: Correo real (lo hace el usuario; criterio de cierre del spec)**

Con `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` y `SMTP_FROM` completos en `.env` (por ejemplo, Gmail con contraseña de aplicación, puerto 465):
1. `npm run dev`; el log **no** debe mostrar el aviso de SMTP sin configurar.
2. Crear un vecino con un email propio, un animal suyo, un operativo a más de 2 días y un turno; confirmarlo.
3. En "Notificaciones", "Procesar pendientes" (o esperar un minuto): la confirmación pasa a `Enviado` y el correo llega a la casilla.
4. Cancelar el turno y procesar: llega el correo de cancelación con el motivo; el recordatorio figura `Anulado`.

Si el correo no llega, revisar el log del servidor (`No se pudo enviar la notificación …`) y registrar el problema en el archivo de desviaciones.

- [ ] **Step 7: Recorrido manual por rol (navegador)**

Con un usuario de cada rol (crear operador y veterinario desde Usuarios si no existen):
- **Administrador:** ve Operativos, Turnos y Notificaciones; crea, edita, inicia, finaliza y cancela operativos; asigna y quita personal; gestiona turnos; procesa y reintenta notificaciones.
- **Operador:** igual que el administrador, pero **sin** botón "Cancelar" en el detalle del operativo; en Notificaciones ve el listado sin "Procesar pendientes" ni "Reintentar".
- **Veterinario:** ve Operativos y Turnos solo en consulta (sin botones de alta, edición ni acciones); no ve Notificaciones en el menú y `/notificaciones` lo redirige al inicio.

- [ ] **Step 8: Desviaciones y punto de control**

Completar `docs/superpowers/desviaciones/fase3.md` (o dejar "Sin desviaciones.") con: cambios respecto del plan, resultado de `npm test` (cantidad de tests), resultado de la prueba de humo y del correo real.

**Punto de control:** detenerse y avisar al usuario que la Fase 3 está lista para commitear (no ejecutar git).
