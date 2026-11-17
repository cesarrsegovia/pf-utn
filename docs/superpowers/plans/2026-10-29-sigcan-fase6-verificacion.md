# SIGCAN Fase 6 (Verificación: datos de demostración, recorridos, usabilidad y README) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar el sistema listo para la entrega de la Fase 3 de la consigna ("software operativo y estable"): un escenario de demostración realista que se carga con un comando, recorridos completos por rol documentados, corrección de lo que aparezca en esos recorridos, ajustes de usabilidad (páginas de error, 404, carga y títulos de pestaña) y el README final.

**Architecture:** No hay funcionalidades nuevas. El seed de demostración (`db/seeders/demo.ts`) escribe el pasado directamente con los modelos (los servicios no permiten operativos con fecha pasada), pero replica cada efecto de F7: stock y movimientos, uso de insumos, animal castrado/chipeado, turno completado e historial clínico con la misma redacción que el servicio (`redactarDescripcion`, que se exporta). Las fechas son relativas al día en que se ejecuta. Un test (`tests/db/demo.test.ts`) y una prueba de humo (`tests/humo/fase6.mjs`) fijan los valores del escenario.

**Tech Stack:** Next.js 16.4.3, Sequelize 6, Zod 4, Vitest 3. **Sin dependencias nuevas.**

**Spec:** `docs/superpowers/specs/2026-10-28-sigcan-design.md` — §8 (seed demo, checklist de recorridos por rol) y fila "6. Verificación" de la tabla de fases. Consigna (`docs/Trabajo Final Integrador 2026.pdf`, Fase 3: Desarrollo): funcionalidades completas, verificación interna con recorridos, corrección de errores detectados y ajustes de usabilidad.

---

## 0. Reglas para quien implemente (leer antes de empezar)

1. **Git:** no ejecutar ningún comando de git (ni siquiera `git status`). Los "Puntos de control" son avisos al usuario (ver `CLAUDE.md`).
2. **Desviaciones:** crear `docs/superpowers/desviaciones/fase6.md` al empezar (Task 1, Step 1). Copiar el código tal como está; si algo no compila o no funciona, hacer el cambio mínimo, **registrarlo** (archivo, qué decía el plan, qué se cambió y por qué) y dejar un comentario en el código.
3. **Tests:** prohibido modificar un test del plan para que pase. Si un valor esperado del escenario no coincide (ej.: 16 castrados), el error está en el seed, no en el test: buscarlo y registrarlo. Los tests de fases anteriores no se tocan.
4. **Dependencias:** no instalar nada. No ejecutar `npx shadcn add`.
5. **Modelos y migraciones:** no se crean ni modifican (`src/models/*`, `db/migrations/*`).
6. **Reglas de negocio:** esta fase **no cambia reglas** de la sección 6 del PDF de la Fase 2 (cupos, 48 h, turno único, cascadas, stock, permisos). Si un recorrido sugiere cambiar una regla, no hacerlo: registrarlo como "Consulta al usuario" (Task 7).
7. **shadcn/ui con Base UI:** usar la prop `render` (nunca `asChild`); enlaces con estilo de botón con `buttonVariants` sobre `<Link>`.
8. **Comentarios:** todo archivo nuevo lleva comentarios profesionales, claros y concisos en español (ya incluidos; mantenerlos).
9. **Correo:** no escribir credenciales SMTP en ningún archivo. El único correo real del escenario es `mepotdf@gmail.com` (vecino de prueba de notificaciones); los demás vecinos de la demo no tienen email, para no enviar correos a direcciones inventadas. La prueba con SMTP real la hace el usuario (recorrido R-F12).
10. **Archivos que no se tocan:** `CLAUDE.md`, `AGENTS.md`, `.env`, `src/models/*`, `db/migrations/*` y `docs/` salvo `docs/superpowers/desviaciones/fase6.md` y `docs/verificacion/recorridos.md`.

### 0.1 Lecciones de las fases anteriores (aplicarlas desde el primer archivo)

La revisión de la Fase 5 encontró el código idéntico al plan (28 archivos creados y 13 modificados, 152 tests, humo 28/28), pero **el cierre quedó incompleto**: el entorno bloqueó la terminal, no se corrió la verificación final, se informó "0 diferencias" sin evidencia y el archivo de desviaciones quedó sin números. Se mantienen las lecciones anteriores y se agregan tres:

- **L1 — Índices con `CreationOptional` (TS7053).** Las columnas `CreationOptional<T>` no indexan un `Record<T, string>` directamente: pasar el valor por una función tipada o usar `as T` y registrarlo.
- **L2 — Toda lectura que precede a una actualización se bloquea** (`lock: transaction.LOCK.UPDATE`, sin `include`). Aplica a cualquier corrección de la Task 7.
- **L3 — Autocomparación al cerrar cada Task.** Cada archivo "Create" idéntico a su bloque del plan (salvo desviaciones registradas) y cada bloque "Modify" aplicado.
- **L4 — Valores probados sobre datos controlados.** El escenario de la demo tiene valores conocidos (29 vecinos activos, 16 castrados, cumplimiento 80 %, asistencia 75 %). No ajustar los esperados.
- **L5 — Docker antes de verificar:** `docker compose up -d` y `docker ps` con `sigcan-db … (healthy)`.
- **L6 — Resultados en números absolutos:** `Tests 158 passed`; cada humo con su conteo (`OK (28 verificaciones)` en las Fases 5 y 6; 27 `✓` en la 4; 25 `✓` en la 3).
- **L7 — "Sin desviaciones" solo con evidencia:** después de la autocomparación de **todos** los archivos, indicando cuántos se compararon.
- **L8 (nueva) — Lo no ejecutado se declara.** Si un comando no se pudo ejecutar (terminal bloqueada, sandbox, falta de permisos), **detenerse y avisar al usuario** qué comando y por qué; nunca informar un resultado que no se vio en la salida. En el archivo de desviaciones, cada verificación lleva su resultado o `NO EJECUTADO: <motivo>`.
- **L9 (nueva) — Base limpia antes de las pruebas de humo.** Los humos de las Fases 3 a 5 se corren en el orden 5 → 4 → 3 después de un único `npm run db:reset:test` (el de la Fase 3 falla si se repite sobre la misma base). El de la Fase 6 necesita su propia base: `npm run db:demo:test` con el servidor detenido.
- **L10 (nueva) — Checklist de cierre obligatorio (Task 9, Step 8).** La fase no termina hasta que cada casilla del checklist tenga su evidencia.

## 1. Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/services/procedimientos.ts` (modificar) | Exportar `redactarDescripcion` (la reutiliza el seed demo) |
| `db/seeders/demo.ts` | Escenario de demostración con fechas relativas a hoy |
| `scripts/db.ts` (reemplazar) | Comando `demo` (reinicia la base, siembra datos iniciales y demo) |
| `package.json` (modificar a mano) | Scripts `db:demo` y `db:demo:test` |
| `tests/db/demo.test.ts` | 6 tests del escenario (total: 158) |
| `src/app/(panel)/error.tsx`, `src/app/(panel)/loading.tsx`, `src/app/not-found.tsx` | Error con reintento, estado de carga y página 404 |
| `src/app/layout.tsx` (modificar) | Plantilla de título `%s · SIGCAN` |
| `src/app/(auth)/login/layout.tsx` | Título de la pantalla de ingreso |
| `src/app/(panel)/**/page.tsx` (16, modificar) | `metadata.title` de cada página |
| `tests/humo/fase6.mjs` | Prueba de humo sobre la base de demostración (28 verificaciones) |
| `docs/verificacion/recorridos.md` | Checklist de recorridos por rol con resultados |
| `README.md` (reemplazar) | Instalación, demo, credenciales, correo, scripts, verificación |

## 2. Decisiones de esta fase (para la defensa)

- **Escenario de demostración** (todas las fechas relativas al día en que se ejecuta `npm run db:demo`):
  - **Usuarios:** el administrador del seed inicial más `operador@sigcan.local` / `Operador1234` (Laura Gómez), `veterinaria@sigcan.local` / `Veterinaria1234` (Ana Ríos, MV-1201) y `veterinario@sigcan.local` / `Veterinario1234` (Martín Sosa, MV-1302). Personal: Ana y Martín (veterinarios vinculados a su usuario) y Carla Díaz (auxiliar, sin usuario).
  - **Vecinos:** 30 en 6 zonas (Centro, Chacra II, Chacra IV, Chacra XIII, Margen Sur, Austral). 29 activos; 1 dado de baja hace 20 días. Solo "Vecina Prueba Correo" tiene email: `mepotdf@gmail.com` (su perro "Toby" no tiene turnos; se usa para probar F12).
  - **Animales:** 50 (40 con tutor, 5 callejeros, 5 asilvestrados), ninguno castrado ni chipeado antes de la demo.
  - **Operativos:** 8 realizados (hace 150 a 7 días) con 3 turnos completados (uno de cada tipo, con procedimiento, insumos e historial) y 1 turno "No se presentó" cada uno; 2 cancelados (hace 60 y 21 días, con motivo) con 2 turnos cancelados cada uno; **1 de hoy** programado (09:00–18:00, Centro, Ana y Carla) con 4 turnos confirmados y 1 pendiente; 3 futuros (en 5, 12 y 20 días) con 3 turnos cada uno.
  - **Insumos:** Ketamina, Xilacina, Sutura absorbible, Microchip, Guantes de látex (consumidos por los procedimientos) y Gasas estériles (15 paquetes con mínimo 20: queda **bajo el mínimo**).
  - **Avistamientos:** 18 en los últimos 5 meses; los 4 más recientes pendientes y 14 atendidos.
  - **Valores resultantes:** 16 animales castrados y 16 chipeados; cumplimiento 80 % (8 de 10); asistencia 75 % (24 de 32); Ketamina 460,00 ml.
- **La demo se carga sobre una base limpia:** `npm run db:demo` borra la base de desarrollo y la recrea (esquema, datos iniciales y demo). Conviene ejecutarlo el mismo día del recorrido o de la defensa, para que el operativo "de hoy" sea realmente de hoy.
- **Usabilidad:** error de página con botón "Reintentar" (Next 16 entrega `retry`, no `reset`), estado de carga del panel, 404 en español con vuelta al inicio y títulos de pestaña por página (`Vecinos · SIGCAN`).
- **Recorridos:** el checklist (`docs/verificacion/recorridos.md`) es la evidencia de la "verificación interna del equipo" que pide la consigna. Cada paso tiene resultado esperado y resultado obtenido.

---

### Task 1: Preparación y línea de base

**Files:**
- Create: `docs/superpowers/desviaciones/fase6.md`

- [ ] **Step 1: Crear el archivo de desviaciones**

```markdown
# Registro de desviaciones — Fase 6 (Verificación)

## Cambios respecto del plan

(ninguno por ahora)

## Hallazgos de los recorridos

(ninguno por ahora)

## Verificación

(se completa en la Task 9)
```

- [ ] **Step 2: Comprobar que la terminal funciona (lección L8)**

Run: `node --version`
Expected: una versión (ej.: `v22.x`). Si el entorno bloquea el comando (sandbox de terminal o política de ejecución), **detenerse** y avisar al usuario que debe habilitar la ejecución de comandos; no continuar.

- [ ] **Step 3: Levantar la base (lección L5)**

Run: `docker compose up -d`
Run: `docker ps --format "{{.Names}} {{.Status}}"`
Expected: una línea `sigcan-db Up … (healthy)`. No seguir sin la base.

- [ ] **Step 4: Línea de base**

Run: `npx tsc --noEmit` → sin errores.
Run: `npm test` → PASS, **152 tests** (23 archivos).
Si algo falla antes de empezar, detenerse y registrarlo: la fase parte de una base en verde.

---

### Task 2: Test del escenario de demostración (TDD)

**Files:**
- Test: `tests/db/demo.test.ts`

- [ ] **Step 1: Escribir el test que falla**

```ts
import { Op } from "sequelize";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { aCentesimos } from "@/lib/cantidades";
import { Animal, HistorialClinico, Insumo, MovimientoInsumo, Procedimiento, sequelize, Turno, Usuario, Vecino } from "@/lib/db";
import { rangoUltimosMeses } from "@/lib/fechas";
import { resumenDashboard } from "@/services/dashboard";
import { generarReportes } from "@/services/reportes";
import { CORREO_PRUEBA, sembrarDatosDemo, USUARIOS_DEMO } from "../../db/seeders/demo";
import { reiniciarDatos } from "../helpers/bd";

// La demo se carga sobre una base con solo los datos iniciales y, al terminar, la base vuelve
// a ese estado para no afectar a los demás archivos de test.
beforeAll(async () => {
  await reiniciarDatos();
  await sembrarDatosDemo();
}, 120_000);

afterAll(async () => {
  await reiniciarDatos();
  await sequelize.close();
});

/** Busca un usuario de la demo por su email. */
async function usuarioDemo(email: string): Promise<Usuario> {
  return (await Usuario.findOne({ where: { email } }))!;
}

describe("seed de demostración", () => {
  it("carga vecinos, animales y un usuario por cada credencial de la demo", async () => {
    expect(await Vecino.count()).toBe(30);
    expect(await Vecino.count({ where: { activo: true } })).toBe(29);
    expect(await Animal.count()).toBe(50);
    // El único email es el de prueba: no se envían correos a direcciones inventadas.
    expect(await Vecino.count({ where: { email: { [Op.ne]: null } } })).toBe(1);
    expect(await Vecino.count({ where: { email: CORREO_PRUEBA } })).toBe(1);
    for (const { email } of Object.values(USUARIOS_DEMO)) {
      expect(await Usuario.count({ where: { email } })).toBe(1);
    }
  });

  it("no se carga dos veces sobre la misma base", async () => {
    await expect(sembrarDatosDemo()).rejects.toThrow("La base ya tiene vecinos");
  });

  it("cada turno completado tiene procedimiento e historial, y el animal refleja lo realizado", async () => {
    expect(await Turno.count({ where: { estado: "completado" } })).toBe(24);
    expect(await Procedimiento.count()).toBe(24);
    expect(await HistorialClinico.count()).toBe(24);
    expect(await Animal.count({ where: { castrado: true } })).toBe(16);
    expect(await Animal.count({ where: { numero_chip: { [Op.ne]: null } } })).toBe(16);
  });

  it("el stock de cada insumo coincide con sus movimientos y solo las gasas quedan bajo el mínimo", async () => {
    const insumos = await Insumo.findAll({ order: [["nombre", "ASC"]] });
    for (const insumo of insumos) {
      const movimientos = await MovimientoInsumo.findAll({ where: { insumo_id: insumo.id } });
      const saldo = movimientos.reduce(
        (total, movimiento) => total + (movimiento.tipo === "ingreso" ? 1 : -1) * aCentesimos(movimiento.cantidad),
        0,
      );
      expect(saldo).toBe(aCentesimos(insumo.stock_actual));
    }
    const bajoMinimo = insumos.filter((insumo) => aCentesimos(insumo.stock_actual) <= aCentesimos(insumo.stock_minimo));
    expect(bajoMinimo.map((insumo) => insumo.nombre)).toEqual(["Gasas estériles"]);
    expect(insumos.find((insumo) => insumo.nombre === "Ketamina")?.stock_actual).toBe("460.00");
  });

  it("los reportes de los últimos 12 meses dan los valores del escenario", async () => {
    const reporte = await generarReportes(rangoUltimosMeses(12));
    const suma = (clave: "castraciones" | "chipeos") =>
      reporte.procedimientos.reduce((total, fila) => total + fila[clave], 0);
    expect(suma("castraciones")).toBe(16);
    expect(suma("chipeos")).toBe(16);
    expect(reporte.cumplimiento).toEqual({ realizados: 8, cancelados: 2, sin_cerrar: 0, porcentaje: 80 });
    expect(reporte.asistencia).toEqual({ completados: 24, ausentes: 8, porcentaje: 75 });
    // 8 realizados + el de hoy (los cancelados no cuentan y los futuros quedan fuera del período).
    expect(reporte.ocupacion.operativos).toHaveLength(9);
    const avisos = reporte.avistamientos.meses.reduce((total, mes) => total + mes.pendientes + mes.atendidos, 0);
    expect(avisos).toBe(18);
    expect(reporte.avistamientos.promedio_dias).not.toBeNull();
  });

  it("el inicio muestra los totales y los turnos de hoy según el rol", async () => {
    const operador = await usuarioDemo(USUARIOS_DEMO.operador.email);
    const general = await resumenDashboard({ usuarioId: operador.id, nombre: "Laura Gómez", rol: "operador" });
    if (general.tipo !== "general") throw new Error("Se esperaba el resumen general");
    expect(general.totales).toEqual({ vecinos_activos: 29, animales: 50, castrados: 16, chipeados: 16 });
    expect(general.turnos_hoy).toHaveLength(5);
    expect(general.insumos_bajo_minimo.total).toBe(1);
    expect(general.avistamientos_pendientes.total).toBe(4);

    const ana = await usuarioDemo(USUARIOS_DEMO.veterinaria.email);
    const deAna = await resumenDashboard({ usuarioId: ana.id, nombre: "Ana Ríos", rol: "veterinario" });
    expect(deAna).toMatchObject({ tipo: "veterinario", motivo: null });
    expect(deAna.turnos_hoy).toHaveLength(5);

    // Martín no está asignado al operativo de hoy.
    const martin = await usuarioDemo(USUARIOS_DEMO.veterinario.email);
    const deMartin = await resumenDashboard({ usuarioId: martin.id, nombre: "Martín Sosa", rol: "veterinario" });
    expect(deMartin.turnos_hoy).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Ejecutarlo y ver que falla**

Run: `npx vitest run tests/db/demo.test.ts`
Expected: FAIL — no se puede resolver `../../db/seeders/demo` (el seed se crea en la Task 3).

---

### Task 3: Seed de demostración y comandos

**Files:**
- Modify: `src/services/procedimientos.ts`, `package.json`
- Create: `db/seeders/demo.ts`
- Replace: `scripts/db.ts`

- [ ] **Step 1: Exportar `redactarDescripcion` en `src/services/procedimientos.ts`**

Reemplazar:

```ts
/** Descripción del historial clínico: tipo, veterinario, chip, insumos y observaciones. */
function redactarDescripcion(
```

por:

```ts
/**
 * Descripción del historial clínico: tipo, veterinario, chip, insumos y observaciones.
 * Se exporta para que el seed de demostración redacte el historial igual que F7.
 */
export function redactarDescripcion(
```

(El resto de la función no cambia.)

- [ ] **Step 2: Crear `db/seeders/demo.ts`**

```ts
import bcrypt from "bcryptjs";
import { aCentesimos, deCentesimos, formatearCantidad } from "@/lib/cantidades";
import {
  incluyeCastracion, incluyeChipeo, MOTIVOS_CANCELACION, TIPOS_PROCEDIMIENTO,
  type EstadoOperativo, type EstadoTurno, type NombreRol, type TipoProcedimiento,
} from "@/lib/constantes";
import {
  Animal, HistorialClinico, Insumo, MovimientoInsumo, Operativo, OperativoVeterinario, Procedimiento,
  ProcedimientoInsumo, ReporteAvistamiento, Rol, sequelize, Turno, Usuario, Vecino, Veterinario, Zona,
} from "@/lib/db";
import { hoyLocal, instanteLocal, MS_POR_HORA, sumarDias } from "@/lib/fechas";
import { redactarDescripcion } from "@/services/procedimientos";

/**
 * Datos de demostración (Fase 6): un escenario realista de Río Grande para recorrer el
 * sistema y para que el inicio y los reportes tengan contenido en la defensa.
 *
 * Criterios:
 * - Fechas relativas a hoy: los operativos pasados, el de hoy y los futuros se ubican
 *   respecto del día en que se ejecuta `npm run db:demo`, así la demo no "envejece".
 * - Coherencia con las reglas: el pasado se escribe con los modelos (los servicios no
 *   permiten operativos con fecha pasada), replicando cada efecto de F7: stock y
 *   movimientos, uso de insumos, animal castrado/chipeado, turno completado e historial.
 * - Sin correos inventados: solo el vecino de prueba de notificaciones tiene email.
 * - Se ejecuta sobre una base con solo los datos iniciales; si ya hay vecinos, se detiene.
 */

/* ───────────────────────── Datos fijos del escenario ───────────────────────── */

/** Credenciales de los usuarios de demostración (también figuran en el README). */
export const USUARIOS_DEMO = {
  operador: { nombre: "Laura", apellido: "Gómez", email: "operador@sigcan.local", password: "Operador1234" },
  veterinaria: { nombre: "Ana", apellido: "Ríos", email: "veterinaria@sigcan.local", password: "Veterinaria1234" },
  veterinario: { nombre: "Martín", apellido: "Sosa", email: "veterinario@sigcan.local", password: "Veterinario1234" },
} as const;
type DatosUsuarioDemo = (typeof USUARIOS_DEMO)[keyof typeof USUARIOS_DEMO];

/** Correo real indicado por el equipo para probar las notificaciones (F12). */
export const CORREO_PRUEBA = "mepotdf@gmail.com";

/** Zonas del seed inicial en las que transcurre la demo. */
const ZONAS_DEMO = ["Centro", "Chacra II", "Chacra IV", "Chacra XIII", "Margen Sur", "Austral"];

/** Lugar habitual de los operativos de cada zona (mismo orden que ZONAS_DEMO). */
const LUGARES = [
  "SUM Municipal del Centro", "Centro Comunitario Chacra II", "Escuela N° 15 (Chacra IV)",
  "Delegación Municipal Chacra XIII", "Polideportivo Margen Sur", "Gimnasio del Barrio Austral",
];

const NOMBRES = [
  "María", "José", "Ana", "Carlos", "Laura", "Jorge", "Silvina", "Diego", "Paula", "Raúl", "Florencia", "Hugo",
  "Valeria", "Sergio", "Natalia", "Pablo", "Gabriela", "Marcelo", "Romina", "Luis", "Carolina", "Daniel",
  "Lorena", "Gustavo", "Mónica", "Ricardo", "Andrea", "Fernando",
];
const APELLIDOS = [
  "González", "Rodríguez", "Fernández", "López", "Martínez", "García", "Pérez", "Sánchez", "Romero", "Sosa",
  "Torres", "Álvarez", "Ruiz", "Ramírez", "Flores", "Benítez", "Acosta", "Medina", "Herrera", "Aguirre",
  "Pereyra", "Gutiérrez", "Giménez", "Molina", "Silva", "Castro", "Rojas", "Ortiz",
];
const CALLES = [
  "Av. San Martín", "Belgrano", "Rivadavia", "Av. Perito Moreno", "Lasserre", "Elcano", "Thorne", "Fagnano",
  "Av. Santa Fe", "Islas Malvinas",
];
const NOMBRES_ANIMALES = [
  "Firulais", "Luna", "Rocco", "Nina", "Toto", "Kira", "Bruno", "Lola", "Simón", "Mora", "Pancho", "Maya",
  "Coco", "Frida", "Tango", "Uma", "Rayo", "Chispa", "Negro", "Canela", "Duque", "Pupi", "Jack", "Malena",
];
const RAZAS = ["Mestizo", "Mestizo", "Labrador", "Ovejero alemán", "Caniche", "Mestizo", "Border collie", "Beagle"];
const DESCRIPCIONES_AVISTAMIENTO = [
  "Jauría de perros sueltos cerca de la escuela", "Perra con cachorros en un baldío",
  "Perros que persiguen a los autos", "Perro herido en la vereda",
  "Grupo de perros revolviendo la basura", "Perros asilvestrados cerca de la costa",
];

/** Insumos de la demo: stock inicial (ingreso hace 180 días) y mínimo. */
const INSUMOS_DEMO = [
  { clave: "ketamina", nombre: "Ketamina", unidad: "ml", inicial: 500, minimo: 50 },
  { clave: "xilacina", nombre: "Xilacina", unidad: "ml", inicial: 300, minimo: 30 },
  { clave: "sutura", nombre: "Sutura absorbible", unidad: "unidades", inicial: 120, minimo: 20 },
  { clave: "microchip", nombre: "Microchip", unidad: "unidades", inicial: 80, minimo: 20 },
  { clave: "guantes", nombre: "Guantes de látex", unidad: "pares", inicial: 200, minimo: 40 },
  // Sin consumo y con stock por debajo del mínimo: aparece en "Insumos bajo el mínimo".
  { clave: "gasas", nombre: "Gasas estériles", unidad: "paquetes", inicial: 15, minimo: 20 },
] as const;
type ClaveInsumo = (typeof INSUMOS_DEMO)[number]["clave"];

/** Consumo de insumos de cada parte del procedimiento (los guantes se usan siempre). */
const USO_CASTRACION: Array<[ClaveInsumo, number]> = [["ketamina", 2.5], ["xilacina", 1], ["sutura", 1]];
const USO_CHIPEO: Array<[ClaveInsumo, number]> = [["microchip", 1]];

/** Insumos que consume un procedimiento según su tipo. */
function usosDe(tipo: TipoProcedimiento): Array<[ClaveInsumo, number]> {
  return [
    ...(incluyeCastracion(tipo) ? USO_CASTRACION : []),
    ...(incluyeChipeo(tipo) ? USO_CHIPEO : []),
    ["guantes", 1],
  ];
}

/** Vecinos: los primeros 28 son tutores habituales; luego el de prueba de correo y uno dado de baja. */
const CANTIDAD_VECINOS = 30;
const VECINOS_HABITUALES = 28;
const INDICE_VECINO_CORREO = 28;
const INDICE_VECINO_BAJA = 29;

/**
 * Animales (índices 0 a 49): 0–37 con tutor habitual, 38 "Toby" (vecino de prueba de correo,
 * sin turnos), 39 del vecino dado de baja, 40–44 callejeros y 45–49 asilvestrados.
 */
const CANTIDAD_ANIMALES = 50;
const ANIMAL_TOBY = 38;

/** Rango de enteros [desde, hasta). */
function rango(desde: number, hasta: number): number[] {
  return Array.from({ length: hasta - desde }, (_, indice) => desde + indice);
}

/** 24 animales con procedimiento completado en el pasado (3 por operativo realizado). */
const ANIMALES_ATENDIDOS = [...rango(0, 20), 40, 41, 42, 43];
/** 8 animales que no se presentaron (1 por operativo realizado). */
const ANIMALES_AUSENTES = rango(20, 28);
/** 4 animales con turno cancelado por la cancelación del operativo (2 por operativo cancelado). */
const ANIMALES_OPERATIVO_CANCELADO = rango(28, 32);

interface OperativoPlanificado {
  /** Días respecto de hoy (negativo: pasado). */
  dias: number;
  /** Índice en ZONAS_DEMO. */
  zona: number;
  cupo: number;
}

interface TurnoPlanificado {
  /** Índice del animal. */
  animal: number;
  tipo: TipoProcedimiento;
  estado: Extract<EstadoTurno, "pendiente" | "confirmado">;
}

const OPERATIVOS_REALIZADOS: OperativoPlanificado[] = [
  { dias: -150, zona: 0, cupo: 8 }, { dias: -120, zona: 1, cupo: 10 }, { dias: -95, zona: 2, cupo: 12 },
  { dias: -70, zona: 3, cupo: 6 }, { dias: -45, zona: 4, cupo: 10 }, { dias: -30, zona: 5, cupo: 8 },
  { dias: -14, zona: 0, cupo: 12 }, { dias: -7, zona: 1, cupo: 10 },
];

const OPERATIVOS_CANCELADOS: Array<OperativoPlanificado & { motivo: string }> = [
  { dias: -60, zona: 2, cupo: 10, motivo: "Temporal de nieve: se suspendió por seguridad" },
  { dias: -21, zona: 4, cupo: 8, motivo: "Falta de anestésicos por demora del proveedor" },
];

/** Turnos del operativo de hoy: 4 confirmados (uno combinado, para probar el chip) y 1 pendiente. */
const TURNOS_HOY: TurnoPlanificado[] = [
  { animal: 20, tipo: "castracion_y_chipeo", estado: "confirmado" },
  { animal: 21, tipo: "castracion", estado: "confirmado" },
  { animal: 22, tipo: "chipeo", estado: "confirmado" },
  { animal: 23, tipo: "castracion", estado: "confirmado" },
  { animal: 32, tipo: "castracion", estado: "pendiente" },
];

const OPERATIVOS_FUTUROS: Array<OperativoPlanificado & { veterinario: "ana" | "martin"; turnos: TurnoPlanificado[] }> = [
  {
    dias: 5, zona: 3, cupo: 10, veterinario: "ana",
    turnos: [
      { animal: 24, tipo: "castracion", estado: "pendiente" },
      { animal: 25, tipo: "castracion_y_chipeo", estado: "pendiente" },
      { animal: 26, tipo: "castracion", estado: "confirmado" },
    ],
  },
  {
    dias: 12, zona: 5, cupo: 12, veterinario: "martin",
    turnos: [
      { animal: 28, tipo: "castracion", estado: "pendiente" },
      { animal: 29, tipo: "chipeo", estado: "pendiente" },
      { animal: 33, tipo: "castracion", estado: "confirmado" },
    ],
  },
  {
    dias: 20, zona: 1, cupo: 8, veterinario: "ana",
    turnos: [
      { animal: 34, tipo: "castracion", estado: "pendiente" },
      { animal: 35, tipo: "castracion_y_chipeo", estado: "pendiente" },
      { animal: 44, tipo: "castracion", estado: "pendiente" },
    ],
  },
];

/** Avistamientos: 18 reportes cada 9 días; los 4 más recientes siguen pendientes. */
const CANTIDAD_AVISTAMIENTOS = 18;
const AVISTAMIENTOS_PENDIENTES = 4;
const MS_POR_DIA = 24 * MS_POR_HORA;

/** Número con dos dígitos ("9" → "09"). */
function dosDigitos(valor: number): string {
  return String(valor).padStart(2, "0");
}

/** "HH:MM" del turno número `n` de un operativo: uno cada 20 minutos desde las 09:00. */
function horarioTurno(n: number): string {
  const minutos = 9 * 60 + 20 * n;
  return `${dosDigitos(Math.floor(minutos / 60))}:${dosDigitos(minutos % 60)}`;
}

/* ───────────────────────── Carga ───────────────────────── */

/** Carga el escenario de demostración completo en una única transacción. */
export async function sembrarDatosDemo(): Promise<void> {
  if ((await Vecino.count()) > 0) {
    throw new Error("La base ya tiene vecinos: use `npm run db:demo`, que reinicia la base antes de cargar la demo");
  }

  // Si algo falla, la base queda solo con los datos iniciales.
  await sequelize.transaction(async (transaction) => {
    const hoy = hoyLocal();
    const opciones = { transaction };

    // 1) Referencias del seed inicial: administrador, roles y zonas de la demo.
    const admin = await Usuario.findOne({ where: { email: process.env.SEED_ADMIN_EMAIL ?? "" }, transaction });
    if (!admin) {
      throw new Error("No se encontró el administrador inicial: ejecute antes el seed inicial");
    }
    const roles = await Rol.findAll({ transaction });
    const idRol = (nombre: NombreRol) => roles.find((rol) => rol.nombre === nombre)!.id;
    const zonas: Zona[] = [];
    for (const nombre of ZONAS_DEMO) {
      zonas.push((await Zona.findOne({ where: { nombre }, transaction }))!);
    }

    // 2) Usuarios de demostración y personal (Ana y Martín vinculados a su usuario; Carla, auxiliar).
    const crearUsuario = async (datos: DatosUsuarioDemo, rol: NombreRol) =>
      Usuario.create(
        {
          nombre: datos.nombre,
          apellido: datos.apellido,
          email: datos.email,
          password_hash: await bcrypt.hash(datos.password, 10),
          rol_id: idRol(rol),
        },
        opciones,
      );
    const operador = await crearUsuario(USUARIOS_DEMO.operador, "operador");
    const usuarioAna = await crearUsuario(USUARIOS_DEMO.veterinaria, "veterinario");
    const usuarioMartin = await crearUsuario(USUARIOS_DEMO.veterinario, "veterinario");
    const ana = await Veterinario.create(
      {
        tipo: "veterinario", nombre: "Ana", apellido: "Ríos", matricula: "MV-1201",
        especialidad: "Cirugía de pequeños animales", telefono: "2964401201", usuario_id: usuarioAna.id,
      },
      opciones,
    );
    const martin = await Veterinario.create(
      { tipo: "veterinario", nombre: "Martín", apellido: "Sosa", matricula: "MV-1302", telefono: "2964401302", usuario_id: usuarioMartin.id },
      opciones,
    );
    const carla = await Veterinario.create(
      { tipo: "auxiliar", nombre: "Carla", apellido: "Díaz", telefono: "2964401403" },
      opciones,
    );
    const personal = { ana, martin };

    // 3) Insumos con su ingreso inicial. El stock se lleva en centésimos y se guarda al final.
    const insumos = new Map<ClaveInsumo, Insumo>();
    const stock = new Map<ClaveInsumo, number>();
    const fechaIngreso = instanteLocal(sumarDias(hoy, -180), "08:00");
    for (const datos of INSUMOS_DEMO) {
      const cantidad = deCentesimos(aCentesimos(datos.inicial));
      const insumo = await Insumo.create(
        { nombre: datos.nombre, unidad: datos.unidad, stock_actual: cantidad, stock_minimo: deCentesimos(aCentesimos(datos.minimo)) },
        opciones,
      );
      await MovimientoInsumo.create(
        { tipo: "ingreso", cantidad, fecha: fechaIngreso, motivo: "Stock inicial", insumo_id: insumo.id, usuario_id: admin.id },
        opciones,
      );
      insumos.set(datos.clave, insumo);
      stock.set(datos.clave, aCentesimos(datos.inicial));
    }

    // 4) Vecinos repartidos en las zonas de la demo. Solo el de prueba tiene email.
    const vecinos: Vecino[] = [];
    for (let i = 0; i < CANTIDAD_VECINOS; i++) {
      const esPrueba = i === INDICE_VECINO_CORREO;
      const deBaja = i === INDICE_VECINO_BAJA;
      vecinos.push(
        await Vecino.create(
          {
            nombre: esPrueba ? "Vecina" : NOMBRES[i % NOMBRES.length],
            // 5 y 28 son coprimos: cada vecino habitual recibe un apellido distinto.
            apellido: esPrueba ? "Prueba Correo" : APELLIDOS[(i * 5) % APELLIDOS.length],
            dni: String(25_300_000 + i * 7_919),
            telefono: `29644${20_000 + i * 37}`,
            email: esPrueba ? CORREO_PRUEBA : null,
            direccion: `${CALLES[i % CALLES.length]} ${150 + i * 23}`,
            activo: !deBaja,
            fecha_baja: deBaja ? sumarDias(hoy, -20) : null,
            zona_id: zonas[i % zonas.length].id,
          },
          opciones,
        ),
      );
    }

    // 5) Animales (ver el comentario de CANTIDAD_ANIMALES). Ninguno castrado ni chipeado todavía.
    const animales: Animal[] = [];
    for (let i = 0; i < CANTIDAD_ANIMALES; i++) {
      const conTutor = i < 40;
      const tutor = !conTutor
        ? null
        : i < ANIMAL_TOBY
          ? vecinos[i % VECINOS_HABITUALES]
          : vecinos[i === ANIMAL_TOBY ? INDICE_VECINO_CORREO : INDICE_VECINO_BAJA];
      animales.push(
        await Animal.create(
          {
            nombre: i === ANIMAL_TOBY ? "Toby" : i >= 45 ? null : NOMBRES_ANIMALES[i % NOMBRES_ANIMALES.length],
            raza: conTutor ? RAZAS[i % RAZAS.length] : null,
            sexo: i % 2 === 0 ? "M" : "H",
            edad_estimada: 1 + (i % 9),
            condicion: conTutor ? "con_tutor" : i < 45 ? "callejero" : "asilvestrado",
            vecino_id: tutor?.id ?? null,
          },
          opciones,
        ),
      );
    }

    /** Crea un operativo a `plan.dias` días de hoy y le asigna el personal indicado. */
    const crearOperativo = async (
      plan: OperativoPlanificado,
      asignados: Veterinario[],
      extra: { estado?: EstadoOperativo; horaFin?: string; motivoCancelacion?: string } = {},
    ): Promise<Operativo> => {
      const fecha = sumarDias(hoy, plan.dias);
      const operativo = await Operativo.create(
        {
          fecha,
          hora_inicio: "09:00",
          hora_fin: extra.horaFin ?? "13:00",
          lugar: LUGARES[plan.zona],
          cupo_maximo: plan.cupo,
          estado: extra.estado ?? "programado",
          // Una cancelación registra motivo, fecha (3 días antes) y usuario (ck_operativo_cancelacion).
          motivo_cancelacion: extra.motivoCancelacion ?? null,
          fecha_cancelacion: extra.motivoCancelacion ? instanteLocal(sumarDias(fecha, -3), "10:00") : null,
          usuario_cancelacion_id: extra.motivoCancelacion ? admin.id : null,
          zona_id: zonas[plan.zona].id,
        },
        opciones,
      );
      for (const integrante of asignados) {
        await OperativoVeterinario.create({ operativo_id: operativo.id, veterinario_id: integrante.id }, opciones);
      }
      return operativo;
    };

    /** Crea el turno número `n` del operativo. La solicitud se ubica 10 días antes (nunca en el futuro). */
    const crearTurno = (
      operativo: Operativo,
      n: number,
      animal: number,
      tipo: TipoProcedimiento,
      estado: EstadoTurno,
      motivo: string | null = null,
    ) =>
      Turno.create(
        {
          fecha_solicitud: instanteLocal(sumarDias(operativo.fecha <= hoy ? operativo.fecha : hoy, -10), "10:00"),
          horario: horarioTurno(n),
          tipo_solicitado: tipo,
          estado,
          motivo_cancelacion: motivo,
          animal_id: animales[animal].id,
          operativo_id: operativo.id,
        },
        opciones,
      );

    /** Replica los efectos de F7 (ver `registrarProcedimiento`) sobre un turno ya completado. */
    let chipsColocados = 0;
    const registrarProcedimiento = async (turno: Turno, veterinario: Veterinario, fecha: Date) => {
      const tipo = turno.tipo_solicitado;
      let chip: string | null = null;
      if (incluyeChipeo(tipo)) {
        chipsColocados += 1;
        chip = `985141000000${String(chipsColocados).padStart(3, "0")}`;
      }
      const procedimiento = await Procedimiento.create(
        { tipo, fecha, numero_chip_colocado: chip, turno_id: turno.id, veterinario_id: veterinario.id },
        opciones,
      );

      // Insumos: uso, egreso a nombre del usuario del veterinario y descuento del stock.
      const detalle: string[] = [];
      for (const [clave, cantidad] of usosDe(tipo)) {
        const insumo = insumos.get(clave)!;
        const valor = deCentesimos(aCentesimos(cantidad));
        await ProcedimientoInsumo.create(
          { procedimiento_id: procedimiento.id, insumo_id: insumo.id, cantidad_usada: valor },
          opciones,
        );
        await MovimientoInsumo.create(
          {
            tipo: "egreso", cantidad: valor, fecha, motivo: `Procedimiento #${procedimiento.id}`,
            insumo_id: insumo.id, usuario_id: veterinario.usuario_id!, procedimiento_id: procedimiento.id,
          },
          opciones,
        );
        stock.set(clave, stock.get(clave)! - aCentesimos(cantidad));
        detalle.push(`${insumo.nombre} ${formatearCantidad(valor, insumo.unidad)}`);
      }

      // Animal castrado y/o chipeado, e historial clínico con la redacción de F7.
      const animal = animales.find((candidato) => candidato.id === turno.animal_id)!;
      await animal.update(
        { ...(incluyeCastracion(tipo) ? { castrado: true } : {}), ...(chip ? { numero_chip: chip } : {}) },
        opciones,
      );
      await HistorialClinico.create(
        { descripcion: redactarDescripcion(tipo, veterinario, chip, detalle, null), procedimiento_id: procedimiento.id },
        opciones,
      );
    };

    // 6) Operativos realizados: 3 turnos completados (uno de cada tipo) y 1 ausente cada uno.
    for (const [indice, plan] of OPERATIVOS_REALIZADOS.entries()) {
      const veterinario = indice % 2 === 0 ? ana : martin;
      const operativo = await crearOperativo(plan, [veterinario, carla], { estado: "realizado" });
      for (const [n, tipo] of TIPOS_PROCEDIMIENTO.entries()) {
        const turno = await crearTurno(operativo, n, ANIMALES_ATENDIDOS[indice * 3 + n], tipo, "completado");
        await registrarProcedimiento(turno, veterinario, instanteLocal(operativo.fecha, horarioTurno(n)));
      }
      await crearTurno(operativo, 3, ANIMALES_AUSENTES[indice], "castracion", "cancelado", MOTIVOS_CANCELACION.noSePresento);
    }

    // 7) Operativos cancelados: sus turnos quedaron cancelados por la cancelación del operativo.
    for (const [indice, plan] of OPERATIVOS_CANCELADOS.entries()) {
      const operativo = await crearOperativo(plan, [], { estado: "cancelado", motivoCancelacion: plan.motivo });
      for (const n of [0, 1]) {
        await crearTurno(
          operativo, n, ANIMALES_OPERATIVO_CANCELADO[indice * 2 + n], "castracion", "cancelado",
          MOTIVOS_CANCELACION.operativoCancelado,
        );
      }
    }

    // 8) Operativo de hoy (programado, para iniciarlo en el recorrido) con Ana y Carla.
    const operativoHoy = await crearOperativo({ dias: 0, zona: 0, cupo: 15 }, [ana, carla], { horaFin: "18:00" });
    for (const [n, turno] of TURNOS_HOY.entries()) {
      await crearTurno(operativoHoy, n, turno.animal, turno.tipo, turno.estado);
    }

    // 9) Operativos futuros con turnos pendientes y confirmados (sus tutores no tienen email:
    //    no corresponden notificaciones).
    for (const plan of OPERATIVOS_FUTUROS) {
      const operativo = await crearOperativo(plan, [personal[plan.veterinario], carla]);
      for (const [n, turno] of plan.turnos.entries()) {
        await crearTurno(operativo, n, turno.animal, turno.tipo, turno.estado);
      }
    }

    // 10) Avistamientos de los últimos meses: los más antiguos ya atendidos (2 a 7 días después).
    for (let i = 0; i < CANTIDAD_AVISTAMIENTOS; i++) {
      const fecha = instanteLocal(sumarDias(hoy, -(5 + i * 9)), `${dosDigitos(9 + (i % 8))}:15`);
      const atendido = i >= AVISTAMIENTOS_PENDIENTES;
      await ReporteAvistamiento.create(
        {
          fecha,
          descripcion: DESCRIPCIONES_AVISTAMIENTO[i % DESCRIPCIONES_AVISTAMIENTO.length],
          cantidad_animales: 1 + (i % 5),
          direccion_referencia: `${CALLES[(i + 3) % CALLES.length]} y ${CALLES[(i + 6) % CALLES.length]}`,
          estado: atendido ? "atendido" : "pendiente",
          fecha_atencion: atendido ? new Date(fecha.getTime() + (2 + (i % 6)) * MS_POR_DIA) : null,
          zona_id: zonas[i % zonas.length].id,
          vecino_id: i % 3 === 0 ? vecinos[i].id : null,
          usuario_id: i % 2 === 0 ? operador.id : admin.id,
        },
        opciones,
      );
    }

    // 11) Stock final de cada insumo (ingreso inicial menos los egresos de los procedimientos).
    for (const [clave, insumo] of insumos) {
      await insumo.update({ stock_actual: deCentesimos(stock.get(clave)!) }, opciones);
    }
  });
}
```

- [ ] **Step 3: Reemplazar `scripts/db.ts`**

```ts
/**
 * CLI de base de datos.
 *   npm run db:migrar        aplica las migraciones pendientes
 *   npm run db:seed          carga los datos iniciales (idempotente)
 *   npm run db:reset         borra todo, migra y siembra
 *   npm run db:reset:test    igual que reset, pero sobre la base de test
 *   npm run db:demo          borra todo, migra, siembra y carga los datos de demostración
 *   npm run db:demo:test     igual que demo, pero sobre la base de test (prueba de humo de la Fase 6)
 */
import { loadEnvConfig } from "@next/env";

const [comando, ...opciones] = process.argv.slice(2);

// Con --test se apunta a DATABASE_URL_TEST (ver src/lib/conexion.ts).
if (opciones.includes("--test")) {
  Object.assign(process.env, { NODE_ENV: "test" });
}

// Carga .env con las mismas reglas que Next.js antes de crear la conexión.
loadEnvConfig(process.cwd());

async function main() {
  // Importación dinámica: la conexión debe crearse después de cargar las variables de entorno.
  const { sequelize } = await import("@/lib/db");
  const { crearMigrador } = await import("../db/migrador");
  const { sembrarDatosIniciales } = await import("../db/seeders/inicial");
  const { sembrarDatosDemo } = await import("../db/seeders/demo");
  const migrador = crearMigrador(sequelize);

  /** Elimina el esquema completo (tablas, índices y registro de migraciones), lo recrea y siembra los datos iniciales. */
  async function reiniciarBase(): Promise<number> {
    await sequelize.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    const aplicadas = await migrador.up();
    await sembrarDatosIniciales();
    return aplicadas.length;
  }

  try {
    switch (comando) {
      case "migrar": {
        const aplicadas = await migrador.up();
        console.log(`Migraciones aplicadas: ${aplicadas.length}`);
        break;
      }
      case "seed": {
        await sembrarDatosIniciales();
        console.log("Datos iniciales cargados");
        break;
      }
      case "reset": {
        const aplicadas = await reiniciarBase();
        console.log(`Base reiniciada: ${aplicadas} migraciones aplicadas y datos iniciales cargados`);
        break;
      }
      case "demo": {
        const aplicadas = await reiniciarBase();
        await sembrarDatosDemo();
        console.log(`Base reiniciada con datos de demostración (${aplicadas} migraciones aplicadas)`);
        break;
      }
      default:
        console.error("Comando desconocido. Usar: migrar | seed | reset | demo [--test]");
        process.exitCode = 1;
    }
  } finally {
    await sequelize.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

- [ ] **Step 4: Agregar los scripts en `package.json` (a mano)**

En `"scripts"`, después de `"db:reset:test": "tsx scripts/db.ts reset --test",` agregar:

```json
    "db:demo": "tsx scripts/db.ts demo",
    "db:demo:test": "tsx scripts/db.ts demo --test",
```

No modificar ninguna otra línea de `package.json`.

- [ ] **Step 5: Ejecutar el test del escenario**

Run: `npx vitest run tests/db/demo.test.ts`
Expected: PASS, 6 tests.

Si un valor no coincide, revisar el seed (lección L4): no cambiar el test.

- [ ] **Step 6: Cargar la demo en la base de desarrollo**

Run: `npm run db:demo`
Expected: `Base reiniciada con datos de demostración (1 migraciones aplicadas)`. Esto borra los datos de la base de desarrollo `sigcan` (la de test no se toca).

- [ ] **Step 7: Suite completa**

Run: `npm test`
Expected: PASS, **158 tests** (24 archivos).

---

### Task 4: Usabilidad: error, carga, 404 y títulos de pestaña

**Files:**
- Create: `src/app/(panel)/error.tsx`, `src/app/(panel)/loading.tsx`, `src/app/not-found.tsx`, `src/app/(auth)/login/layout.tsx`
- Modify: `src/app/layout.tsx` y las 16 páginas de `src/app/(panel)/`

- [ ] **Step 1: Crear `src/app/(panel)/error.tsx`**

```tsx
"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * Límite de error de las páginas del panel: si una página falla al mostrarse, presenta un
 * aviso en lugar de una pantalla en blanco y permite reintentar (Next 16 entrega `retry`).
 */
export default function ErrorPanel({ error, retry }: { error: unknown; retry: () => void }) {
  // El detalle queda en la consola del navegador; en producción Next oculta el mensaje real.
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto mt-16 grid max-w-md gap-4 rounded-lg border p-6 text-center">
      <h2 className="text-lg font-semibold">No se pudo mostrar esta página</h2>
      <p className="text-sm text-muted-foreground">
        Ocurrió un error inesperado. Puede reintentar; si el problema continúa, avise al administrador.
      </p>
      <div>
        <Button onClick={() => retry()}>Reintentar</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Crear `src/app/(panel)/loading.tsx`**

```tsx
/** Estado de carga de las páginas del panel mientras el servidor prepara la respuesta. */
export default function CargandoPanel() {
  return (
    <div role="status" aria-live="polite" className="grid gap-4">
      <div className="h-8 w-64 animate-pulse rounded-md bg-muted" />
      <div className="h-4 w-96 max-w-full animate-pulse rounded-md bg-muted" />
      <div className="h-64 animate-pulse rounded-lg bg-muted" />
      <span className="sr-only">Cargando…</span>
    </div>
  );
}
```

- [ ] **Step 3: Crear `src/app/not-found.tsx`**

```tsx
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

/** Página 404 de todo el sitio: rutas inexistentes y `notFound()` de las páginas de detalle. */
export default function NoEncontrado() {
  return (
    <main className="mx-auto mt-24 grid max-w-md gap-4 p-6 text-center">
      <p className="text-sm font-medium text-muted-foreground">Error 404</p>
      <h1 className="text-2xl font-semibold tracking-tight">Página no encontrada</h1>
      <p className="text-sm text-muted-foreground">La dirección no existe o el registro fue eliminado.</p>
      <div>
        <Link href="/dashboard" className={buttonVariants()}>
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Plantilla de título en `src/app/layout.tsx`**

Reemplazar:

```tsx
export const metadata: Metadata = {
  title: "SIGCAN — Castración y Chipeo Animal",
```

por:

```tsx
export const metadata: Metadata = {
  // Cada página define su título; la plantilla agrega el nombre del sistema ("Vecinos · SIGCAN").
  title: { default: "SIGCAN — Castración y Chipeo Animal", template: "%s · SIGCAN" },
```

- [ ] **Step 5: Crear `src/app/(auth)/login/layout.tsx`**

La página de ingreso es de cliente y no puede exportar `metadata`; el título lo aporta este layout.

```tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Iniciar sesión" };

/** Layout de la pantalla de ingreso: solo aporta el título de la pestaña. */
export default function LayoutLogin({ children }: { children: ReactNode }) {
  return children;
}
```

- [ ] **Step 6: Título de cada página del panel**

En cada archivo de la tabla, agregar **después del último `import`** estas dos piezas (con el título de la tabla) y no cambiar nada más:

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Vecinos" };
```

(El `import type { Metadata }` va junto a los demás imports; `export const metadata` va entre los imports y el comentario `/** … */` de la función de la página.)

| Archivo (`src/app/(panel)/…`) | Título |
|---|---|
| `animales/page.tsx` | `Animales` |
| `avistamientos/page.tsx` | `Avistamientos` |
| `dashboard/page.tsx` | `Inicio` |
| `historial/page.tsx` | `Historial clínico` |
| `insumos/page.tsx` | `Insumos` |
| `insumos/[id]/page.tsx` | `Detalle de insumo` |
| `notificaciones/page.tsx` | `Notificaciones` |
| `operativos/page.tsx` | `Operativos` |
| `operativos/[id]/page.tsx` | `Detalle de operativo` |
| `personal/page.tsx` | `Personal` |
| `procedimientos/page.tsx` | `Procedimientos` |
| `reportes/page.tsx` | `Reportes` |
| `turnos/page.tsx` | `Turnos` |
| `usuarios/page.tsx` | `Usuarios` |
| `vecinos/page.tsx` | `Vecinos` |
| `zonas/page.tsx` | `Zonas` |

Ejemplo completo de `src/app/(panel)/vecinos/page.tsx` después del cambio:

```tsx
import type { Metadata } from "next";
import { GestionVecinos } from "@/components/vecinos/gestion-vecinos";
import { tienePermiso } from "@/lib/permisos";
import { exigirPermisoPagina } from "@/lib/sesion";

export const metadata: Metadata = { title: "Vecinos" };

/** F1 — Vecinos (gestión: administrador y operador; consulta: veterinario). */
export default async function PaginaVecinos() {
  const sesion = await exigirPermisoPagina("vecinos:ver");
  return <GestionVecinos puedeGestionar={tienePermiso(sesion.rol, "vecinos:gestionar")} />;
}
```

- [ ] **Step 7: Verificación estática**

Run: `npx tsc --noEmit` → sin errores.
Run: `npm run lint` → 0 errores (1 advertencia previa aceptada en `src/lib/cliente-api.ts`).

---

### Task 5: Prueba de humo sobre la base de demostración

**Files:**
- Create: `tests/humo/fase6.mjs`

- [ ] **Step 1: Crear `tests/humo/fase6.mjs`**

```js
/**
 * Prueba de humo de la Fase 6 contra el servidor de producción (`next start`) con la base de
 * demostración recién cargada (`npm run db:demo:test`, el mismo día). Verifica los usuarios de
 * la demo, el inicio y los reportes con los valores del escenario, el circuito completo del
 * día (iniciar el operativo, registrar un procedimiento, finalizar), la notificación al vecino
 * de prueba de correo, la página 404 y los títulos de pestaña.
 * Uso (desde la raíz del proyecto): node tests/humo/fase6.mjs [url-base]
 * Resultado esperado: "Prueba de humo de la Fase 6: OK (28 verificaciones)".
 */
try {
  process.loadEnvFile(".env");
} catch {
  // Sin .env se usan los valores por defecto de .env.example.
}

const BASE = process.argv[2] ?? "http://localhost:3107";
/** Cookie de sesión por usuario: administrador, operador y veterinaria de la demo. */
const cookies = { admin: "", oper: "", vet: "" };
/** Cantidad de verificaciones superadas (lección L6: se reporta el número exacto). */
let verificaciones = 0;

/** Llama al servidor con la sesión indicada (o sin sesión) y guarda la cookie que devuelva el login. */
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
  return { estado: respuesta.status, datos, texto };
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

const CORREO_PRUEBA = "mepotdf@gmail.com";
/** Fecha local de Río Grande (UTC−3) en formato YYYY-MM-DD. */
const hoy = new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10);
// Período por defecto de los reportes: del día 1 de hace 11 meses hasta hoy.
const [anio, mes] = hoy.split("-").map(Number);
const desde = new Date(Date.UTC(anio, mes - 12, 1)).toISOString().slice(0, 10);
const periodo = `desde=${desde}&hasta=${hoy}`;
const chip = `985141${String(Date.now()).slice(-9)}`;

// 1) Usuarios de la demo
let r = await llamar("admin", "POST", "/api/auth/login", {
  email: process.env.SEED_ADMIN_EMAIL ?? "admin@sigcan.local",
  password: process.env.SEED_ADMIN_PASSWORD ?? "Admin1234",
});
verificar("login del administrador", r.estado === 200, r);
r = await llamar("oper", "POST", "/api/auth/login", { email: "operador@sigcan.local", password: "Operador1234" });
verificar("login del operador de la demo", r.estado === 200, r);
r = await llamar("vet", "POST", "/api/auth/login", { email: "veterinaria@sigcan.local", password: "Veterinaria1234" });
verificar("login de la veterinaria de la demo", r.estado === 200, r);

// 2) Inicio del operador con los valores del escenario
r = await llamar("oper", "GET", "/api/dashboard");
const totales = r.datos?.totales;
verificar(
  "totales: 29 vecinos activos, 50 animales, 16 castrados y 16 chipeados",
  r.estado === 200 && totales.vecinos_activos === 29 && totales.animales === 50 && totales.castrados === 16 &&
    totales.chipeados === 16,
  totales,
);
verificar("5 turnos de hoy", r.datos.turnos_hoy.length === 5, r.datos.turnos_hoy.length);
verificar(
  "1 insumo bajo el mínimo y 4 avistamientos pendientes",
  r.datos.insumos_bajo_minimo.total === 1 && r.datos.avistamientos_pendientes.total === 4,
  { insumos: r.datos.insumos_bajo_minimo.total, avistamientos: r.datos.avistamientos_pendientes.total },
);

// 3) Reportes de los últimos 12 meses
r = await llamar("oper", "GET", `/api/reportes?${periodo}`);
const suma = (clave) => r.datos.procedimientos.reduce((total, fila) => total + fila[clave], 0);
verificar("16 castraciones y 16 chipeos", r.estado === 200 && suma("castraciones") === 16 && suma("chipeos") === 16, r.datos?.procedimientos);
verificar("cumplimiento 80 % (8 realizados, 2 cancelados)", r.datos.cumplimiento.porcentaje === 80, r.datos.cumplimiento);
verificar("asistencia 75 % (24 completados, 8 ausentes)", r.datos.asistencia.porcentaje === 75, r.datos.asistencia);
const avisos = r.datos.avistamientos.meses.reduce((total, m) => total + m.pendientes + m.atendidos, 0);
verificar("18 avistamientos en el período", avisos === 18, r.datos.avistamientos);

// 4) Veterinaria: sus turnos de hoy; el operativo todavía no empezó
r = await llamar("vet", "GET", "/api/dashboard");
verificar(
  "inicio de la veterinaria con sus 5 turnos de hoy",
  r.datos.tipo === "veterinario" && r.datos.motivo === null && r.datos.turnos_hoy.length === 5,
  r.datos,
);
const operativoHoy = r.datos.turnos_hoy[0].operativo_id;
r = await llamar("vet", "GET", "/api/procedimientos/turnos");
verificar("sin operativo en curso no hay turnos para atender", r.datos.habilitado && r.datos.turnos.length === 0, r.datos);

// 5) Circuito del día: iniciar, atender un turno y finalizar
r = await llamar("admin", "POST", `/api/operativos/${operativoHoy}/estado`, { estado: "en_curso" });
verificar("inicio del operativo de hoy", r.estado === 200, r);
r = await llamar("vet", "GET", "/api/procedimientos/turnos");
verificar("4 turnos confirmados para atender", r.datos.turnos.length === 4, r.datos);
const turnoDoble = r.datos.turnos.find((turno) => turno.tipo_solicitado === "castracion_y_chipeo");
r = await llamar("oper", "GET", "/api/insumos/opciones");
const ketamina = r.datos.find((opcion) => opcion.etiqueta.startsWith("Ketamina"));
verificar("la ketamina figura entre los insumos disponibles", Boolean(ketamina), r.datos);
r = await llamar("vet", "POST", "/api/procedimientos", {
  turno_id: turnoDoble.id, tipo: "castracion_y_chipeo", numero_chip_colocado: chip,
  observaciones: "Prueba de humo de la Fase 6", insumos: [{ insumo_id: ketamina.id, cantidad: 2.5 }],
});
verificar("registro del procedimiento (201)", r.estado === 201, r);
r = await llamar("vet", "GET", `/api/insumos/${ketamina.id}`);
verificar("ketamina descontada de 460,00 a 457,50", r.datos.stock_actual === "457.50", r.datos);
r = await llamar("vet", "GET", `/api/historial?animal_id=${turnoDoble.animal_id}`);
verificar("historial del animal con el chip colocado", r.datos.total === 1 && r.datos.filas[0].descripcion.includes(chip), r.datos);
r = await llamar("admin", "POST", `/api/operativos/${operativoHoy}/estado`, { estado: "realizado" });
verificar("finalización: 4 turnos cancelados por «No se presentó»", r.estado === 200 && r.datos.turnosCancelados === 4, r);
r = await llamar("oper", "GET", `/api/reportes?${periodo}`);
verificar(
  "asistencia actualizada: 25 completados y 12 ausentes",
  r.datos.asistencia.completados === 25 && r.datos.asistencia.ausentes === 12,
  r.datos.asistencia,
);

// 6) Notificación al vecino de prueba de correo (con SMTP desactivado queda registrada, sin enviarse)
r = await llamar("oper", "GET", "/api/animales?busqueda=Toby");
verificar("Toby, el perro del vecino de prueba de correo, existe", r.datos.total === 1, r.datos);
const tobyId = r.datos.filas[0].id;
r = await llamar("oper", "GET", "/api/dashboard");
const destino = r.datos.proximos_operativos[0];
r = await llamar("oper", "POST", "/api/turnos", {
  animal_id: tobyId, operativo_id: destino.id, horario: "11:40", tipo_solicitado: "castracion",
});
verificar("turno para Toby en el próximo operativo (201)", r.estado === 201, r);
r = await llamar("oper", "POST", `/api/turnos/${r.datos.id}/confirmar`);
verificar("confirmación del turno de Toby", r.estado === 200, r);
r = await llamar("oper", "GET", `/api/notificaciones?busqueda=${encodeURIComponent(CORREO_PRUEBA)}&tipo=confirmacion`);
verificar(
  "confirmación registrada para mepotdf@gmail.com",
  r.estado === 200 && r.datos.filas.some((notificacion) => notificacion.email === CORREO_PRUEBA),
  r.datos,
);

// 7) Usabilidad: 404, títulos de pestaña y permisos de página
r = await llamar("admin", "GET", "/pagina-que-no-existe");
verificar("ruta inexistente → 404", r.estado === 404, r.estado);
r = await llamar("admin", "GET", "/vecinos");
verificar("título de pestaña «Vecinos · SIGCAN»", r.estado === 200 && r.texto.includes("<title>Vecinos · SIGCAN</title>"), r.estado);
r = await llamar(null, "GET", "/login");
verificar(
  "título de pestaña «Iniciar sesión · SIGCAN»",
  r.estado === 200 && r.texto.includes("<title>Iniciar sesión · SIGCAN</title>"),
  r.estado,
);
r = await llamar("vet", "GET", "/reportes");
verificar("la veterinaria no accede a /reportes (redirección 307)", r.estado === 307, r.estado);

console.log(`\nPrueba de humo de la Fase 6: OK (${verificaciones} verificaciones)`);
```

- [ ] **Step 2: Build, base de demostración y humo**

Run: `npm run build` → build exitoso.
Run: `npm run db:demo:test` → `Base reiniciada con datos de demostración (1 migraciones aplicadas)`.

Levantar el servidor contra la base de test con SMTP desactivado (en otra terminal; PowerShell):

```powershell
$env:DATABASE_URL = "postgres://sigcan:sigcan@localhost:5433/sigcan_test"; $env:SMTP_HOST = ""; npx next start -p 3107
```

(En bash: `DATABASE_URL=postgres://sigcan:sigcan@localhost:5433/sigcan_test SMTP_HOST= npx next start -p 3107`.)

Run: `node tests/humo/fase6.mjs http://localhost:3107`
Expected: 28 líneas con `✓` y al final `Prueba de humo de la Fase 6: OK (28 verificaciones)`.

Detener el servidor (Ctrl+C). El humo modifica la base: para repetirlo, volver a ejecutar `npm run db:demo:test` con el servidor detenido (L9).

---

### Task 6: Recorridos por rol (checklist y ejecución)

**Files:**
- Create: `docs/verificacion/recorridos.md`

- [ ] **Step 1: Crear `docs/verificacion/recorridos.md`**

```markdown
# SIGCAN — Recorridos de verificación por rol

Evidencia de la "verificación interna del equipo" que pide la consigna (Fase 3: Desarrollo).
Cada paso indica el resultado esperado; en "Resultado" se anota **OK**, **Falla (H-n)** (con el
número de hallazgo registrado en `docs/superpowers/desviaciones/fase6.md`) o **Pendiente (usuario)**.

## Preparación

1. `docker compose up -d` y `npm run db:demo` **el mismo día del recorrido** (el operativo "de hoy" se crea con la fecha de ejecución).
2. `npm run dev` y abrir http://localhost:3000.
3. Credenciales:

| Rol | Email | Contraseña |
|---|---|---|
| Administrador | `admin@sigcan.local` (o `SEED_ADMIN_EMAIL`) | `Admin1234` (o `SEED_ADMIN_PASSWORD`) |
| Operador | `operador@sigcan.local` | `Operador1234` |
| Veterinaria (asignada al operativo de hoy) | `veterinaria@sigcan.local` | `Veterinaria1234` |
| Veterinario (sin turnos hoy) | `veterinario@sigcan.local` | `Veterinario1234` |

Fecha del recorrido: ____ · Ejecutado por: ____

## R-ADM — Administrador

| N° | Paso | Resultado esperado | Resultado |
|---|---|---|---|
| ADM-1 | Ingresar con el administrador | Inicio con 4 totales (29 vecinos activos, 50 animales, 16 castrados, 16 chipeados), 5 turnos de hoy, próximos operativos, "Gasas estériles" bajo el mínimo y 4 avistamientos pendientes | |
| ADM-2 | Menú lateral | Ve todos los módulos, incluidos Usuarios, Zonas y Reportes | |
| ADM-3 | Usuarios: crear un operador nuevo, desactivarlo e intentar ingresar con él | Alta correcta; con el usuario inactivo el ingreso se rechaza | |
| ADM-4 | Zonas: crear "Zona de prueba" y luego intentar eliminar "Centro" | Alta correcta; "Centro" no se elimina porque tiene vecinos/operativos asociados | |
| ADM-5 | Personal: ver a Ana, Martín y Carla; intentar crear un veterinario sin matrícula | La matrícula es obligatoria para tipo veterinario | |
| ADM-6 | Operativos: crear uno para dentro de 3 días con cupo 2 | Queda programado | |
| ADM-7 | Cancelar ese operativo sin marcar fuerza mayor | Se rechaza por faltar menos de 48 h | |
| ADM-8 | Cancelarlo marcando fuerza mayor y con motivo | Queda cancelado con motivo, fecha y usuario | |
| ADM-9 | Operativos: abrir el operativo de hoy e iniciarlo | Pasa a "En curso" | |
| ADM-10 | Notificaciones: listado y filtros por tipo y estado | El listado responde a los filtros | |
| ADM-11 | Reportes: cambiar zona y período | Los cinco indicadores se actualizan (gráfico y tabla); con "desde" posterior a "hasta" aparece el aviso | |
| ADM-12 | Cerrar sesión | Vuelve a la pantalla de ingreso | |

## R-OPE — Operador

| N° | Paso | Resultado esperado | Resultado |
|---|---|---|---|
| OPE-1 | Ingresar con el operador | Inicio general; el menú no muestra Usuarios | |
| OPE-2 | Vecinos: alta con un DNI ya cargado | Error en el campo DNI | |
| OPE-3 | Vecinos: alta correcta y búsqueda por apellido | El vecino aparece en la búsqueda | |
| OPE-4 | Animales: alta "con tutor" para ese vecino; alta "callejero" sin tutor | Ambas altas correctas; un callejero no admite tutor | |
| OPE-5 | Turnos: pedir turno para el animal nuevo en el próximo operativo | Queda pendiente | |
| OPE-6 | Pedir un segundo turno para el mismo animal | Se rechaza: ya tiene un turno activo | |
| OPE-7 | Confirmar el turno y luego reprogramarlo a otro horario | Confirmado y reprogramado | |
| OPE-8 | Dar de baja al vecino del paso 3 | Sus turnos activos quedan cancelados con motivo "Baja del vecino" | |
| OPE-9 | Insumos: registrar un ingreso de 10 paquetes de "Gasas estériles" | El stock sube a 25 y deja de figurar bajo el mínimo | |
| OPE-10 | Insumos: registrar un egreso mayor que el stock | Se rechaza (el stock nunca queda negativo) | |
| OPE-11 | Avistamientos: alta sin vecino; intentar fecha futura | Alta correcta; la fecha futura se rechaza | |
| OPE-12 | Atender un avistamiento pendiente eligiendo un operativo de su zona | Queda atendido; ya no muestra acciones de edición | |
| OPE-13 | Intentar abrir `/usuarios` escribiendo la dirección | Redirige al inicio | |

## R-VET — Veterinaria (Ana Ríos)

Requiere que el operativo de hoy esté "En curso" (ADM-9).

| N° | Paso | Resultado esperado | Resultado |
|---|---|---|---|
| VET-1 | Ingresar con la veterinaria | El inicio muestra solo sus turnos de hoy (5) | |
| VET-2 | Procedimientos: ver los turnos para atender | Figuran los 4 confirmados del operativo de hoy | |
| VET-3 | Registrar el turno "Castración y chipeo" con un chip de 12 dígitos | Error en el campo chip (15 dígitos) | |
| VET-4 | Registrarlo con un chip de 15 dígitos y 2,5 ml de Ketamina | Registro correcto; el turno desaparece de la lista | |
| VET-5 | Registrar otro turno pidiendo 1000 ml de Ketamina | "Stock insuficiente de Ketamina…" y nada cambia (stock, turno, animal) | |
| VET-6 | Historial: buscar el animal del paso 4 | Entrada con tipo, veterinaria, chip e insumos | |
| VET-7 | Avistamientos | Solo consulta: sin botones de alta ni acciones | |
| VET-8 | Intentar abrir `/reportes` | Redirige al inicio | |

Al terminar, el administrador **finaliza** el operativo de hoy: los turnos sin atender quedan cancelados con "No se presentó" y la asistencia de Reportes baja en consecuencia.

## R-VET2 — Veterinario sin turnos hoy (Martín Sosa)

| N° | Paso | Resultado esperado | Resultado |
|---|---|---|---|
| VT2-1 | Ingresar con el veterinario | Inicio sin turnos de hoy ("No hay turnos para hoy") | |
| VT2-2 | Procedimientos | Sin turnos para atender (no está asignado a un operativo en curso) | |

## R-F12 — Correo real (lo realiza el usuario)

Requiere completar en `.env` `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (en Gmail, una contraseña de aplicación) y `SMTP_FROM`, y reiniciar el servidor.

| N° | Paso | Resultado esperado | Resultado |
|---|---|---|---|
| F12-1 | Operador: pedir turno para "Toby" (vecina "Prueba Correo") en el próximo operativo y confirmarlo | En Notificaciones aparece una "Confirmación" para `mepotdf@gmail.com` | |
| F12-2 | Esperar el procesador o usar "Procesar pendientes" | La confirmación pasa a "Enviado" y el correo llega a `mepotdf@gmail.com` | |
| F12-3 | Cancelar el turno de Toby con un motivo | Llega el correo de cancelación con el motivo; el recordatorio queda "Anulado" | |

## R-GEN — Transversales

| N° | Paso | Resultado esperado | Resultado |
|---|---|---|---|
| GEN-1 | Abrir una dirección inexistente (ej.: `/inexistente`) | Página 404 en español con "Volver al inicio" | |
| GEN-2 | Títulos de pestaña al navegar | "Vecinos · SIGCAN", "Reportes · SIGCAN", etc. | |
| GEN-3 | Tema oscuro del sistema operativo en Inicio y Reportes | Textos, ejes, leyendas y tooltips legibles | |
| GEN-4 | Ventana angosta (≈ 400 px) en Vecinos y Reportes | Las tablas se desplazan horizontalmente sin romper la página | |
| GEN-5 | Ingreso con contraseña incorrecta | Mensaje de error sin revelar si el email existe | |
```

- [ ] **Step 2: Ejecutar los recorridos**

Con `npm run db:demo` recién ejecutado y `npm run dev` levantado:
- Si el entorno tiene navegador, ejecutar R-ADM, R-OPE, R-VET, R-VET2 y R-GEN en ese orden (ADM-9 antes de R-VET) y anotar el resultado de cada paso.
- Si no hay navegador, dejar los pasos como **Pendiente (usuario)** y declararlo (L8).
- R-F12 queda siempre como **Pendiente (usuario)**.
- Completar "Fecha del recorrido" y "Ejecutado por".

---

### Task 7: Hallazgos de los recorridos

**Files:**
- Modify: los que corresponda a cada hallazgo; `docs/superpowers/desviaciones/fase6.md`

Por cada paso con resultado distinto del esperado:

- [ ] **Step 1: Registrar el hallazgo** en la sección "Hallazgos de los recorridos" con este formato:

```markdown
### H-1 — <paso, ej.: OPE-8>
- Observado: <qué pasó>
- Esperado: <resultado esperado del checklist>
- Causa: <archivo:línea y explicación>
- Corrección: <qué se cambió> | Consulta al usuario: <si implica cambiar una regla de negocio>
- Test: <test agregado o ajustado en un archivo NUEVO de esta fase, o "no aplica (solo interfaz)">
```

- [ ] **Step 2: Corregir con el cambio mínimo**, sin cambiar reglas de negocio (regla 6). Si el error está en un servicio, agregar un test que lo reproduzca en `tests/services/hallazgos-fase6.test.ts` (archivo nuevo de esta fase) antes de corregirlo, y verificar que falla y luego pasa.
- [ ] **Step 3: Repetir el paso del recorrido** y anotar "OK (corregido en H-n)".
- [ ] **Step 4: Si no hubo hallazgos**, dejar en la sección: "Sin hallazgos: N pasos ejecutados, todos OK" (con N en número).

---

### Task 8: README final

**Files:**
- Replace: `README.md`

- [ ] **Step 1: Reemplazar `README.md`**

~~~markdown
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

Next.js 16 (App Router) + TypeScript · PostgreSQL 18 · Sequelize · Tailwind CSS v4 + shadcn/ui · Recharts · JWT (jose) · bcryptjs · Nodemailer · Vitest.

## Requisitos

- Node.js 20.9 o superior
- Docker Desktop

## Instalación

```bash
npm install
cp .env.example .env          # completar JWT_SECRET y CRON_SECRET (y SMTP_* para enviar correos)
docker compose up -d          # PostgreSQL 18 en localhost:5433 (bases sigcan y sigcan_test)
npm run db:demo               # crea el esquema y carga los datos de demostración
npm run dev                   # http://localhost:3000
```

Para una base vacía (solo roles, administrador y zonas), usar `npm run db:reset` en lugar de `npm run db:demo`.

## Datos de demostración

`npm run db:demo` **borra la base de desarrollo** y carga un escenario con fechas relativas al día
de ejecución: 30 vecinos en 6 zonas, 50 animales, 8 operativos realizados, 2 cancelados, uno
**de hoy** listo para iniciar y 3 futuros, insumos con consumo real y 18 avistamientos.
Conviene ejecutarlo el mismo día de la demostración.

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
Un procesador interno envía las pendientes periódicamente; también se puede forzar desde
Notificaciones → "Procesar pendientes" o con `POST /api/notificaciones/procesar` y el encabezado
`Authorization: Bearer <CRON_SECRET>`. En la demo, solo la vecina "Prueba Correo" (perro "Toby")
tiene email.

## Scripts

| Script | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `npm start` | Build y ejecución de producción |
| `npm run lint` | ESLint |
| `npm test` | Tests automáticos (recrean la base `sigcan_test`) |
| `npm run db:migrar` | Aplica migraciones pendientes |
| `npm run db:seed` | Carga datos iniciales (idempotente) |
| `npm run db:reset` | Borra la base de desarrollo, migra y siembra los datos iniciales |
| `npm run db:demo` | Igual que `db:reset` y además carga los datos de demostración |
| `npm run db:reset:test` / `npm run db:demo:test` | Lo mismo sobre la base de test |

## Verificación

- **Tests automáticos:** `npm test` (158 tests: servicios, reglas de negocio, restricciones de la base y escenario de demostración).
- **Pruebas de humo** contra el build de producción (`tests/humo/fase3.mjs` a `fase6.mjs`): ver las instrucciones al comienzo de cada archivo.
- **Recorridos por rol:** `docs/verificacion/recorridos.md`.

## Estructura

```
db/            migraciones y seeders (inicial y demostración)
scripts/       CLI de base de datos
src/app/       páginas (panel por rol) y API REST (Route Handlers)
src/components/ componentes de interfaz por módulo y comunes
src/services/  lógica de negocio (transacciones y reglas)
src/schemas/   validación (Zod) compartida entre cliente y servidor
src/lib/       conexión, asociaciones, permisos, fechas, correo y utilidades
src/models/    un modelo Sequelize por tabla del ERD
tests/         tests automáticos (Vitest) y pruebas de humo
docs/          consigna, diseño, planes, recorridos de verificación
```
~~~

**Verificación del README:** comprobar que la ruta `POST /api/notificaciones/procesar` con `Authorization: Bearer <CRON_SECRET>` y el botón "Procesar pendientes" existen en el código (`src/app/api/notificaciones/procesar/route.ts` y `src/components/notificaciones/`). Si alguno difiere (ej.: otro encabezado u otro texto de botón), corregir **el README** para que diga lo que hace el código y registrarlo.

---

### Task 9: Refactorización, verificación completa y punto de control

**Files:**
- Modify: `docs/superpowers/desviaciones/fase6.md`

- [ ] **Step 1: Revisión de duplicación**

- `scripts/db.ts`: `reset` y `demo` deben usar `reiniciarBase()` (sin repetir el `DROP SCHEMA`).
- `db/seeders/demo.ts`: la descripción del historial debe salir de `redactarDescripcion` (no redactarla a mano).
- Correcciones de la Task 7: que reutilicen helpers existentes (`condicionDiasLocales`, `limitesDelRango`, `porcentaje`, `FiltroZona`, `FiltroFecha`, `AreaTexto`, `estadoEnTexto`) en lugar de duplicarlos.

Registrar en desviaciones cualquier cambio fuera del plan.

- [ ] **Step 2: Verificación estática y tests (Docker levantado, L5)**

Run: `docker ps --format "{{.Names}} {{.Status}}"` → `sigcan-db … (healthy)`.
Run: `npx tsc --noEmit` → sin errores.
Run: `npm run lint` → 0 errores (1 advertencia previa aceptada en `src/lib/cliente-api.ts`).
Run: `npm test` → PASS, **158 tests** (más los de `hallazgos-fase6.test.ts`, si la Task 7 los agregó: anotar el total exacto).

- [ ] **Step 3: Build**

Run: `npm run build` → build exitoso.

- [ ] **Step 4: Humos de regresión (Fases 5, 4 y 3) sobre base limpia (L9)**

Con el servidor detenido: `npm run db:reset:test`.
Levantar el servidor contra la base de test con SMTP desactivado (comando de la Task 5, Step 2). Antes de las 22:55 hora de Río Grande (requisito del humo de la Fase 4):

Run: `node tests/humo/fase5.mjs http://localhost:3107` → `OK (28 verificaciones)`.
Run: `node tests/humo/fase4.mjs http://localhost:3107` → `Prueba de humo de la Fase 4: OK` (27 `✓`).
Run: `node tests/humo/fase3.mjs http://localhost:3107` → `Prueba de humo de la Fase 3: OK` (25 `✓`).

Detener el servidor.

- [ ] **Step 5: Humo de la Fase 6 sobre la base de demostración (L9)**

Con el servidor detenido: `npm run db:demo:test`. Levantar el servidor de nuevo (mismo comando).

Run: `node tests/humo/fase6.mjs http://localhost:3107` → `Prueba de humo de la Fase 6: OK (28 verificaciones)`.

Detener el servidor y verificar que no quede ningún proceso escuchando en el puerto 3107.

- [ ] **Step 6: Dejar la base de desarrollo con la demo**

Run: `npm run db:demo` → la base `sigcan` queda lista para el recorrido del usuario.

- [ ] **Step 7: Autocomparación final (L3 y L7)**

Comparar cada archivo "Create"/"Replace" de las Tasks 1–8 con su bloque del plan y revisar que cada bloque "Modify" quedó aplicado (incluidas las 16 páginas con `metadata`). Anotar cuántos archivos se compararon.

- [ ] **Step 8: Checklist de cierre (L10) en `docs/superpowers/desviaciones/fase6.md`**

Completar la sección "Verificación" copiando este checklist con cada valor real (o `NO EJECUTADO: <motivo>`, L8):

```markdown
## Verificación

- [ ] Autocomparación: N archivos creados/reemplazados y M modificados revisados contra el plan
- [ ] `npx tsc --noEmit`: <0 errores>
- [ ] `npm run lint`: <0 errores, 1 advertencia previa>
- [ ] `npm test`: <158 passed (24 archivos)>
- [ ] `npm run build`: <exitoso>
- [ ] Humo Fase 5: <28/28>
- [ ] Humo Fase 4: <27/27>
- [ ] Humo Fase 3: <25/25>
- [ ] Humo Fase 6: <28/28>
- [ ] Recorridos: <X de Y pasos OK, Z pendientes del usuario, H hallazgos>
- [ ] Base de desarrollo con `npm run db:demo` el <fecha>
```

Y en "Cambios respecto del plan": la lista de cambios o "Sin desviaciones." (solo después del Step 7).

**Punto de control:** detenerse y avisar al usuario que la Fase 6 está lista para commitear (no ejecutar git), con el checklist completo y la lista de recorridos que quedaron para el usuario (como mínimo R-F12, el correo real a `mepotdf@gmail.com`).
