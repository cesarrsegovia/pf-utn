# SIGCAN Fase 2 (Catálogos) — Plan de implementación

> **Estado (28/10):** este plan quedó escrito solo hasta la Task 3. La Fase 2 se implementó directamente (Tasks 1–15); ver `docs/superpowers/desviaciones/fase2.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CRUD completos de F10 Zonas, F5 Personal actuante, F1 Vecinos (con baja lógica en cascada), F2 Animales y F6 Insumos (con movimientos de stock bajo bloqueo de fila), con búsqueda, paginación, validación doble (cliente/servidor) y permisos por rol.

**Architecture:** Igual que la Fase 1: Route Handler → `requerirSesion(accion)` → Zod → servicio con transacción. Se agregan helpers compartidos para que los cinco módulos no repitan código: `condicionBusqueda()` (búsqueda sin tildes), `exigirValorUnico()`, `buscarPorId()`, `leerId()`, el hook `useListado()` y los componentes `ListadoPaginado`, `FormularioDialogo`, `SelectOpciones`, `FiltroSelect` y `AccionesFila`.

**Tech Stack:** Next.js 16.4 (App Router), Sequelize 6, Zod 4, react-hook-form + @hookform/resolvers, SWR, shadcn/ui (Base UI), Vitest 3. **No se instalan dependencias nuevas.**

**Spec:** `docs/superpowers/specs/2026-10-28-sigcan-design.md` — §4 (roles y permisos), §5 F1, F2, F5, F6, F10 y §6 (errores y UX).

---

## 0. Reglas para quien implemente (leer antes de empezar)

1. **Git:** no ejecutar ningún comando de git (ni siquiera `git status`). Los "Puntos de control" son avisos al usuario (ver `CLAUDE.md`).
2. **Desviaciones:** crear `docs/superpowers/desviaciones/fase2.md` al empezar (con "Sin desviaciones" si no hay ninguna). Copiar el código tal como está; si algo no compila o no funciona con la versión instalada, hacer el cambio mínimo, **registrarlo** (archivo, qué decía el plan, qué se cambió y por qué) y dejar un comentario en el código. No hay desviaciones "silenciosas".
3. **Tests:** prohibido modificar un test del plan para que pase. Si un test parece incorrecto, detenerse y registrarlo como desviación.
4. **Dependencias:** no instalar nada. No ejecutar `npx shadcn add` (todos los componentes de UI necesarios ya existen).
5. **Modelos:** no se crean modelos nuevos. Los 16 existentes ya tienen `modelName` explícito (corrección de la revisión de Fase 1); no quitarlo.
6. **shadcn/ui con Base UI:** usar la prop `render` (nunca `asChild`). `NativeSelect` envuelve el `<select>` en un `div` con `w-fit`: en formularios pasarle `className="w-full"`. Para un enlace con estilo de botón usar `buttonVariants` sobre `<Link>`.
7. **Comentarios:** todo archivo nuevo lleva comentarios profesionales, claros y concisos en español (ya incluidos en el código del plan; mantenerlos).
8. **Alcance:** no implementar nada de fases posteriores (operativos, turnos, procedimientos, notificaciones por correo). Las únicas referencias a turnos/operativos son las reglas de baja de F1, F2 y F5 que el spec exige.
9. **Archivos que no se tocan:** `CLAUDE.md`, `AGENTS.md`, `docs/` (salvo el archivo de desviaciones), los tests de las Fases 0 y 1, y `src/models/*`.
10. **Verificación en producción obligatoria (Task 15):** además de `npm test`, se levanta `npm run build && npm start` y se prueban los endpoints con `curl`. La revisión de la Fase 1 encontró un defecto que solo aparecía en producción.

## 1. Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/lib/constantes.ts` (modificar) | Agrega `MOTIVOS_CANCELACION` |
| `src/lib/texto.ts` | Normalizar texto (minúsculas, sin tildes) y escapar comodines de LIKE |
| `src/lib/busqueda.ts` | `condicionBusqueda()`: "contiene" sin mayúsculas ni tildes sobre varias columnas |
| `src/lib/fechas.ts` | Fecha local de Río Grande, suma de días y formatos de fecha para la UI |
| `src/lib/cantidades.ts` | Aritmética de stock en centésimos y formato `es-AR` |
| `src/lib/api.ts` (modificar) | Agrega `ContextoId` y `leerId()` |
| `src/lib/formularios.ts` | `mostrarErrorFormulario()`: errores de la API en campos + toast |
| `src/lib/etiquetas.ts` (modificar) | Etiquetas de sexo, condición, tipo de personal y tipo de movimiento |
| `src/lib/navegacion.ts` (modificar) | Ítems Vecinos, Animales, Personal, Insumos, Zonas |
| `src/schemas/comun.ts` (modificar) | `textoOpcional`, `cantidadPositiva`, `cantidadNoNegativa`, tipo `Opcion` |
| `src/schemas/{zonas,personal,vecinos,animales,insumos}.ts` | Validación compartida cliente/servidor |
| `src/services/comun.ts` | `nuloSiVacio`, `exigirValorUnico`, `buscarPorId`, `enumerarAsociados` |
| `src/services/{zonas,personal,vecinos,animales,insumos}.ts` | Reglas de negocio de F10, F5, F1, F2, F6 |
| `src/app/api/{zonas,personal,vecinos,animales,insumos}/**/route.ts` | API REST |
| `src/hooks/use-listado.ts` | Estado de un listado paginado (página, búsqueda, filtros) + SWR |
| `src/components/comunes/{listado-paginado,formulario-dialogo,select-opciones,filtro-select,acciones-fila}.tsx` | Componentes reutilizables nuevos |
| `src/components/{zonas,personal,vecinos,animales,insumos}/*` | Pantallas de cada módulo |
| `src/app/(panel)/{zonas,personal,vecinos,animales,insumos}/page.tsx`, `src/app/(panel)/insumos/[id]/page.tsx` | Páginas |
| `tests/helpers/fabricas.ts` (modificar) | Fábricas de zona, vecino, animal, operativo y turno |
| `tests/lib/utilidades.test.ts`, `tests/services/{zonas,personal,vecinos,animales,insumos}.test.ts` | Tests |
| `src/services/usuarios.ts`, `src/app/api/usuarios/[id]/route.ts`, `src/components/usuarios/*` (modificar en Task 14) | Refactorización para usar los helpers nuevos |

## 2. Decisiones de esta fase (para la defensa)

- **Especie:** el sistema atiende caninos (spec). `especie` queda en su valor por defecto `canino` y no se muestra en el formulario.
- **Chip:** 15 dígitos (estándar ISO 11784/11785 de microchips de identificación animal).
- **DNI:** 7 u 8 dígitos sin puntos.
- **Stock inicial de un insumo:** si es mayor a 0 se registra como un movimiento de ingreso "Stock inicial", para que todo el stock tenga trazabilidad. La edición de un insumo no modifica el stock; el stock solo cambia por movimientos.
- **Motivo obligatorio** en los movimientos manuales de stock (trazabilidad de ajustes).
- **Baja de personal:** si fue asignado a algún operativo (aunque ya haya pasado) o tiene procedimientos, se desactiva en lugar de borrarse (la tabla `operativo_veterinario` lo referencia). No se puede eliminar ni desactivar si está asignado a un operativo programado o en curso con fecha de hoy en adelante.
- **Baja de vecino:** además de cancelar sus turnos pendientes o confirmados (motivo "Baja del vecino"), sus recordatorios pendientes pasan a `anulado`, igual que en cualquier cancelación de turno (spec F3).
- **Tutor dado de baja:** no se puede asignar como tutor a un vecino inactivo, pero un animal existente conserva su tutor aunque este sea dado de baja.
- **Formularios:** se montan solo mientras el diálogo está abierto (`{abierto && <Formulario key=… />}`), así cada apertura empieza con valores limpios. En la Task 14 se aplica lo mismo al formulario de usuarios de la Fase 1, que conservaba los valores de la apertura anterior.

---

### Task 1: Utilidades compartidas (TDD)

**Files:**
- Modify: `src/lib/constantes.ts`
- Create: `src/lib/texto.ts`, `src/lib/fechas.ts`, `src/lib/cantidades.ts`
- Test: `tests/lib/utilidades.test.ts`

- [ ] **Step 0: Crear el archivo de desviaciones**

Crear `docs/superpowers/desviaciones/fase2.md` con el contenido:

```markdown
# Registro de desviaciones — Fase 2 (Catálogos)

Sin desviaciones.
```

(Reemplazar "Sin desviaciones." por entradas a medida que aparezcan.)

- [ ] **Step 1: Agregar al final de `src/lib/constantes.ts`**

```ts

/** Motivos de cancelación de turnos generados automáticamente por el sistema. */
export const MOTIVOS_CANCELACION = {
  /** F1: el vecino fue dado de baja (cascada sobre sus turnos activos). */
  bajaVecino: "Baja del vecino",
  /** F4: el operativo finalizó y el turno seguía pendiente o confirmado. */
  noSePresento: "No se presentó",
} as const;
```

- [ ] **Step 2: Escribir el test que falla `tests/lib/utilidades.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { aCentesimos, deCentesimos, formatearCantidad } from "@/lib/cantidades";
import { formatearFecha, sumarDias } from "@/lib/fechas";
import { escaparLike, normalizarTexto } from "@/lib/texto";

describe("texto", () => {
  it("normaliza a minúsculas sin tildes", () => {
    expect(normalizarTexto("Pérez ÁLVAREZ Güemes")).toBe("perez alvarez guemes");
  });

  it("escapa los comodines de LIKE", () => {
    expect(escaparLike("50%_a\\b")).toBe("50\\%\\_a\\\\b");
  });
});

describe("fechas", () => {
  it("suma días cruzando meses y años", () => {
    expect(sumarDias("2026-12-30", 3)).toBe("2027-01-02");
    expect(sumarDias("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("formatea una fecha YYYY-MM-DD como DD/MM/AAAA", () => {
    expect(formatearFecha("2026-11-05")).toBe("05/11/2026");
  });
});

describe("cantidades", () => {
  it("opera en centésimos sin errores de coma flotante", () => {
    expect(aCentesimos("0.10") + aCentesimos(0.2)).toBe(30);
    expect(deCentesimos(aCentesimos("12.25") - aCentesimos(0.75))).toBe("11.50");
  });

  it("formatea con coma decimal y unidad", () => {
    expect(formatearCantidad("2", "ml")).toBe("2,00 ml");
    expect(formatearCantidad(1234.5)).toBe("1.234,50");
  });
});
```

- [ ] **Step 3: Correr y verificar que falla**

Run: `npx vitest run tests/lib/utilidades.test.ts`
Expected: FAIL — no existen los módulos.

- [ ] **Step 4: `src/lib/texto.ts`**

```ts
/** Utilidades de texto compartidas por servidor y cliente. */

/** Minúsculas y sin tildes, para comparar textos ingresados por el usuario. */
export function normalizarTexto(texto: string): string {
  return texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Escapa los comodines de LIKE (`%`, `_` y `\`) para buscar el texto en forma literal. */
export function escaparLike(texto: string): string {
  return texto.replace(/[\\%_]/g, "\\$&");
}
```

- [ ] **Step 5: `src/lib/fechas.ts`**

```ts
import { ZONA_HORARIA } from "./constantes";

/**
 * Fechas del dominio. Las fechas sin hora (operativos, bajas) se manejan como texto
 * YYYY-MM-DD en la zona horaria de Río Grande, independientemente de la del servidor.
 */

/** Fecha actual en Río Grande con formato YYYY-MM-DD. */
export function hoyLocal(): string {
  // El locale en-CA formatea las fechas como YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_HORARIA }).format(new Date());
}

/** Suma (o resta, con valores negativos) días a una fecha YYYY-MM-DD. */
export function sumarDias(fecha: string, dias: number): string {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  // Date.UTC normaliza los desbordes de día/mes (ej.: 32 de diciembre → 1 de enero).
  return new Date(Date.UTC(anio, mes - 1, dia + dias)).toISOString().slice(0, 10);
}

/** YYYY-MM-DD → DD/MM/AAAA, para mostrar en pantalla. */
export function formatearFecha(fecha: string): string {
  const [anio, mes, dia] = fecha.split("-");
  return `${dia}/${mes}/${anio}`;
}

/** Fecha y hora (ISO o Date) en la zona horaria de Río Grande, formato corto argentino. */
export function formatearFechaHora(valor: string | Date): string {
  return new Intl.DateTimeFormat("es-AR", { timeZone: ZONA_HORARIA, dateStyle: "short", timeStyle: "short" }).format(
    new Date(valor),
  );
}
```

- [ ] **Step 6: `src/lib/cantidades.ts`**

```ts
/**
 * Cantidades de stock (columnas NUMERIC(10,2), que pg devuelve como texto).
 * Se opera en centésimos enteros para evitar errores de coma flotante (0.1 + 0.2).
 */

/** Convierte una cantidad (texto o número) a centésimos enteros. */
export function aCentesimos(valor: string | number): number {
  return Math.round(Number(valor) * 100);
}

/** Convierte centésimos a texto con dos decimales, listo para guardar en NUMERIC(10,2). */
export function deCentesimos(centesimos: number): string {
  return (centesimos / 100).toFixed(2);
}

/** Formato argentino con dos decimales y unidad opcional (ej.: "2,00 ml"). */
export function formatearCantidad(valor: string | number, unidad?: string): string {
  const texto = Number(valor).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return unidad ? `${texto} ${unidad}` : texto;
}
```

- [ ] **Step 7: Correr y verificar que pasa**

Run: `npx vitest run tests/lib/utilidades.test.ts`
Expected: PASS (6 tests).

---

### Task 2: Helpers de servidor y esquemas comunes

**Files:**
- Create: `src/lib/busqueda.ts`, `src/services/comun.ts`
- Modify: `src/lib/api.ts`, `src/schemas/comun.ts`

- [ ] **Step 1: `src/lib/busqueda.ts`**

```ts
import { Op, type WhereOptions } from "sequelize";
import { sequelize } from "./db";
import { escaparLike, normalizarTexto } from "./texto";

/**
 * Condición "contiene" sobre varias columnas, sin distinguir mayúsculas ni tildes.
 * `columnas` usa la notación calificada de Sequelize: "Vecino.apellido" para el modelo
 * principal o "vecino.dni" para un modelo incluido con ese alias.
 * Sin texto devuelve una condición vacía (no filtra).
 */
export function condicionBusqueda(columnas: string[], texto: string): WhereOptions {
  if (!texto) return {};
  const patron = `%${escaparLike(normalizarTexto(texto))}%`;
  return {
    [Op.or]: columnas.map((columna) =>
      sequelize.where(
        // La extensión unaccent no está instalada: translate() reemplaza las vocales con tilde.
        sequelize.fn("translate", sequelize.fn("lower", sequelize.col(columna)), "áéíóúü", "aeiouu"),
        { [Op.like]: patron },
      ),
    ),
  };
}
```

- [ ] **Step 2: `src/services/comun.ts`**

```ts
import {
  Op, type Attributes, type FindOptions, type Model, type ModelStatic, type Transaction, type WhereOptions,
} from "sequelize";
import { NoEncontradoError, ValidacionError } from "@/lib/errores";
import { escaparLike } from "@/lib/texto";

/** Convierte la cadena vacía de un campo opcional del formulario en NULL para la base. */
export function nuloSiVacio(valor: string): string | null {
  const limpio = valor.trim();
  return limpio === "" ? null : limpio;
}

/** Busca un registro por id o lanza 404 con el mensaje indicado. */
export async function buscarPorId<M extends Model>(
  modelo: ModelStatic<M>,
  id: number,
  mensaje: string,
  opciones: Omit<FindOptions<Attributes<M>>, "where"> = {},
): Promise<M> {
  const registro = await modelo.findByPk(id, opciones);
  if (!registro) throw new NoEncontradoError(mensaje);
  return registro;
}

/**
 * Verifica que ningún otro registro tenga el mismo valor en un campo único.
 * Lanza un error de validación asociado al campo, para mostrarlo junto al input.
 */
export async function exigirValorUnico(
  modelo: ModelStatic<Model>,
  campo: string,
  valor: string | number,
  mensaje: string,
  opciones: { excluirId?: number; sinMayusculas?: boolean; transaction?: Transaction } = {},
): Promise<void> {
  const where: WhereOptions = {
    [campo]: opciones.sinMayusculas ? { [Op.iLike]: escaparLike(String(valor)) } : valor,
    ...(opciones.excluirId ? { id: { [Op.ne]: opciones.excluirId } } : {}),
  };
  const repetidos = await modelo.count({ where, transaction: opciones.transaction });
  if (repetidos > 0) {
    throw new ValidacionError("Revise los datos ingresados", { [campo]: mensaje });
  }
}

/**
 * Texto legible a partir de conteos de registros asociados, omitiendo los ceros.
 * Ej.: [[3, "vecino", "vecinos"], [1, "operativo", "operativos"]] → "3 vecinos y 1 operativo".
 */
export function enumerarAsociados(conteos: Array<[cantidad: number, singular: string, plural: string]>): string {
  const partes = conteos
    .filter(([cantidad]) => cantidad > 0)
    .map(([cantidad, singular, plural]) => `${cantidad} ${cantidad === 1 ? singular : plural}`);
  if (partes.length <= 1) return partes.join("");
  return `${partes.slice(0, -1).join(", ")} y ${partes.at(-1)}`;
}
```

- [ ] **Step 3: Agregar al final de `src/lib/api.ts`**

```ts

/** Contexto de las rutas con un parámetro dinámico `[id]` (en Next.js 16 llega como Promise). */
export type ContextoId = { params: Promise<{ id: string }> };

/** Lee y valida el `[id]` numérico de la ruta (400 si no es un entero positivo). */
export async function leerId(params: ContextoId["params"]): Promise<number> {
  return esquemaId.parse((await params).id);
}
```

y agregar el import correspondiente junto a los existentes:

```ts
import { esquemaId } from "@/schemas/comun";
```

- [ ] **Step 4: Agregar al final de `src/schemas/comun.ts`**

```ts

/** Texto opcional: admite cadena vacía (el servicio la guarda como NULL). */
export const textoOpcional = (maximo: number) => z.string().trim().max(maximo, `Máximo ${maximo} caracteres`);

/** Verdadero si el número tiene como máximo dos decimales (columnas NUMERIC(10,2)). */
const conDosDecimales = (valor: number) => Math.abs(valor * 100 - Math.round(valor * 100)) < 1e-6;

/** Cantidad de stock mayor a cero, con hasta dos decimales. */
export const cantidadPositiva = z
  .number("Ingrese un número")
  .positive("Debe ser mayor a 0")
  .max(99_999_999.99, "Cantidad demasiado grande")
  .refine(conDosDecimales, "Máximo 2 decimales");

/** Cantidad de stock mayor o igual a cero, con hasta dos decimales. */
export const cantidadNoNegativa = z
  .number("Ingrese un número")
  .min(0, "No puede ser negativo")
  .max(99_999_999.99, "Cantidad demasiado grande")
  .refine(conDosDecimales, "Máximo 2 decimales");

/** Opción de una lista desplegable (zonas, vecinos, usuarios vinculables…). */
export interface Opcion {
  id: number;
  etiqueta: string;
}
```

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit`
Expected: sin errores.

---

### Task 3: Fábricas de datos de prueba

**Files:**
- Modify: `tests/helpers/fabricas.ts`

- [ ] **Step 1: Reemplazar la línea de import de modelos**

Reemplazar `import { Rol, Usuario } from "@/lib/db";` por:

```ts
import type { EstadoOperativo, EstadoTurno } from "@/lib/constantes";
import { Animal, Operativo, Rol, Turno, Usuario, Vecino, Zona } from "@/lib/db";
import { hoyLocal, sumarDias } from "@/lib/fechas";
```

(Si la línea `import type { NombreRol } from "@/lib/constantes";` ya existe, dejarla; TypeScript admite dos imports del mismo módulo.)

- [ ] **Step 2: Agregar al final de `tests/helpers/fabricas.ts`**

```ts

/** Zona cargada por el seed inicial ("Centro" por defecto). */
export async function zonaSemilla(nombre = "Centro"): Promise<Zona> {
  return (await Zona.findOne({ where: { nombre } }))!;
}

/** Crea un vecino con DNI y email únicos. Si se crea inactivo, registra la fecha de baja. */
export async function crearVecinoPrueba(opciones: { zonaId?: number; activo?: boolean } = {}): Promise<Vecino> {
  secuencia += 1;
  const activo = opciones.activo ?? true;
  return Vecino.create({
    nombre: "Vecino",
    apellido: `Prueba ${secuencia}`,
    dni: String(30_000_000 + secuencia),
    telefono: "2964400000",
    email: `vecino${secuencia}@prueba.local`,
    direccion: "Calle de Prueba 123",
    zona_id: opciones.zonaId ?? (await zonaSemilla()).id,
    activo,
    fecha_baja: activo ? null : hoyLocal(),
  });
}

/**
 * Crea un animal. `vecinoId` sin indicar crea un tutor nuevo; `null` crea un callejero.
 */
export async function crearAnimalPrueba(opciones: { vecinoId?: number | null; numeroChip?: string } = {}): Promise<Animal> {
  const vecinoId = opciones.vecinoId === undefined ? (await crearVecinoPrueba()).id : opciones.vecinoId;
  return Animal.create({
    nombre: "Animal de prueba",
    sexo: "M",
    condicion: vecinoId === null ? "callejero" : "con_tutor",
    vecino_id: vecinoId,
    numero_chip: opciones.numeroChip ?? null,
  });
}

/** Crea un operativo a `diasDesdeHoy` días (7 por defecto), de 09:00 a 13:00 y cupo 20. */
export async function crearOperativoPrueba(
  opciones: { diasDesdeHoy?: number; estado?: EstadoOperativo; zonaId?: number } = {},
): Promise<Operativo> {
  return Operativo.create({
    fecha: sumarDias(hoyLocal(), opciones.diasDesdeHoy ?? 7),
    hora_inicio: "09:00",
    hora_fin: "13:00",
    lugar: "SUM municipal",
    cupo_maximo: 20,
    estado: opciones.estado ?? "programado",
    zona_id: opciones.zonaId ?? (await zonaSemilla()).id,
  });
}

/** Crea un turno de castración a las 09:30 en el estado indicado. */
export async function crearTurnoPrueba(
  animalId: number,
  operativoId: number,
  estado: EstadoTurno = "pendiente",
): Promise<Turno> {
  return Turno.create({
    horario: "09:30",
    tipo_solicitado: "castracion",
    estado,
    motivo_cancelacion: estado === "cancelado" ? "Cancelado en prueba" : null,
    animal_id: animalId,
    operativo_id: operativoId,
  });
}
```

- [ ] **Step 3: Verificar que la suite existente sigue en verde**

Run: `npm test`
Expected: PASS — 33 tests previos + 6 de utilidades = 39.

---
