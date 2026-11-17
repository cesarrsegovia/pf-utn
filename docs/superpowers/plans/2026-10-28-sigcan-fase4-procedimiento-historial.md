# SIGCAN Fase 4 (Procedimiento e historial clínico) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** F7 Registrar procedimiento (una única transacción que descuenta stock, completa el turno, actualiza el animal, anula el recordatorio y crea la entrada del historial, con rollback total ante cualquier falla) y F8 Historial clínico (solo consulta, por animal en orden cronológico, con filtros de fecha y tipo).

**Architecture:** Igual que las fases anteriores: Route Handler → `requerirSesion(accion)` → Zod → servicio con transacción. `registrarProcedimiento()` orquesta todo dentro de `sequelize.transaction()` reutilizando `ajustarStock()` (F6) mediante un nuevo helper de insumos y `anularRecordatorios()` (F12). Las filas se bloquean siempre en el mismo orden: operativo (compartido) → turno → animal → insumos por id ascendente. El historial no tiene alta manual: solo se escribe desde F7.

**Tech Stack:** Next.js 16.4.3, Sequelize 6, Zod 4, react-hook-form (`useFieldArray`), SWR, shadcn/ui (Base UI), Vitest 3. **No se instalan dependencias.**

**Spec:** `docs/superpowers/specs/2026-10-28-sigcan-design.md` — §4 (F7 solo veterinario con matrícula y asignado; F8 lectura para todos), §5 F7 y F8, §6 (confirmación explícita antes de registrar), §7 (F7: transacción exitosa y rollback). Reglas de origen: `docs/Fase 2 - Diseno del Sistema - CORREGIDO.pdf`, sección 6 (Procedimientos F7, Historial F8).

---

## 0. Reglas para quien implemente (leer antes de empezar)

1. **Git:** no ejecutar ningún comando de git (ni siquiera `git status`). Los "Puntos de control" son avisos al usuario (ver `CLAUDE.md`).
2. **Desviaciones:** crear `docs/superpowers/desviaciones/fase4.md` al empezar (Task 1, Step 1). Copiar el código tal como está; si algo no compila o no funciona, hacer el cambio mínimo, **registrarlo** (archivo, qué decía el plan, qué se cambió y por qué) y dejar un comentario en el código.
3. **Tests:** prohibido modificar un test del plan para que pase. Si un test parece incorrecto, detenerse y registrarlo. Los tests de fases anteriores no se tocan; en `tests/helpers/fabricas.ts` solo se **agregan** funciones.
4. **Dependencias:** no instalar nada. No ejecutar `npx shadcn add`.
5. **Modelos y migraciones:** no se crean ni modifican. Las tablas `procedimiento`, `procedimiento_insumo`, `movimiento_insumo` e `historial_clinico` ya existen con sus restricciones (incluido `ck_procedimiento_chip`: hay chip si y solo si el procedimiento incluye chipeo).
6. **shadcn/ui con Base UI:** usar la prop `render` (nunca `asChild`); `NativeSelect` en formularios con `className="w-full"`; enlaces con estilo de botón con `buttonVariants` sobre `<Link>`.
7. **Comentarios:** todo archivo nuevo lleva comentarios profesionales, claros y concisos en español (ya incluidos; mantenerlos).
8. **Alcance:** no implementar nada de fases posteriores (avistamientos F9, reportes F13, dashboard). No crear endpoints de alta, edición ni baja de historial clínico ni de procedimientos.
9. **Archivos que no se tocan:** `CLAUDE.md`, `AGENTS.md`, `docs/` (salvo el archivo de desviaciones), `src/models/*`, `db/*`.
10. **Verificación en producción obligatoria (Task 9):** `npm run build` + `next start` contra la base de test y la prueba de humo `tests/humo/fase4.mjs`.

### 0.1 Lecciones de la Fase 3 (aplicarlas desde el primer archivo)

La revisión de cierre de la Fase 3 encontró la ejecución fiel al plan; estos son los puntos a cuidar:

- **L1 — Índices con `CreationOptional` (TS7053).** Las columnas declaradas `CreationOptional<T>` (por ejemplo `turno.estado`, `operativo.estado`) no pueden indexar un `Record<T, string>` directamente. Este plan ya trae el cast (`ETIQUETAS_ESTADO_TURNO[turno.estado as EstadoTurno]`). Si aparece otro TS7053, usar el mismo patrón y registrarlo.
- **L2 — Toda lectura que precede a una actualización se bloquea.** Si se lee una fila para decidir y luego modificarla, la lectura lleva `lock` (sin `include`). El revisor tuvo que agregarlo en la cascada de cancelación de operativos.
- **L3 — Autocomparación al cerrar cada Task.** Antes de marcar una Task como hecha, comparar cada archivo "Create" con su bloque del plan (deben ser idénticos salvo desviaciones registradas) y verificar que cada bloque "Modify" quedó aplicado. El revisor de cierre hará la misma comparación automáticamente.
- **L4 — Atomicidad probada, no supuesta.** Los tests de F7 fuerzan una falla en el último paso (historial) y verifican que no quedó nada persistido. No "simplificarlos".

## 1. Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/lib/constantes.ts` (modificar) | `tipoIncluido()` (lo realizado debe estar incluido en lo solicitado) |
| `src/lib/navegacion.ts` (modificar) | Ítems Procedimientos e Historial |
| `src/schemas/procedimientos.ts` | Registro de procedimiento con insumos usados |
| `src/schemas/historial.ts` | Filtros del historial |
| `src/services/insumos.ts` (modificar) | `descontarPorProcedimiento()` (stock + uso + egreso) y `opcionesInsumos()` |
| `src/services/turnos.ts` (modificar) | `listarTurnosAtendibles()` y separación de las inclusiones |
| `src/services/procedimientos.ts` | F7: veterinario habilitado, transacción completa, turnos para atender |
| `src/services/historial.ts` | F8: listado con filtros y orden cronológico |
| `src/app/api/procedimientos/route.ts`, `src/app/api/procedimientos/turnos/route.ts`, `src/app/api/historial/route.ts`, `src/app/api/insumos/opciones/route.ts` | API REST |
| `src/components/procedimientos/{formulario-procedimiento,turnos-para-atender}.tsx` | Pantalla del veterinario |
| `src/components/historial/historial-clinico.tsx` | Consulta del historial |
| `src/components/animales/gestion-animales.tsx` (modificar) | Enlace "Ver historial" por animal |
| `src/app/(panel)/procedimientos/page.tsx`, `src/app/(panel)/historial/page.tsx` | Páginas |
| `tests/helpers/fabricas.ts` (modificar) | `crearVeterinarioConUsuario()` |
| `tests/lib/dominio-fase4.test.ts`, `tests/services/{procedimientos,historial}.test.ts` | Tests |
| `tests/humo/fase4.mjs` | Prueba de humo contra `next start` |

## 2. Decisiones de esta fase (para la defensa)

- **Quién registra:** el usuario en sesión debe tener rol veterinario (permiso `procedimientos:registrar`) y estar vinculado a un integrante del personal **activo**, de tipo veterinario, **con matrícula** y **asignado al operativo** del turno. Si no cumple, la API responde 403 con el motivo.
- **Tipo realizado ⊆ tipo solicitado:** si se pidió "castración y chipeo" se puede registrar castración, chipeo o ambos; si se pidió solo castración, solo castración (y lo mismo con chipeo). No se registra castración para un animal ya castrado ni chipeo para uno ya chipeado.
- **Chip:** obligatorio y de 15 dígitos si el procedimiento incluye chipeo; debe ser único entre los chips de animales y los chips colocados en procedimientos. Si no incluye chipeo, se guarda NULL (lo exige `ck_procedimiento_chip`).
- **Insumos:** opcionales (puede haber procedimientos sin insumos registrados), sin repetir el mismo insumo en dos filas, cantidad > 0 con hasta dos decimales. Cada uno descuenta stock (nunca negativo), crea `procedimiento_insumo` y un egreso en `movimiento_insumo` con el procedimiento y el usuario que registró.
- **Orden de bloqueo fijo:** operativo (`FOR SHARE`: varios veterinarios pueden registrar en paralelo, pero nadie puede finalizar el operativo mientras tanto) → turno → animal → insumos por id ascendente (`FOR UPDATE`). Ninguna operación de las Fases 3 y 4 toma estos bloqueos en otro orden, así que no hay interbloqueos.
- **Una sola transacción:** cualquier error (stock, chip, validación o falla técnica) revierte todo; el mensaje explica la causa (ej.: "Stock insuficiente de Ketamina: disponible 2,00 ml, requerido 5,00 ml").
- **Historial:** se genera una descripción legible (tipo, veterinario y matrícula, chip, insumos con cantidades, observaciones). Animal y fecha no se duplican: se obtienen del procedimiento y su turno (Fase 2, F8).
- **Orden del historial:** filtrado por animal, cronológico ascendente (la "vida clínica" del animal); sin filtro de animal, del más reciente al más antiguo.
- **Confirmación explícita:** el formulario pide confirmar antes de registrar, porque la operación no se puede deshacer (spec §6).

---

### Task 1: Archivo de desviaciones y utilidad de dominio (TDD)

**Files:**
- Create: `docs/superpowers/desviaciones/fase4.md`
- Modify: `src/lib/constantes.ts`
- Test: `tests/lib/dominio-fase4.test.ts`

- [ ] **Step 1: Crear el archivo de desviaciones**

```markdown
# Registro de desviaciones — Fase 4 (Procedimiento e historial clínico)

Sin desviaciones.
```

- [ ] **Step 2: Escribir el test que falla `tests/lib/dominio-fase4.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { tipoIncluido } from "@/lib/constantes";

describe("tipo realizado incluido en el solicitado (F7)", () => {
  it("acepta lo pedido o una parte de lo pedido, nunca algo no pedido", () => {
    expect(tipoIncluido("castracion", "castracion_y_chipeo")).toBe(true);
    expect(tipoIncluido("chipeo", "castracion_y_chipeo")).toBe(true);
    expect(tipoIncluido("castracion_y_chipeo", "castracion_y_chipeo")).toBe(true);
    expect(tipoIncluido("castracion", "castracion")).toBe(true);
    expect(tipoIncluido("chipeo", "castracion")).toBe(false);
    expect(tipoIncluido("castracion_y_chipeo", "chipeo")).toBe(false);
  });
});
```

- [ ] **Step 3: Correr y verificar que falla**

Run: `npx vitest run tests/lib/dominio-fase4.test.ts`
Expected: FAIL (`tipoIncluido` no existe).

- [ ] **Step 4: Agregar al final de `src/lib/constantes.ts`**

```ts

/**
 * Indica si el tipo realizado está incluido en el solicitado: "castración y chipeo" admite
 * castración, chipeo o ambos; "castración" o "chipeo" solo admiten ese mismo tipo (F7).
 */
export function tipoIncluido(realizado: TipoProcedimiento, solicitado: TipoProcedimiento): boolean {
  return (
    (!incluyeCastracion(realizado) || incluyeCastracion(solicitado)) &&
    (!incluyeChipeo(realizado) || incluyeChipeo(solicitado))
  );
}
```

- [ ] **Step 5: Correr y verificar que pasa**

Run: `npx vitest run tests/lib/dominio-fase4.test.ts`
Expected: PASS (1 test).

---

### Task 2: Esquemas de validación

**Files:**
- Create: `src/schemas/procedimientos.ts`, `src/schemas/historial.ts`

- [ ] **Step 1: `src/schemas/procedimientos.ts`**

```ts
import { incluyeChipeo, TIPOS_PROCEDIMIENTO } from "@/lib/constantes";
import { cantidadPositiva, idSeleccionado, textoOpcional, z } from "./comun";

/** Insumo usado en un procedimiento y su cantidad. */
export const esquemaInsumoUsado = z.object({
  insumo_id: idSeleccionado("Seleccione un insumo"),
  cantidad: cantidadPositiva,
});

/**
 * Registro de procedimiento (F7). El chip es obligatorio si el tipo incluye chipeo
 * (15 dígitos, ISO 11784/11785) y los insumos no se repiten.
 */
export const esquemaProcedimiento = z
  .object({
    turno_id: idSeleccionado("Seleccione un turno"),
    tipo: z.enum(TIPOS_PROCEDIMIENTO, "Seleccione el procedimiento realizado"),
    numero_chip_colocado: z
      .string()
      .trim()
      .refine((valor) => valor === "" || /^\d{15}$/.test(valor), "El chip debe tener 15 dígitos"),
    observaciones: textoOpcional(1000),
    insumos: z.array(esquemaInsumoUsado).max(20, "Máximo 20 insumos"),
  })
  .refine((datos) => !incluyeChipeo(datos.tipo) || datos.numero_chip_colocado !== "", {
    path: ["numero_chip_colocado"],
    message: "Ingrese el número de chip colocado",
  })
  .refine((datos) => new Set(datos.insumos.map((uso) => uso.insumo_id)).size === datos.insumos.length, {
    path: ["insumos"],
    message: "No repita insumos: sume las cantidades en una sola fila",
  });
export type DatosProcedimiento = z.infer<typeof esquemaProcedimiento>;
```

- [ ] **Step 2: `src/schemas/historial.ts`**

```ts
import { TIPOS_PROCEDIMIENTO } from "@/lib/constantes";
import { esquemaListado, fechaValida, z } from "./comun";

/** Consulta del historial clínico (F8): animal, tipo y rango de fechas del procedimiento. */
export const esquemaListadoHistorial = esquemaListado.extend({
  animal_id: z.coerce.number().int().positive().optional(),
  tipo: z.enum(TIPOS_PROCEDIMIENTO).optional(),
  desde: fechaValida.optional(),
  hasta: fechaValida.optional(),
});
export type ParametrosListadoHistorial = z.infer<typeof esquemaListadoHistorial>;
```

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit`
Expected: sin errores.

---

### Task 3: Helpers en insumos y turnos, y fábrica de veterinario

**Files:**
- Modify: `src/services/insumos.ts`, `src/services/turnos.ts`, `tests/helpers/fabricas.ts`

- [ ] **Step 1: `src/services/insumos.ts`**

1a. Reemplazar estas dos líneas de import:

```ts
import { ReglaNegocioError } from "@/lib/errores";
import type { ParametrosListado, ResultadoPaginado } from "@/schemas/comun";
```

por:

```ts
import { ReglaNegocioError, ValidacionError } from "@/lib/errores";
import type { Opcion, ParametrosListado, ResultadoPaginado } from "@/schemas/comun";
```

1b. Agregar debajo de la función `ajustarStock`:

```ts

/**
 * Descuenta los insumos usados en un procedimiento (F7) dentro de su transacción: bloquea
 * las filas por id ascendente (orden fijo para evitar interbloqueos), verifica y descuenta
 * el stock, registra el uso (procedimiento_insumo) y un egreso con el procedimiento y el
 * usuario. Devuelve el detalle legible ("Ketamina 2,50 ml") para el historial clínico.
 */
export async function descontarPorProcedimiento(
  usos: Array<{ insumo_id: number; cantidad: number }>,
  procedimientoId: number,
  usuarioId: number,
  transaction: Transaction,
): Promise<string[]> {
  if (usos.length === 0) return [];
  const insumos = await Insumo.findAll({
    where: { id: usos.map((uso) => uso.insumo_id) },
    order: [["id", "ASC"]],
    lock: transaction.LOCK.UPDATE,
    transaction,
  });
  const porId = new Map(insumos.map((insumo) => [insumo.id, insumo]));

  const detalle: string[] = [];
  for (const uso of usos) {
    const insumo = porId.get(uso.insumo_id);
    if (!insumo) {
      throw new ValidacionError("Revise los datos ingresados", { insumos: "Uno de los insumos seleccionados no existe" });
    }
    // Lanza "Stock insuficiente de …" si el egreso supera el disponible.
    await ajustarStock(insumo, "egreso", uso.cantidad, transaction);
    const cantidad = deCentesimos(aCentesimos(uso.cantidad));
    await ProcedimientoInsumo.create(
      { procedimiento_id: procedimientoId, insumo_id: insumo.id, cantidad_usada: cantidad },
      { transaction },
    );
    await MovimientoInsumo.create(
      {
        tipo: "egreso",
        cantidad,
        motivo: `Procedimiento #${procedimientoId}`,
        insumo_id: insumo.id,
        usuario_id: usuarioId,
        procedimiento_id: procedimientoId,
      },
      { transaction },
    );
    detalle.push(`${insumo.nombre} ${formatearCantidad(cantidad, insumo.unidad)}`);
  }
  return detalle;
}
```

1c. Agregar debajo de `listarInsumos`:

```ts

/** Insumos con stock disponible, para el formulario de procedimientos (F7). */
export async function opcionesInsumos(): Promise<Opcion[]> {
  const insumos = await Insumo.findAll({
    where: { stock_actual: { [Op.gt]: 0 } },
    order: [["nombre", "ASC"]],
  });
  return insumos.map((insumo) => ({
    id: insumo.id,
    etiqueta: `${insumo.nombre} (disponible: ${formatearCantidad(insumo.stock_actual, insumo.unidad)})`,
  }));
}
```

- [ ] **Step 2: `src/services/turnos.ts`**

2a. Reemplazar el bloque completo de la constante `INCLUIR_DETALLE` (desde su comentario `/** Asociaciones que necesita el DTO…` hasta el `];` que la cierra) por:

```ts
/** Animal del turno con su tutor (opcional: los callejeros no tienen). */
const INCLUIR_ANIMAL: Includeable = {
  association: "animal",
  attributes: ["id", "nombre", "vecino_id"],
  include: [{ association: "vecino", attributes: ["id", "nombre", "apellido", "dni"], required: false }],
};

/** Zona del operativo del turno. */
const INCLUIR_ZONA: Includeable = { association: "zona", attributes: ["id", "nombre"] };

/** Asociaciones que necesita el DTO: animal con tutor y operativo con zona. */
const INCLUIR_DETALLE: Includeable[] = [
  INCLUIR_ANIMAL,
  { association: "operativo", attributes: ["id", "fecha", "lugar"], include: [INCLUIR_ZONA] },
];
```

2b. Agregar debajo de `listarTurnos`:

```ts

/**
 * Turnos que un veterinario puede atender ahora (F7): confirmados, de operativos en curso
 * a los que está asignado, ordenados por horario.
 */
export async function listarTurnosAtendibles(veterinarioId: number): Promise<TurnoDto[]> {
  const turnos = await Turno.findAll({
    where: { estado: "confirmado" },
    include: [
      INCLUIR_ANIMAL,
      {
        association: "operativo",
        attributes: ["id", "fecha", "lugar"],
        where: { estado: "en_curso" },
        include: [
          INCLUIR_ZONA,
          // Filtra por asignación sin traer columnas del personal.
          { association: "personal", attributes: [], where: { id: veterinarioId }, through: { attributes: [] } },
        ],
      },
    ],
    order: [["horario", "ASC"], ["id", "ASC"]],
  });
  return turnos.map(aDto);
}
```

- [ ] **Step 3: `tests/helpers/fabricas.ts`**

3a. Reemplazar la línea:

```ts
import type { EstadoEnvio, EstadoOperativo, EstadoTurno, TipoNotificacion } from "@/lib/constantes";
```

por:

```ts
import type { EstadoEnvio, EstadoOperativo, EstadoTurno, TipoNotificacion, TipoPersonal } from "@/lib/constantes";
```

3b. Agregar al final del archivo:

```ts

/**
 * Crea un usuario con rol veterinario y su registro de personal vinculado.
 * Por defecto es veterinario con matrícula; `matricula: null` solo es válido para auxiliares.
 */
export async function crearVeterinarioConUsuario(
  opciones: { tipo?: TipoPersonal; matricula?: string | null } = {},
): Promise<{ usuario: Usuario; personal: Veterinario }> {
  const usuario = await crearUsuarioPrueba({ rol: "veterinario" });
  secuencia += 1;
  const personal = await Veterinario.create({
    tipo: opciones.tipo ?? "veterinario",
    nombre: "Veterinaria",
    apellido: `Prueba ${secuencia}`,
    matricula: opciones.matricula === undefined ? `MP-${secuencia}` : opciones.matricula,
    usuario_id: usuario.id,
  });
  return { usuario, personal };
}
```

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit` y `npm test`
Expected: sin errores de tipos; los 118 tests previos + 1 nuevo siguen en verde (la separación de inclusiones de `turnos.ts` no cambia comportamiento).

---

### Task 4: Servicio de procedimientos — F7 (TDD)

**Files:**
- Create: `src/services/procedimientos.ts`
- Test: `tests/services/procedimientos.test.ts`

- [ ] **Step 1: Escribir el test que falla `tests/services/procedimientos.test.ts`**

```ts
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  Animal, HistorialClinico, Insumo, MovimientoInsumo, Notificacion, OperativoVeterinario, Procedimiento,
  ProcedimientoInsumo, sequelize, Turno,
} from "@/lib/db";
import type { DatosProcedimiento } from "@/schemas/procedimientos";
import { crearInsumo } from "@/services/insumos";
import { registrarProcedimiento, turnosParaAtender } from "@/services/procedimientos";
import { reiniciarDatos } from "../helpers/bd";
import {
  adminSemilla, crearAnimalPrueba, crearNotificacionPrueba, crearOperativoPrueba, crearTurnoPrueba,
  crearUsuarioPrueba, crearVeterinarioConUsuario,
} from "../helpers/fabricas";

beforeEach(reiniciarDatos);
afterEach(() => vi.restoreAllMocks());
afterAll(() => sequelize.close());

const CHIP = "985112003456789";

/**
 * Operativo en curso hoy con un veterinario asignado; turno confirmado de castración y
 * chipeo con un recordatorio pendiente; insumos Ketamina (10 ml) y Sutura (5 u).
 */
async function escenario() {
  const { usuario, personal } = await crearVeterinarioConUsuario();
  const operativo = await crearOperativoPrueba({ diasDesdeHoy: 0, estado: "en_curso" });
  await OperativoVeterinario.create({ operativo_id: operativo.id, veterinario_id: personal.id });
  const animal = await crearAnimalPrueba();
  const turno = await crearTurnoPrueba(animal.id, operativo.id, "confirmado");
  await turno.update({ tipo_solicitado: "castracion_y_chipeo" });
  await crearNotificacionPrueba(turno.id, animal.vecino_id!, {
    tipo: "recordatorio",
    fechaProgramada: new Date(Date.now() + 60 * 60 * 1000),
  });
  const admin = await adminSemilla();
  const ketamina = await crearInsumo({ nombre: "Ketamina", unidad: "ml", stock_minimo: 1, stock_inicial: 10 }, admin.id);
  const sutura = await crearInsumo({ nombre: "Sutura", unidad: "u", stock_minimo: 1, stock_inicial: 5 }, admin.id);
  const datos: DatosProcedimiento = {
    turno_id: turno.id,
    tipo: "castracion_y_chipeo",
    numero_chip_colocado: CHIP,
    observaciones: "Sin complicaciones",
    insumos: [
      { insumo_id: ketamina.id, cantidad: 2.5 },
      { insumo_id: sutura.id, cantidad: 1 },
    ],
  };
  return { usuario, operativo, animal, turno, ketamina, sutura, datos };
}

type Escenario = Awaited<ReturnType<typeof escenario>>;

/** Verifica que no quedó nada persistido del procedimiento (rollback total). */
async function esperarSinCambios({ turno, animal, ketamina, sutura }: Escenario) {
  expect(await Procedimiento.count()).toBe(0);
  expect(await HistorialClinico.count()).toBe(0);
  expect(await ProcedimientoInsumo.count()).toBe(0);
  expect(await MovimientoInsumo.count({ where: { tipo: "egreso" } })).toBe(0);
  expect((await Turno.findByPk(turno.id))!.estado).toBe("confirmado");
  const animalActual = (await Animal.findByPk(animal.id))!;
  expect([animalActual.castrado, animalActual.numero_chip]).toEqual([false, null]);
  expect((await Insumo.findByPk(ketamina.id))!.stock_actual).toBe("10.00");
  expect((await Insumo.findByPk(sutura.id))!.stock_actual).toBe("5.00");
  expect(await Notificacion.count({ where: { tipo: "recordatorio", estado_envio: "pendiente" } })).toBe(1);
}

describe("registro exitoso (F7)", () => {
  it("en una transacción completa el turno, actualiza el animal, descuenta stock y crea el historial", async () => {
    const e = await escenario();
    const resultado = await registrarProcedimiento(e.datos, e.usuario.id);
    expect(resultado).toMatchObject({ turno_id: e.turno.id, tipo: "castracion_y_chipeo", numero_chip_colocado: CHIP });

    expect((await Turno.findByPk(e.turno.id))!.estado).toBe("completado");
    const animal = (await Animal.findByPk(e.animal.id))!;
    expect([animal.castrado, animal.numero_chip]).toEqual([true, CHIP]);
    expect((await Insumo.findByPk(e.ketamina.id))!.stock_actual).toBe("7.50");
    expect((await Insumo.findByPk(e.sutura.id))!.stock_actual).toBe("4.00");

    const egresos = await MovimientoInsumo.findAll({ where: { procedimiento_id: resultado.id }, order: [["insumo_id", "ASC"]] });
    expect(egresos.map((m) => [m.tipo, m.insumo_id, m.cantidad, m.usuario_id])).toEqual([
      ["egreso", e.ketamina.id, "2.50", e.usuario.id],
      ["egreso", e.sutura.id, "1.00", e.usuario.id],
    ]);
    expect(await ProcedimientoInsumo.count({ where: { procedimiento_id: resultado.id } })).toBe(2);

    const historial = (await HistorialClinico.findOne({ where: { procedimiento_id: resultado.id } }))!;
    for (const parte of ["Castración y chipeo", `Chip colocado: ${CHIP}`, "Ketamina 2,50 ml", "Sutura 1,00 u", "Sin complicaciones"]) {
      expect(historial.descripcion).toContain(parte);
    }
    expect(resultado.descripcion).toBe(historial.descripcion);
    expect(await Notificacion.count({ where: { tipo: "recordatorio", estado_envio: "pendiente" } })).toBe(0);
  });

  it("un procedimiento parcial (solo castración) no registra chip ni exige insumos", async () => {
    const e = await escenario();
    const resultado = await registrarProcedimiento(
      { ...e.datos, tipo: "castracion", numero_chip_colocado: "", insumos: [] },
      e.usuario.id,
    );
    expect(resultado.numero_chip_colocado).toBeNull();
    const animal = (await Animal.findByPk(e.animal.id))!;
    expect([animal.castrado, animal.numero_chip]).toEqual([true, null]);
    expect(resultado.descripcion).toContain("Sin insumos registrados");
  });
});

describe("rollback total (F7)", () => {
  it("stock insuficiente en el segundo insumo revierte también el primero", async () => {
    const e = await escenario();
    const datos = { ...e.datos, insumos: [{ insumo_id: e.ketamina.id, cantidad: 2 }, { insumo_id: e.sutura.id, cantidad: 50 }] };
    await expect(registrarProcedimiento(datos, e.usuario.id)).rejects.toThrow(
      "Stock insuficiente de Sutura: disponible 5,00 u, requerido 50,00 u",
    );
    await esperarSinCambios(e);
  });

  it("un chip ya registrado en otro animal revierte todo", async () => {
    const e = await escenario();
    await crearAnimalPrueba({ numeroChip: CHIP });
    await expect(registrarProcedimiento(e.datos, e.usuario.id)).rejects.toMatchObject({
      campos: { numero_chip_colocado: `El chip ${CHIP} ya está registrado` },
    });
    await esperarSinCambios(e);
  });

  it("una falla en el último paso (historial) no deja nada persistido", async () => {
    const e = await escenario();
    vi.spyOn(HistorialClinico, "create").mockRejectedValueOnce(new Error("Falla simulada"));
    await expect(registrarProcedimiento(e.datos, e.usuario.id)).rejects.toThrow("Falla simulada");
    await esperarSinCambios(e);
  });
});

describe("validaciones previas", () => {
  it("exige turno confirmado y operativo en curso", async () => {
    const e = await escenario();
    await e.turno.update({ estado: "pendiente" });
    await expect(registrarProcedimiento(e.datos, e.usuario.id)).rejects.toThrow("El turno debe estar confirmado");
    await e.turno.update({ estado: "confirmado" });
    await e.operativo.update({ estado: "programado" });
    await expect(registrarProcedimiento(e.datos, e.usuario.id)).rejects.toThrow("El operativo debe estar en curso");
  });

  it("solo registra un veterinario activo, con matrícula y asignado al operativo (403)", async () => {
    const e = await escenario();
    const sinPersonal = await crearUsuarioPrueba({ rol: "veterinario" });
    await expect(registrarProcedimiento(e.datos, sinPersonal.id)).rejects.toMatchObject({ estado: 403 });
    await expect(registrarProcedimiento(e.datos, sinPersonal.id)).rejects.toThrow("no está vinculado");

    const auxiliar = await crearVeterinarioConUsuario({ tipo: "auxiliar", matricula: null });
    await OperativoVeterinario.create({ operativo_id: e.operativo.id, veterinario_id: auxiliar.personal.id });
    await expect(registrarProcedimiento(e.datos, auxiliar.usuario.id)).rejects.toThrow(
      "Solo un veterinario con matrícula",
    );

    const noAsignado = await crearVeterinarioConUsuario();
    await expect(registrarProcedimiento(e.datos, noAsignado.usuario.id)).rejects.toThrow(
      "No está asignado a este operativo",
    );
  });

  it("lo realizado debe estar incluido en lo solicitado y no repetir lo ya hecho", async () => {
    const e = await escenario();
    await e.turno.update({ tipo_solicitado: "castracion" });
    await expect(registrarProcedimiento({ ...e.datos, tipo: "chipeo" }, e.usuario.id)).rejects.toThrow(
      "debe estar incluido en lo solicitado (Castración)",
    );

    await e.turno.update({ tipo_solicitado: "castracion_y_chipeo" });
    await e.animal.update({ castrado: true });
    await expect(registrarProcedimiento(e.datos, e.usuario.id)).rejects.toThrow("El animal ya está castrado");
  });
});

describe("turnos para atender", () => {
  it("lista solo los turnos confirmados de operativos en curso donde el veterinario está asignado", async () => {
    const e = await escenario();
    await crearTurnoPrueba((await crearAnimalPrueba()).id, e.operativo.id, "pendiente");
    const ajeno = await crearOperativoPrueba({ diasDesdeHoy: 0, estado: "en_curso" });
    await crearTurnoPrueba((await crearAnimalPrueba()).id, ajeno.id, "confirmado");

    const resultado = await turnosParaAtender(e.usuario.id);
    expect(resultado.habilitado).toBe(true);
    expect(resultado.turnos.map((t) => t.id)).toEqual([e.turno.id]);

    const sinPersonal = await crearUsuarioPrueba({ rol: "veterinario" });
    const bloqueado = await turnosParaAtender(sinPersonal.id);
    expect(bloqueado).toMatchObject({ habilitado: false, turnos: [] });
    expect(bloqueado.motivo).toContain("no está vinculado");
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run tests/services/procedimientos.test.ts`
Expected: FAIL (no existe `@/services/procedimientos`).

- [ ] **Step 3: `src/services/procedimientos.ts`**

```ts
import type { Transaction } from "sequelize";
import {
  incluyeCastracion, incluyeChipeo, tipoIncluido, type EstadoOperativo, type EstadoTurno, type TipoProcedimiento,
} from "@/lib/constantes";
import {
  Animal, HistorialClinico, Operativo, OperativoVeterinario, Procedimiento, sequelize, Turno, Veterinario,
} from "@/lib/db";
import { ProhibidoError, ReglaNegocioError, ValidacionError } from "@/lib/errores";
import { ETIQUETAS_ESTADO_OPERATIVO, ETIQUETAS_ESTADO_TURNO, ETIQUETAS_TIPO_PROCEDIMIENTO } from "@/lib/etiquetas";
import type { DatosProcedimiento } from "@/schemas/procedimientos";
import { nuloSiVacio } from "./comun";
import { descontarPorProcedimiento } from "./insumos";
import { anularRecordatorios } from "./notificaciones";
import { listarTurnosAtendibles, type TurnoDto } from "./turnos";

/** Resultado del registro de un procedimiento (F7). */
export interface ProcedimientoDto {
  id: number;
  turno_id: number;
  tipo: TipoProcedimiento;
  /** Fecha y hora del registro en ISO 8601. */
  fecha: string;
  numero_chip_colocado: string | null;
  /** Descripción guardada en el historial clínico. */
  descripcion: string;
}

/** Turnos que el veterinario en sesión puede atender, o el motivo por el que no puede. */
export interface TurnosParaAtender {
  habilitado: boolean;
  motivo: string | null;
  turnos: TurnoDto[];
}

/**
 * Integrante del personal vinculado al usuario en sesión, habilitado para registrar
 * procedimientos: activo, de tipo veterinario y con matrícula (spec §4). Si no, 403.
 */
async function exigirVeterinarioHabilitado(usuarioId: number, transaction?: Transaction): Promise<Veterinario> {
  const veterinario = await Veterinario.findOne({ where: { usuario_id: usuarioId }, transaction });
  if (!veterinario) {
    throw new ProhibidoError(
      "Su usuario no está vinculado a ningún integrante del personal: pida al administrador que lo vincule",
    );
  }
  if (!veterinario.activo) {
    throw new ProhibidoError("Su registro de personal está inactivo");
  }
  if (veterinario.tipo !== "veterinario" || !veterinario.matricula) {
    throw new ProhibidoError("Solo un veterinario con matrícula puede registrar procedimientos");
  }
  return veterinario;
}

/** El chip no puede existir en ningún animal ni haber sido colocado en otro procedimiento. */
async function exigirChipLibre(chip: string, transaction: Transaction): Promise<void> {
  const [enAnimales, enProcedimientos] = await Promise.all([
    Animal.count({ where: { numero_chip: chip }, transaction }),
    Procedimiento.count({ where: { numero_chip_colocado: chip }, transaction }),
  ]);
  if (enAnimales + enProcedimientos > 0) {
    throw new ValidacionError("Revise los datos ingresados", {
      numero_chip_colocado: `El chip ${chip} ya está registrado`,
    });
  }
}

/** Descripción del historial clínico: tipo, veterinario, chip, insumos y observaciones. */
function redactarDescripcion(
  tipo: TipoProcedimiento,
  veterinario: Veterinario,
  chip: string | null,
  insumos: string[],
  observaciones: string | null,
): string {
  const partes = [
    `Procedimiento: ${ETIQUETAS_TIPO_PROCEDIMIENTO[tipo]}.`,
    `Veterinario/a: ${veterinario.apellido}, ${veterinario.nombre} (Mat. ${veterinario.matricula}).`,
  ];
  if (chip) partes.push(`Chip colocado: ${chip}.`);
  partes.push(insumos.length > 0 ? `Insumos: ${insumos.join("; ")}.` : "Sin insumos registrados.");
  if (observaciones) partes.push(`Observaciones: ${observaciones}`);
  return partes.join(" ");
}

/**
 * Registra un procedimiento (F7) en una única transacción. Orden de bloqueo fijo:
 * operativo (compartido) → turno → animal → insumos por id ascendente. Cualquier error
 * revierte todo: stock, turno, animal, recordatorio e historial quedan como estaban.
 */
export async function registrarProcedimiento(datos: DatosProcedimiento, usuarioId: number): Promise<ProcedimientoDto> {
  return sequelize.transaction(async (transaction) => {
    // 1) Veterinario en sesión: vinculado, activo, de tipo veterinario y con matrícula.
    const veterinario = await exigirVeterinarioHabilitado(usuarioId, transaction);

    // 2) Turno y operativo. Primero se lee el operativo del turno (sin bloqueo) para respetar
    //    el orden operativo → turno; FOR SHARE impide finalizarlo mientras se registra.
    const referencia = await Turno.findByPk(datos.turno_id, { attributes: ["id", "operativo_id"], transaction });
    if (!referencia) {
      throw new ValidacionError("Revise los datos ingresados", { turno_id: "El turno no existe" });
    }
    const operativo = (await Operativo.findByPk(referencia.operativo_id, { transaction, lock: transaction.LOCK.SHARE }))!;
    const turno = (await Turno.findByPk(datos.turno_id, { transaction, lock: transaction.LOCK.UPDATE }))!;
    if (turno.estado !== "confirmado") {
      throw new ReglaNegocioError(
        `El turno debe estar confirmado (está ${ETIQUETAS_ESTADO_TURNO[turno.estado as EstadoTurno].toLowerCase()})`,
      );
    }
    if (operativo.estado !== "en_curso") {
      throw new ReglaNegocioError(
        `El operativo debe estar en curso (está ${ETIQUETAS_ESTADO_OPERATIVO[operativo.estado as EstadoOperativo].toLowerCase()})`,
      );
    }
    const asignado = await OperativoVeterinario.count({
      where: { operativo_id: operativo.id, veterinario_id: veterinario.id },
      transaction,
    });
    if (asignado === 0) {
      throw new ProhibidoError("No está asignado a este operativo: no puede registrar el procedimiento");
    }

    // 3) Tipo realizado incluido en lo solicitado; el animal no puede repetir lo ya hecho.
    if (!tipoIncluido(datos.tipo, turno.tipo_solicitado)) {
      throw new ReglaNegocioError(
        `El procedimiento debe estar incluido en lo solicitado (${ETIQUETAS_TIPO_PROCEDIMIENTO[turno.tipo_solicitado]})`,
      );
    }
    const animal = (await Animal.findByPk(turno.animal_id, { transaction, lock: transaction.LOCK.UPDATE }))!;
    if (incluyeCastracion(datos.tipo) && animal.castrado) {
      throw new ReglaNegocioError("El animal ya está castrado");
    }

    // 4) Chip: solo si incluye chipeo; único en animales y procedimientos.
    const chip = incluyeChipeo(datos.tipo) ? datos.numero_chip_colocado : null;
    if (chip !== null) {
      if (animal.numero_chip) {
        throw new ReglaNegocioError("El animal ya tiene chip colocado");
      }
      await exigirChipLibre(chip, transaction);
    }

    // 5) Procedimiento.
    const observaciones = nuloSiVacio(datos.observaciones);
    const procedimiento = await Procedimiento.create(
      { tipo: datos.tipo, observaciones, numero_chip_colocado: chip, turno_id: turno.id, veterinario_id: veterinario.id },
      { transaction },
    );

    // 6) Insumos: stock, uso y egreso (lanza "Stock insuficiente de …" si no alcanza).
    const insumos = await descontarPorProcedimiento(datos.insumos, procedimiento.id, usuarioId, transaction);

    // 7) Animal: castrado y/o chip.
    await animal.update(
      { ...(incluyeCastracion(datos.tipo) ? { castrado: true } : {}), ...(chip ? { numero_chip: chip } : {}) },
      { transaction },
    );

    // 8) Turno completado y recordatorio anulado.
    await turno.update({ estado: "completado" }, { transaction });
    await anularRecordatorios([turno.id], transaction);

    // 9) Historial clínico (último paso: si falla, se revierte todo lo anterior).
    const descripcion = redactarDescripcion(datos.tipo, veterinario, chip, insumos, observaciones);
    await HistorialClinico.create({ descripcion, procedimiento_id: procedimiento.id }, { transaction });

    return {
      id: procedimiento.id,
      turno_id: turno.id,
      tipo: procedimiento.tipo,
      fecha: procedimiento.fecha.toISOString(),
      numero_chip_colocado: chip,
      descripcion,
    };
  });
}

/**
 * Turnos que el veterinario en sesión puede atender ahora. Si su usuario no está
 * habilitado, devuelve el motivo para mostrarlo en pantalla en lugar de un error.
 */
export async function turnosParaAtender(usuarioId: number): Promise<TurnosParaAtender> {
  try {
    const veterinario = await exigirVeterinarioHabilitado(usuarioId);
    return { habilitado: true, motivo: null, turnos: await listarTurnosAtendibles(veterinario.id) };
  } catch (error) {
    if (error instanceof ProhibidoError) {
      return { habilitado: false, motivo: error.message, turnos: [] };
    }
    throw error;
  }
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npx vitest run tests/services/procedimientos.test.ts`
Expected: PASS (9 tests).

---

### Task 5: Servicio de historial clínico — F8 (TDD)

**Files:**
- Create: `src/services/historial.ts`
- Test: `tests/services/historial.test.ts`

- [ ] **Step 1: Escribir el test que falla `tests/services/historial.test.ts`**

```ts
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { OperativoVeterinario, sequelize } from "@/lib/db";
import { hoyLocal, sumarDias } from "@/lib/fechas";
import { listarHistorial } from "@/services/historial";
import { registrarProcedimiento } from "@/services/procedimientos";
import { reiniciarDatos } from "../helpers/bd";
import {
  crearAnimalPrueba, crearOperativoPrueba, crearTurnoPrueba, crearVeterinarioConUsuario,
} from "../helpers/fabricas";

beforeEach(reiniciarDatos);
afterAll(() => sequelize.close());

const CHIP = "985112003456789";
const BASE = { pagina: 1, tamanio: 10, busqueda: "" };

/**
 * Tres procedimientos en un operativo en curso: castración y después chipeo del mismo
 * animal, y por último la castración de otro animal.
 */
async function tresProcedimientos() {
  const { usuario, personal } = await crearVeterinarioConUsuario();
  const operativo = await crearOperativoPrueba({ diasDesdeHoy: 0, estado: "en_curso" });
  await OperativoVeterinario.create({ operativo_id: operativo.id, veterinario_id: personal.id });
  const sinChip = { numero_chip_colocado: "", observaciones: "", insumos: [] };

  const animal = await crearAnimalPrueba();
  const castracion = await crearTurnoPrueba(animal.id, operativo.id, "confirmado");
  await registrarProcedimiento({ ...sinChip, turno_id: castracion.id, tipo: "castracion" }, usuario.id);
  const chipeo = await crearTurnoPrueba(animal.id, operativo.id, "confirmado");
  await chipeo.update({ tipo_solicitado: "chipeo" });
  await registrarProcedimiento({ ...sinChip, turno_id: chipeo.id, tipo: "chipeo", numero_chip_colocado: CHIP }, usuario.id);

  const otro = await crearAnimalPrueba();
  const turnoOtro = await crearTurnoPrueba(otro.id, operativo.id, "confirmado");
  await registrarProcedimiento({ ...sinChip, turno_id: turnoOtro.id, tipo: "castracion" }, usuario.id);
  return { animal, otro };
}

describe("historial clínico (F8)", () => {
  it("muestra la vida clínica de un animal en orden cronológico", async () => {
    const { animal } = await tresProcedimientos();
    const { filas, total } = await listarHistorial({ ...BASE, animal_id: animal.id });
    expect(total).toBe(2);
    expect(filas.map((f) => [f.animal_id, f.tipo])).toEqual([
      [animal.id, "castracion"],
      [animal.id, "chipeo"],
    ]);
  });

  it("sin filtro de animal ordena del más reciente al más antiguo", async () => {
    const { otro } = await tresProcedimientos();
    const { filas } = await listarHistorial(BASE);
    expect(filas).toHaveLength(3);
    expect(filas[0].animal_id).toBe(otro.id);
  });

  it("filtra por tipo y por rango de fechas, y busca por chip del animal", async () => {
    const { animal } = await tresProcedimientos();
    expect((await listarHistorial({ ...BASE, tipo: "castracion" })).total).toBe(2);
    expect((await listarHistorial({ ...BASE, desde: hoyLocal(), hasta: hoyLocal() })).total).toBe(3);
    expect((await listarHistorial({ ...BASE, hasta: sumarDias(hoyLocal(), -1) })).total).toBe(0);

    const porChip = await listarHistorial({ ...BASE, busqueda: CHIP });
    expect(porChip.total).toBe(2);
    expect(porChip.filas.every((f) => f.animal_id === animal.id && f.numero_chip === CHIP)).toBe(true);
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run tests/services/historial.test.ts`
Expected: FAIL (no existe `@/services/historial`).

- [ ] **Step 3: `src/services/historial.ts`**

```ts
import { Op } from "sequelize";
import type { TipoProcedimiento } from "@/lib/constantes";
import { condicionBusqueda } from "@/lib/busqueda";
import { HistorialClinico } from "@/lib/db";
import { nombreAnimal } from "@/lib/etiquetas";
import { instanteLocal, sumarDias } from "@/lib/fechas";
import type { ResultadoPaginado } from "@/schemas/comun";
import type { ParametrosListadoHistorial } from "@/schemas/historial";
import { paginacion } from "./comun";

/** Entrada del historial clínico (F8). Animal y fecha se obtienen del procedimiento y su turno. */
export interface HistorialDto {
  id: number;
  procedimiento_id: number;
  /** Fecha y hora del procedimiento en ISO 8601. */
  fecha: string;
  tipo: TipoProcedimiento;
  descripcion: string;
  animal_id: number;
  animal: string;
  /** Chip actual del animal. */
  numero_chip: string | null;
  /** "Apellido, Nombre" de quien registró el procedimiento. */
  veterinario: string;
}

/**
 * Consulta del historial (solo lectura). Filtrado por animal se ordena cronológicamente
 * (la vida clínica del animal); sin animal, del más reciente al más antiguo.
 */
export async function listarHistorial(parametros: ParametrosListadoHistorial): Promise<ResultadoPaginado<HistorialDto>> {
  const direccion = parametros.animal_id ? "ASC" : "DESC";
  const { rows, count } = await HistorialClinico.findAndCountAll({
    // Alias de Sequelize para modelos anidados: "procedimiento->turno->animal".
    where: condicionBusqueda(
      ["procedimiento->turno->animal.nombre", "procedimiento->turno->animal.numero_chip", "procedimiento->veterinario.apellido"],
      parametros.busqueda,
    ),
    include: [
      {
        association: "procedimiento",
        required: true,
        attributes: ["id", "tipo", "fecha"],
        where: {
          [Op.and]: [
            parametros.tipo ? { tipo: parametros.tipo } : {},
            // Días locales completos: desde las 00:00 de "desde" hasta antes de las 00:00 del día siguiente a "hasta".
            parametros.desde ? { fecha: { [Op.gte]: instanteLocal(parametros.desde, "00:00") } } : {},
            parametros.hasta ? { fecha: { [Op.lt]: instanteLocal(sumarDias(parametros.hasta, 1), "00:00") } } : {},
          ],
        },
        include: [
          { association: "veterinario", attributes: ["id", "nombre", "apellido"] },
          {
            association: "turno",
            required: true,
            attributes: ["id", "animal_id"],
            where: parametros.animal_id ? { animal_id: parametros.animal_id } : undefined,
            include: [{ association: "animal", attributes: ["id", "nombre", "numero_chip"] }],
          },
        ],
      },
    ],
    order: [["procedimiento", "fecha", direccion], ["id", direccion]],
    ...paginacion(parametros),
  });

  return {
    filas: rows.map((entrada) => {
      const procedimiento = entrada.procedimiento!;
      const animal = procedimiento.turno!.animal!;
      return {
        id: entrada.id,
        procedimiento_id: procedimiento.id,
        fecha: procedimiento.fecha.toISOString(),
        tipo: procedimiento.tipo,
        descripcion: entrada.descripcion,
        animal_id: animal.id,
        animal: nombreAnimal(animal),
        numero_chip: animal.numero_chip,
        veterinario: `${procedimiento.veterinario!.apellido}, ${procedimiento.veterinario!.nombre}`,
      };
    }),
    total: count,
    pagina: parametros.pagina,
    tamanio: parametros.tamanio,
  };
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npx vitest run tests/services/historial.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Correr toda la suite**

Run: `npm test`
Expected: PASS (118 previos + 1 + 9 + 3 = 131 tests).

---

### Task 6: API REST

**Files:** (todos nuevos)
- `src/app/api/procedimientos/route.ts`, `src/app/api/procedimientos/turnos/route.ts`, `src/app/api/historial/route.ts`, `src/app/api/insumos/opciones/route.ts`

- [ ] **Step 1: `src/app/api/procedimientos/route.ts`**

```ts
import { NextResponse } from "next/server";
import { leerCuerpo, manejarApi } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { esquemaProcedimiento } from "@/schemas/procedimientos";
import { registrarProcedimiento } from "@/services/procedimientos";

/** POST /api/procedimientos — registra un procedimiento (solo veterinarios habilitados). */
export const POST = manejarApi(async (request) => {
  const sesion = await requerirSesion("procedimientos:registrar");
  const datos = await leerCuerpo(request, esquemaProcedimiento);
  return NextResponse.json(await registrarProcedimiento(datos, sesion.usuarioId), { status: 201 });
});
```

- [ ] **Step 2: `src/app/api/procedimientos/turnos/route.ts`**

```ts
import { NextResponse } from "next/server";
import { manejarApi } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { turnosParaAtender } from "@/services/procedimientos";

/** GET /api/procedimientos/turnos — turnos que el veterinario en sesión puede atender ahora. */
export const GET = manejarApi(async () => {
  const sesion = await requerirSesion("procedimientos:registrar");
  return NextResponse.json(await turnosParaAtender(sesion.usuarioId));
});
```

- [ ] **Step 3: `src/app/api/historial/route.ts`**

```ts
import { NextResponse } from "next/server";
import { leerParametros, manejarApi } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { esquemaListadoHistorial } from "@/schemas/historial";
import { listarHistorial } from "@/services/historial";

/** GET /api/historial?pagina=&tamanio=&busqueda=&animal_id=&tipo=&desde=&hasta= — consulta (todos los roles). */
export const GET = manejarApi(async (request) => {
  await requerirSesion("historial:ver");
  return NextResponse.json(await listarHistorial(leerParametros(request, esquemaListadoHistorial)));
});
```

- [ ] **Step 4: `src/app/api/insumos/opciones/route.ts`**

```ts
import { NextResponse } from "next/server";
import { manejarApi } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { opcionesInsumos } from "@/services/insumos";

/** GET /api/insumos/opciones — insumos con stock disponible, para el formulario de procedimientos. */
export const GET = manejarApi(async () => {
  await requerirSesion("insumos:ver");
  return NextResponse.json(await opcionesInsumos());
});
```

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit`
Expected: sin errores.

---

### Task 7: Pantalla de procedimientos (veterinario)

**Files:**
- Modify: `src/lib/navegacion.ts`
- Create: `src/components/procedimientos/formulario-procedimiento.tsx`, `src/components/procedimientos/turnos-para-atender.tsx`, `src/app/(panel)/procedimientos/page.tsx`

- [ ] **Step 1: `src/lib/navegacion.ts`**

1a. Reemplazar el import completo de `lucide-react` por (se agregan `ClipboardList` y `Syringe`):

```ts
import {
  CalendarClock, CalendarDays, ClipboardList, LayoutDashboard, Mail, MapPin, Package, PawPrint, Stethoscope,
  Syringe, UserCog, Users, type LucideIcon,
} from "lucide-react";
```

1b. Agregar estos dos ítems inmediatamente después del ítem "Turnos":

```ts
  { titulo: "Procedimientos", href: "/procedimientos", icono: Syringe, accion: "procedimientos:registrar" },
  { titulo: "Historial clínico", href: "/historial", icono: ClipboardList, accion: "historial:ver" },
```

- [ ] **Step 2: `src/components/procedimientos/formulario-procedimiento.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CampoFormulario } from "@/components/comunes/campo-formulario";
import { ConfirmarDialogo } from "@/components/comunes/confirmar-dialogo";
import { FormularioDialogo } from "@/components/comunes/formulario-dialogo";
import { SelectOpciones } from "@/components/comunes/select-opciones";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { llamarApi } from "@/lib/cliente-api";
import { incluyeChipeo, TIPOS_PROCEDIMIENTO, tipoIncluido } from "@/lib/constantes";
import { ETIQUETAS_TIPO_PROCEDIMIENTO } from "@/lib/etiquetas";
import { mostrarErrorFormulario } from "@/lib/formularios";
import { esquemaProcedimiento, type DatosProcedimiento } from "@/schemas/procedimientos";
import type { TurnoDto } from "@/services/turnos";

/** Clases de un textarea con el mismo aspecto que `Input` (no hay componente Textarea instalado). */
const CLASES_TEXTAREA =
  "min-h-20 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none " +
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * Registro de procedimiento (F7). Solo ofrece los tipos incluidos en lo solicitado, pide el
 * chip si corresponde y una lista de insumos usados. Antes de enviar pide confirmación,
 * porque la operación no se puede deshacer.
 */
export function FormularioProcedimiento({ turno, onCerrar, onGuardado }: {
  turno: TurnoDto;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const { register, control, handleSubmit, setError, formState } = useForm<DatosProcedimiento>({
    resolver: zodResolver(esquemaProcedimiento),
    defaultValues: {
      turno_id: turno.id,
      tipo: turno.tipo_solicitado,
      numero_chip_colocado: "",
      observaciones: "",
      insumos: [],
    },
  });
  const insumos = useFieldArray({ control, name: "insumos" });
  const tipo = useWatch({ control, name: "tipo" });
  const [porConfirmar, setPorConfirmar] = useState<DatosProcedimiento | null>(null);

  /** Envía los datos ya validados y confirmados. */
  async function registrar() {
    if (!porConfirmar) return;
    try {
      await llamarApi("/api/procedimientos", { metodo: "POST", cuerpo: porConfirmar });
      toast.success("Procedimiento registrado: el turno quedó completado");
      setPorConfirmar(null);
      onGuardado();
    } catch (error) {
      setPorConfirmar(null);
      mostrarErrorFormulario(error, setError, "No se pudo registrar el procedimiento");
    }
  }

  const tiposPermitidos = TIPOS_PROCEDIMIENTO.filter((valor) => tipoIncluido(valor, turno.tipo_solicitado));
  const errores = formState.errors;
  return (
    <>
      <FormularioDialogo
        titulo={`Procedimiento de ${turno.animal}`}
        descripcion={`Solicitado: ${ETIQUETAS_TIPO_PROCEDIMIENTO[turno.tipo_solicitado]} · ${turno.horario} · ${turno.lugar}`}
        idFormulario="formulario-procedimiento"
        enviando={porConfirmar !== null}
        textoEnviar="Registrar"
        amplio
        onCerrar={onCerrar}
      >
        <form
          id="formulario-procedimiento"
          onSubmit={handleSubmit((datos) => setPorConfirmar(datos))}
          className="grid gap-4"
          noValidate
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoFormulario id="tipo" etiqueta="Procedimiento realizado" error={errores.tipo?.message}>
              <NativeSelect id="tipo" className="w-full" {...register("tipo")}>
                {tiposPermitidos.map((valor) => (
                  <NativeSelectOption key={valor} value={valor}>{ETIQUETAS_TIPO_PROCEDIMIENTO[valor]}</NativeSelectOption>
                ))}
              </NativeSelect>
            </CampoFormulario>
            {incluyeChipeo(tipo) && (
              <CampoFormulario id="numero_chip_colocado" etiqueta="Chip colocado (15 dígitos)" error={errores.numero_chip_colocado?.message}>
                <Input id="numero_chip_colocado" inputMode="numeric" {...register("numero_chip_colocado")} />
              </CampoFormulario>
            )}
          </div>

          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">Insumos usados</legend>
            {insumos.fields.length === 0 && (
              <p className="text-sm text-muted-foreground">Sin insumos. Agregue los que se usaron.</p>
            )}
            {insumos.fields.map((campo, indice) => (
              <div key={campo.id} className="grid grid-cols-[minmax(0,1fr)_8rem_auto] items-start gap-2">
                <div className="grid gap-1">
                  <Controller
                    control={control}
                    name={`insumos.${indice}.insumo_id`}
                    render={({ field }) => (
                      <SelectOpciones
                        id={`insumo-${indice}`}
                        url="/api/insumos/opciones"
                        valor={field.value}
                        onCambiar={field.onChange}
                        placeholder="Insumo…"
                        invalido={!!errores.insumos?.[indice]?.insumo_id}
                      />
                    )}
                  />
                  {errores.insumos?.[indice]?.insumo_id && (
                    <p className="text-sm text-destructive" role="alert">{errores.insumos[indice]?.insumo_id?.message}</p>
                  )}
                </div>
                <div className="grid gap-1">
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    aria-label="Cantidad"
                    placeholder="Cantidad"
                    {...register(`insumos.${indice}.cantidad`, { valueAsNumber: true })}
                  />
                  {errores.insumos?.[indice]?.cantidad && (
                    <p className="text-sm text-destructive" role="alert">{errores.insumos[indice]?.cantidad?.message}</p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Quitar insumo"
                  title="Quitar insumo"
                  onClick={() => insumos.remove(indice)}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
            {(errores.insumos?.message ?? errores.insumos?.root?.message) && (
              <p className="text-sm text-destructive" role="alert">
                {errores.insumos?.message ?? errores.insumos?.root?.message}
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              className="justify-self-start"
              onClick={() => insumos.append({ insumo_id: null as unknown as number, cantidad: undefined as unknown as number })}
            >
              <Plus /> Agregar insumo
            </Button>
          </fieldset>

          <CampoFormulario id="observaciones" etiqueta="Observaciones (opcional)" error={errores.observaciones?.message}>
            <textarea id="observaciones" className={CLASES_TEXTAREA} {...register("observaciones")} />
          </CampoFormulario>
        </form>
      </FormularioDialogo>

      <ConfirmarDialogo
        abierto={porConfirmar !== null}
        titulo="Confirmar registro"
        descripcion="Se descontará el stock de los insumos, el turno quedará completado y se creará la entrada del historial clínico. Esta operación no se puede deshacer."
        textoConfirmar="Registrar"
        onConfirmar={registrar}
        onCerrar={() => setPorConfirmar(null)}
      />
    </>
  );
}
```

- [ ] **Step 3: `src/components/procedimientos/turnos-para-atender.tsx`**

```tsx
"use client";

import { useState } from "react";
import useSWR from "swr";
import { Syringe } from "lucide-react";
import { TablaDatos, type Columna } from "@/components/comunes/tabla-datos";
import { Button } from "@/components/ui/button";
import { obtenerJson } from "@/lib/cliente-api";
import { ETIQUETAS_TIPO_PROCEDIMIENTO } from "@/lib/etiquetas";
import type { TurnosParaAtender as DatosTurnosParaAtender } from "@/services/procedimientos";
import type { TurnoDto } from "@/services/turnos";
import { FormularioProcedimiento } from "./formulario-procedimiento";

/** Turnos confirmados de los operativos en curso del veterinario, con el registro de procedimiento (F7). */
export function TurnosParaAtender() {
  const { data, isLoading, mutate } = useSWR<DatosTurnosParaAtender>("/api/procedimientos/turnos", obtenerJson);
  const [aRegistrar, setARegistrar] = useState<TurnoDto | null>(null);

  if (data && !data.habilitado) {
    return <p className="rounded-lg border p-4 text-sm text-muted-foreground">{data.motivo}</p>;
  }

  const columnas: Columna<TurnoDto>[] = [
    { titulo: "Hora", celda: (t) => t.horario },
    { titulo: "Animal", celda: (t) => t.animal },
    { titulo: "Tutor", celda: (t) => t.tutor ?? "Sin tutor" },
    { titulo: "Solicitado", celda: (t) => ETIQUETAS_TIPO_PROCEDIMIENTO[t.tipo_solicitado] },
    { titulo: "Lugar", celda: (t) => `${t.lugar} (${t.zona})` },
    {
      titulo: "Acción",
      className: "w-36 text-right",
      celda: (t) => (
        <Button size="sm" onClick={() => setARegistrar(t)}>
          <Syringe /> Registrar
        </Button>
      ),
    },
  ];

  return (
    <>
      <TablaDatos
        columnas={columnas}
        filas={data?.turnos}
        claveFila={(t) => t.id}
        cargando={isLoading}
        mensajeVacio="No tiene turnos confirmados en operativos en curso"
      />
      {aRegistrar && (
        <FormularioProcedimiento
          turno={aRegistrar}
          onCerrar={() => setARegistrar(null)}
          onGuardado={async () => {
            setARegistrar(null);
            await mutate();
          }}
        />
      )}
    </>
  );
}
```

- [ ] **Step 4: `src/app/(panel)/procedimientos/page.tsx`**

```tsx
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { TurnosParaAtender } from "@/components/procedimientos/turnos-para-atender";
import { exigirPermisoPagina } from "@/lib/sesion";

/** F7 — Registro de procedimientos (solo veterinarios). */
export default async function PaginaProcedimientos() {
  await exigirPermisoPagina("procedimientos:registrar");
  return (
    <>
      <EncabezadoPagina
        titulo="Registrar procedimientos"
        descripcion="Turnos confirmados de los operativos en curso a los que está asignado."
      />
      <TurnosParaAtender />
    </>
  );
}
```

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit` y `npm run lint`
Expected: tsc sin errores; lint con 0 errores (1 advertencia previa aceptada en `src/lib/cliente-api.ts`).

---

### Task 8: Pantalla de historial clínico y acceso desde animales

**Files:**
- Create: `src/components/historial/historial-clinico.tsx`, `src/app/(panel)/historial/page.tsx`
- Modify: `src/components/animales/gestion-animales.tsx`

- [ ] **Step 1: `src/components/historial/historial-clinico.tsx`**

```tsx
"use client";

import Link from "next/link";
import useSWR from "swr";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FiltroSelect } from "@/components/comunes/filtro-select";
import { ListadoPaginado } from "@/components/comunes/listado-paginado";
import type { Columna } from "@/components/comunes/tabla-datos";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useListado } from "@/hooks/use-listado";
import { obtenerJson } from "@/lib/cliente-api";
import { ETIQUETAS_TIPO_PROCEDIMIENTO, nombreAnimal, opcionesDeEtiquetas } from "@/lib/etiquetas";
import { formatearFechaHora } from "@/lib/fechas";
import type { AnimalDto } from "@/services/animales";
import type { HistorialDto } from "@/services/historial";

/**
 * Consulta del historial clínico (F8, solo lectura). Con `animalId` muestra la vida clínica
 * de ese animal en orden cronológico; sin él, todas las entradas de la más reciente a la más antigua.
 */
export function HistorialClinico({ animalId }: { animalId?: number }) {
  const listado = useListado<HistorialDto>("/api/historial", {
    animal_id: animalId ? String(animalId) : "",
    tipo: "",
    desde: "",
    hasta: "",
  });
  const { data: animal } = useSWR<AnimalDto>(animalId ? `/api/animales/${animalId}` : null, obtenerJson);

  const columnas: Columna<HistorialDto>[] = [
    { titulo: "Fecha", celda: (h) => formatearFechaHora(h.fecha) },
    ...(animalId
      ? []
      : [{
          titulo: "Animal",
          celda: (h: HistorialDto) => (
            <Link href={`/historial?animal=${h.animal_id}`} className="font-medium underline-offset-4 hover:underline">
              {h.animal}
            </Link>
          ),
        }]),
    { titulo: "Procedimiento", celda: (h) => ETIQUETAS_TIPO_PROCEDIMIENTO[h.tipo] },
    { titulo: "Veterinario/a", celda: (h) => h.veterinario },
    {
      titulo: "Descripción",
      celda: (h) => <span className="block max-w-md text-sm whitespace-normal">{h.descripcion}</span>,
    },
  ];

  return (
    <>
      <EncabezadoPagina
        titulo={animal ? `Historial clínico de ${nombreAnimal(animal)}` : "Historial clínico"}
        descripcion={
          animal
            ? `Chip: ${animal.numero_chip ?? "sin chip"} · Tutor: ${animal.tutor ?? "sin tutor"}. Orden cronológico.`
            : "Procedimientos registrados (solo consulta). Elija un animal para ver su historial completo."
        }
        acciones={
          animalId && (
            <Link href="/historial" className={buttonVariants({ variant: "outline" })}>Ver todos</Link>
          )
        }
      />
      <ListadoPaginado
        listado={listado}
        columnas={columnas}
        claveFila={(h) => h.id}
        placeholderBusqueda={animalId ? undefined : "Buscar por animal, chip o veterinario/a"}
        mensajeVacio="No hay procedimientos registrados"
        filtros={
          <>
            <FiltroSelect
              etiqueta="Procedimiento"
              valor={listado.filtros.tipo}
              opciones={opcionesDeEtiquetas(ETIQUETAS_TIPO_PROCEDIMIENTO)}
              etiquetaTodos="Todos los procedimientos"
              onCambiar={(valor) => listado.filtrar("tipo", valor)}
            />
            <Input
              type="date"
              aria-label="Desde"
              title="Desde"
              className="w-auto"
              value={listado.filtros.desde}
              onChange={(evento) => listado.filtrar("desde", evento.target.value)}
            />
            <Input
              type="date"
              aria-label="Hasta"
              title="Hasta"
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

- [ ] **Step 2: `src/app/(panel)/historial/page.tsx`**

```tsx
import { HistorialClinico } from "@/components/historial/historial-clinico";
import { exigirPermisoPagina } from "@/lib/sesion";
import { esquemaId } from "@/schemas/comun";

/** F8 — Historial clínico (consulta para todos los roles). `?animal=ID` filtra por animal. */
export default async function PaginaHistorial({ searchParams }: { searchParams: Promise<{ animal?: string }> }) {
  await exigirPermisoPagina("historial:ver");
  const animal = esquemaId.safeParse((await searchParams).animal);
  const animalId = animal.success ? animal.data : undefined;
  // La clave reinicia los filtros al cambiar de animal.
  return <HistorialClinico key={animalId ?? "todos"} animalId={animalId} />;
}
```

- [ ] **Step 3: `src/components/animales/gestion-animales.tsx` — enlace "Ver historial"**

3a. Agregar los imports (debajo de `"use client";` y junto a los existentes):

```tsx
import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";
```

(eliminar la línea anterior `import { Plus } from "lucide-react";`) y reemplazar `import { Button } from "@/components/ui/button";` por:

```tsx
import { Button, buttonVariants } from "@/components/ui/button";
```

3b. En el arreglo `columnas`, insertar inmediatamente antes de la línea `...(puedeGestionar` esta columna (visible para todos los roles):

```tsx
    {
      titulo: "Historial",
      className: "w-20 text-center",
      celda: (a) => (
        <Link
          href={`/historial?animal=${a.id}`}
          className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
          aria-label="Ver historial clínico"
          title="Ver historial clínico"
        >
          <ClipboardList />
        </Link>
      ),
    },
```

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit` y `npm run lint`
Expected: sin errores; lint con la única advertencia previa.

---

### Task 9: Refactorización, verificación completa y punto de control

**Files:**
- Create: `tests/humo/fase4.mjs`
- Modify: `docs/superpowers/desviaciones/fase4.md`

- [ ] **Step 1: Revisión de duplicación**

Buscar con el buscador del editor y corregir si aparece (registrar en desviaciones cualquier cambio fuera del plan):
- Descuentos de stock que no pasen por `ajustarStock()` (en `src/services/`).
- Literales de tipos de procedimiento (`"castracion"`, `"chipeo"`) usados para decidir lógica fuera de `incluyeCastracion()`, `incluyeChipeo()` y `tipoIncluido()`.
- Indexaciones de `ETIQUETAS_*` con columnas `CreationOptional` sin el cast (lección L1).

- [ ] **Step 2: Verificación estática y tests**

Run: `npx tsc --noEmit` → sin errores.
Run: `npm run lint` → 0 errores (1 advertencia previa aceptada en `src/lib/cliente-api.ts`).
Run: `npm test` → PASS, 131 tests.

- [ ] **Step 3: Crear la prueba de humo `tests/humo/fase4.mjs`**

```js
/**
 * Prueba de humo de la Fase 4 contra el servidor de producción (`next start`).
 * Prepara por la API un operativo en curso con un veterinario asignado y un turno
 * confirmado, y verifica el registro de procedimiento: permisos (403), rollback por stock
 * insuficiente, validación del chip, registro exitoso y su efecto en stock, animal e historial.
 * Uso (desde la raíz del proyecto, antes de las 22:55 hora de Río Grande):
 *   node tests/humo/fase4.mjs [url-base]
 */
try {
  process.loadEnvFile(".env");
} catch {
  // Sin .env se usan los valores por defecto de .env.example.
}

const BASE = process.argv[2] ?? "http://localhost:3107";
/** Cookie de sesión por usuario: se prueban dos roles a la vez. */
const cookies = { admin: "", vet: "" };

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

/** Corta la prueba con el detalle si una verificación falla. */
function verificar(paso, condicion, detalle) {
  if (!condicion) {
    console.error(`✗ ${paso}`, detalle === undefined ? "" : JSON.stringify(detalle));
    process.exit(1);
  }
  console.log(`✓ ${paso}`);
}

/** HH:MM a partir de minutos desde la medianoche. */
const hhmm = (minutos) => `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;

// Fecha y hora local de Río Grande (UTC-3). El operativo empieza en 5 minutos y dura 1 hora.
const ahoraLocal = new Date(Date.now() - 3 * 3_600_000);
const hoy = ahoraLocal.toISOString().slice(0, 10);
const inicio = ahoraLocal.getUTCHours() * 60 + ahoraLocal.getUTCMinutes() + 5;
if (inicio + 60 >= 24 * 60) {
  console.error("Ejecute la prueba antes de las 22:55 (hora de Río Grande): el operativo debe ser de hoy.");
  process.exit(1);
}

const sufijo = String(Date.now()).slice(-7);
const chip = String(Date.now()).padStart(15, "9");
const passwordVet = "Clave1234";

// 1) Administrador: datos base
let r = await llamar("admin", "POST", "/api/auth/login", {
  email: process.env.SEED_ADMIN_EMAIL ?? "admin@sigcan.local",
  password: process.env.SEED_ADMIN_PASSWORD ?? "Admin1234",
});
verificar("login del administrador", r.estado === 200, r);
r = await llamar("admin", "GET", "/api/zonas/opciones");
const zonaId = r.datos[0].id;
r = await llamar("admin", "POST", "/api/vecinos", {
  nombre: "Humo", apellido: "Fase Cuatro", dni: `8${sufijo}`, telefono: "2964000000",
  email: "", direccion: "Calle 4", zona_id: zonaId,
});
verificar("alta de vecino", r.estado === 201, r);
r = await llamar("admin", "POST", "/api/animales", {
  nombre: "Humo 4", raza: "", sexo: "H", edad_estimada: 2, condicion: "con_tutor",
  vecino_id: r.datos.id, numero_chip: "", castrado: false,
});
verificar("alta de animal", r.estado === 201, r);
const animalId = r.datos.id;
r = await llamar("admin", "POST", "/api/insumos", { nombre: `Humo Ketamina ${sufijo}`, unidad: "ml", stock_minimo: 1, stock_inicial: 10 });
verificar("alta de insumo con 10 ml", r.estado === 201, r);
const insumoId = r.datos.id;

// 2) Usuario veterinario y su registro de personal vinculado
const emailVet = `humo.vet.${sufijo}@prueba.local`;
r = await llamar("admin", "POST", "/api/usuarios", {
  nombre: "Vera", apellido: "Humo", email: emailVet, rol: "veterinario", activo: true, password: passwordVet,
});
verificar("alta de usuario veterinario", r.estado === 201, r);
r = await llamar("admin", "POST", "/api/personal", {
  tipo: "veterinario", nombre: "Vera", apellido: "Humo", matricula: `H${sufijo}`, especialidad: "", telefono: "",
  activo: true, usuario_id: r.datos.id,
});
verificar("alta de personal vinculado", r.estado === 201, r);
const personalId = r.datos.id;

// 3) Operativo de hoy, personal asignado, turno confirmado y operativo en curso
r = await llamar("admin", "POST", "/api/operativos", {
  fecha: hoy, hora_inicio: hhmm(inicio), hora_fin: hhmm(inicio + 60), lugar: "SUM humo 4", cupo_maximo: 5, zona_id: zonaId,
});
verificar("alta de operativo de hoy", r.estado === 201, r);
const operativoId = r.datos.id;
r = await llamar("admin", "POST", `/api/operativos/${operativoId}/personal`, { veterinario_id: personalId });
verificar("asignación del veterinario", r.estado === 200 && r.datos.personal.length === 1, r);
r = await llamar("admin", "POST", "/api/turnos", {
  animal_id: animalId, operativo_id: operativoId, horario: hhmm(inicio), tipo_solicitado: "castracion_y_chipeo",
});
verificar("solicitud de turno", r.estado === 201, r);
const turnoId = r.datos.id;
r = await llamar("admin", "POST", `/api/turnos/${turnoId}/confirmar`);
verificar("confirmación del turno", r.estado === 200, r);
r = await llamar("admin", "POST", `/api/operativos/${operativoId}/estado`, { estado: "en_curso" });
verificar("inicio del operativo", r.estado === 200, r);

const datosProcedimiento = {
  turno_id: turnoId, tipo: "castracion_y_chipeo", numero_chip_colocado: chip, observaciones: "Prueba de humo",
  insumos: [{ insumo_id: insumoId, cantidad: 2.5 }],
};

// 4) Permisos: el administrador no registra procedimientos
r = await llamar("admin", "POST", "/api/procedimientos", datosProcedimiento);
verificar("el administrador recibe 403 al registrar", r.estado === 403, r);
r = await llamar(null, "POST", "/api/procedimientos", datosProcedimiento);
verificar("sin sesión → 401", r.estado === 401, r);

// 5) Veterinario: turnos para atender, rollback, validación y registro exitoso
r = await llamar("vet", "POST", "/api/auth/login", { email: emailVet, password: passwordVet });
verificar("login del veterinario", r.estado === 200, r);
r = await llamar("vet", "GET", "/api/procedimientos/turnos");
verificar("el turno figura para atender", r.datos.habilitado && r.datos.turnos.some((t) => t.id === turnoId), r);

r = await llamar("vet", "POST", "/api/procedimientos", { ...datosProcedimiento, insumos: [{ insumo_id: insumoId, cantidad: 50 }] });
verificar("stock insuficiente → 409 con mensaje", r.estado === 409 && r.datos.error.mensaje.includes("Stock insuficiente"), r);
r = await llamar("vet", "GET", `/api/insumos/${insumoId}`);
verificar("rollback: el stock sigue en 10,00", r.datos.stock_actual === "10.00", r);
r = await llamar("vet", "POST", "/api/procedimientos", { ...datosProcedimiento, numero_chip_colocado: "12" });
verificar("chip inválido → 400 en el campo", r.estado === 400 && r.datos.error.campos?.numero_chip_colocado, r);

r = await llamar("vet", "POST", "/api/procedimientos", datosProcedimiento);
verificar("registro del procedimiento (201)", r.estado === 201 && r.datos.numero_chip_colocado === chip, r);
r = await llamar("vet", "POST", "/api/procedimientos", datosProcedimiento);
verificar("no se registra dos veces el mismo turno → 409", r.estado === 409, r);

r = await llamar("vet", "GET", `/api/insumos/${insumoId}`);
verificar("stock descontado a 7,50", r.datos.stock_actual === "7.50", r);
r = await llamar("vet", "GET", `/api/animales/${animalId}`);
verificar("animal castrado y con chip", r.datos.castrado === true && r.datos.numero_chip === chip, r);
r = await llamar("vet", "GET", `/api/historial?animal_id=${animalId}`);
verificar("entrada de historial con el chip", r.datos.total === 1 && r.datos.filas[0].descripcion.includes(chip), r);
r = await llamar("vet", "GET", "/api/procedimientos/turnos");
verificar("el turno ya no figura para atender", !r.datos.turnos.some((t) => t.id === turnoId), r);

// 6) Páginas
for (const pagina of ["/procedimientos", "/historial", `/historial?animal=${animalId}`]) {
  r = await llamar("vet", "GET", pagina);
  verificar(`GET ${pagina} (veterinario) → 200`, r.estado === 200, r.estado);
}

console.log("\nPrueba de humo de la Fase 4: OK");
```

- [ ] **Step 4: Build y prueba de humo contra la base de test**

Run: `npm run db:reset:test`
Run: `npm run build`
Expected: build exitoso.

Levantar el servidor apuntando a la base de test y con SMTP desactivado (en otra terminal; PowerShell):

```powershell
$env:DATABASE_URL = "postgres://sigcan:sigcan@localhost:5433/sigcan_test"; $env:SMTP_HOST = ""; npx next start -p 3107
```

(En bash: `DATABASE_URL=postgres://sigcan:sigcan@localhost:5433/sigcan_test SMTP_HOST= npx next start -p 3107`.)

Run: `node tests/humo/fase4.mjs http://localhost:3107`
Expected: todas las líneas con `✓` y al final `Prueba de humo de la Fase 4: OK`. Además, volver a correr `node tests/humo/fase3.mjs http://localhost:3107` → `Prueba de humo de la Fase 3: OK` (regresión).

Detener el servidor (Ctrl+C) y verificar que no quede ningún proceso escuchando en el puerto 3107.

- [ ] **Step 5: Recorrido manual por rol (navegador)**

- **Veterinario vinculado y asignado:** ve "Procedimientos" e "Historial clínico" en el menú; con un operativo en curso ve sus turnos confirmados; registra uno con chip e insumos (aparece la confirmación); el turno desaparece de la lista y el historial del animal muestra la entrada.
- **Veterinario sin vínculo con el personal:** en "Procedimientos" ve el mensaje "Su usuario no está vinculado…".
- **Administrador y operador:** no ven "Procedimientos"; `/procedimientos` los redirige al inicio. Ven "Historial clínico" y el ícono de historial en la lista de animales.

- [ ] **Step 6: Desviaciones y punto de control**

Completar `docs/superpowers/desviaciones/fase4.md` (o dejar "Sin desviaciones.") con: cambios respecto del plan, resultado de `npm test` (cantidad de tests) y de las pruebas de humo de las Fases 3 y 4.

**Punto de control:** detenerse y avisar al usuario que la Fase 4 está lista para commitear (no ejecutar git).
