# SIGCAN Fase 1 (Acceso) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Inicio y cierre de sesión con JWT en cookie httpOnly, protección de páginas y API por rol, layout del panel con menú filtrado por rol, componentes reutilizables de listado/formulario y la funcionalidad completa F11 (Usuarios y roles).

**Architecture:** `src/lib/auth.ts` firma y verifica JWT sin tocar la base (lo usa `src/proxy.ts` como chequeo optimista). `src/lib/sesion.ts` lee la cookie en el servidor y revalida al usuario contra la base en cada request (un usuario desactivado pierde el acceso al instante). Los Route Handlers usan `manejarApi()` para convertir errores tipados en respuestas JSON uniformes. La lógica de negocio vive en `src/services/*`, que se prueba con Vitest contra la base de test.

**Tech Stack:** Next.js 16.4 (App Router, `proxy.ts`), jose 6, bcryptjs 3, Zod 4 (mensajes en español), react-hook-form + @hookform/resolvers, SWR, shadcn/ui (estilo `base-nova`, Base UI), sonner, Vitest 3.

**Spec:** `docs/superpowers/specs/2026-10-28-sigcan-design.md` — secciones 2 (arquitectura), 4 (roles y permisos), 5/F11 y 6 (errores y UX).

---

## 0. Reglas para quien implemente (leer antes de empezar)

1. **Git:** no ejecutar ningún comando de git. Los "Puntos de control" son avisos al usuario (ver `CLAUDE.md`).
2. **Código del plan:** copiar el código tal como está. Si algo no compila o no funciona con la versión instalada, hacer el cambio mínimo y **registrarlo** en `docs/superpowers/desviaciones/fase1.md` (archivo, qué decía el plan, qué se cambió y por qué). No hay desviaciones "silenciosas".
3. **Tests:** está prohibido modificar un test del plan para que pase. Si un test parece incorrecto, detenerse y registrarlo como desviación.
4. **Dependencias:** instalar solo las listadas en la Task 1. No agregar otras.
5. **Next.js 16:** antes de tocar `proxy.ts`, cookies o route handlers, leer `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md` y `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md`. `proxy.ts` reemplaza a `middleware.ts` y **corre en el runtime de Node.js** (no Edge). No usar `export const runtime` en el proxy.
6. **shadcn/ui con Base UI:** los componentes generados usan la prop `render` (no `asChild`). Después de cada `npx shadcn@latest add`, abrir el archivo generado y usar los nombres de export reales.
7. **Comentarios:** todo archivo nuevo lleva comentarios profesionales, claros y concisos en español (ya incluidos en el código del plan; mantenerlos).
8. **Alcance:** no implementar nada de fases posteriores (vecinos, turnos, etc.).

## 1. Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/lib/errores.ts` | Errores tipados con su código HTTP |
| `src/lib/restricciones.ts` | Mensajes en español para restricciones UNIQUE/FK de la base |
| `src/lib/auth.ts` | Firmar/verificar JWT de sesión (sin acceso a base de datos) |
| `src/lib/permisos.ts` | Acciones del sistema y matriz rol → acciones (spec §4) |
| `src/lib/sesion.ts` | Sesión del lado del servidor: leer/guardar/borrar cookie, exigir sesión y permisos |
| `src/lib/api.ts` | `manejarApi()`, conversión de errores a JSON, lectura de body y parámetros |
| `src/lib/cliente-api.ts` | `llamarApi()` para componentes cliente (fetch + manejo de errores) |
| `src/lib/etiquetas.ts` | Textos visibles para valores de dominio (roles, estados) |
| `src/lib/navegacion.ts` | Ítems del menú lateral con la acción requerida |
| `src/schemas/comun.ts` | Zod en español + esquemas comunes (id, listado) y tipos de paginación |
| `src/schemas/auth.ts`, `src/schemas/usuarios.ts` | Validación de login y usuarios (compartida cliente/servidor) |
| `src/services/auth.ts` | Autenticación por email y contraseña |
| `src/services/usuarios.ts` | F11: listar, obtener, crear, actualizar, eliminar/desactivar |
| `src/proxy.ts` | Redirección optimista según cookie de sesión |
| `src/app/api/auth/{login,logout}/route.ts` | Login y logout |
| `src/app/api/usuarios/route.ts`, `src/app/api/usuarios/[id]/route.ts` | API REST de usuarios |
| `src/app/(auth)/login/page.tsx` | Pantalla de inicio de sesión |
| `src/app/(panel)/layout.tsx` | Layout autenticado con barra lateral |
| `src/app/(panel)/dashboard/page.tsx` | Inicio provisorio (el dashboard real es de la Fase 5) |
| `src/app/(panel)/usuarios/page.tsx` | Página de gestión de usuarios |
| `src/components/layout/barra-lateral.tsx` | Menú filtrado por rol + usuario + cerrar sesión |
| `src/components/comunes/*` | Componentes reutilizables: encabezado, buscador, tabla, paginación, campo de formulario, diálogo de confirmación, badge de estado |
| `src/components/usuarios/*` | Gestión y formulario de usuarios |
| `tests/helpers/bd.ts` (modificar), `tests/helpers/fabricas.ts` | Reinicio de datos entre tests y fábricas de datos de prueba |
| `tests/lib/permisos.test.ts`, `tests/services/auth.test.ts`, `tests/services/usuarios.test.ts` | Tests |

9. **Desviaciones:** crear `docs/superpowers/desviaciones/fase1.md` al empezar (aunque quede vacío con "Sin desviaciones"). Además, todo cambio justificado respecto del plan lleva un comentario en el propio código que explique el motivo.
10. **CLIs:** cuando un comando (shadcn, npm) genere o modifique archivos de configuración no mencionados en el plan, registrarlo en el archivo de desviaciones antes de seguir.
11. **Archivos que no se tocan:** `CLAUDE.md`, `AGENTS.md` (lo regenera `next dev`), `docs/` (salvo el archivo de desviaciones) y los tests de la Fase 0.

---

### Task 0: Desactivar Cache Components

Decisión del usuario (28/10): SIGCAN es un panel interno donde todo se consulta por request; la caché de componentes de Next 16 obliga a envolver en `<Suspense>` cada página que lee la cookie de sesión y no aporta beneficio. Se desactiva.

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Quitar `cacheComponents` y `partialPrefetching`**

`next.config.ts` debe quedar exactamente así (se conserva la regla de Turbopack para Tailwind):

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sequelize y pg resuelven drivers con require dinámicos que el bundler no puede
  // empaquetar: se excluyen del bundle del servidor y se cargan desde node_modules.
  serverExternalPackages: ["sequelize", "pg", "pg-hstore"],
  // Cache Components queda desactivado (valor por defecto): SIGCAN es un panel interno
  // con datos por request y sesión en cookie; no se usa prerender parcial.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
```

- [ ] **Step 2: Verificar**

Run: `npm run build`
Expected: compila sin errores.

---

### Task 1: Dependencias y componentes de shadcn/ui

- [ ] **Step 1: Instalar dependencias**

```bash
npm install react-hook-form @hookform/resolvers swr server-only
```

- [ ] **Step 2: Agregar componentes de shadcn/ui**

```bash
npx shadcn@latest add input label card table dialog alert-dialog native-select badge sonner checkbox
```

Expected: se crean los archivos correspondientes en `src/components/ui/`. Abrir `dialog.tsx`, `alert-dialog.tsx`, `native-select.tsx`, `checkbox.tsx` y `sonner.tsx` y anotar los nombres de export (se usan en las Tasks 9–11).

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit`
Expected: sin errores.

---

### Task 2: Errores tipados y mensajes de restricciones

**Files:**
- Create: `src/lib/errores.ts`, `src/lib/restricciones.ts`

- [ ] **Step 1: `src/lib/errores.ts`**

```ts
/**
 * Errores de aplicación con su código HTTP asociado.
 * Los servicios lanzan estos errores y `manejarApi()` los convierte en respuestas JSON.
 */
export class ErrorAplicacion extends Error {
  constructor(
    mensaje: string,
    /** Código de estado HTTP con el que se responde. */
    public readonly estado: number,
    /** Errores asociados a campos del formulario (campo → mensaje). */
    public readonly campos?: Record<string, string>,
  ) {
    super(mensaje);
    this.name = new.target.name;
  }
}

/** 400: datos de entrada inválidos. */
export class ValidacionError extends ErrorAplicacion {
  constructor(mensaje: string, campos?: Record<string, string>) {
    super(mensaje, 400, campos);
  }
}

/** 401: no hay sesión válida o las credenciales son incorrectas. */
export class NoAutenticadoError extends ErrorAplicacion {
  constructor(mensaje = "Debe iniciar sesión para continuar") {
    super(mensaje, 401);
  }
}

/** 403: hay sesión, pero el rol no tiene permiso para la acción. */
export class ProhibidoError extends ErrorAplicacion {
  constructor(mensaje = "No tiene permisos para realizar esta acción") {
    super(mensaje, 403);
  }
}

/** 404: el recurso solicitado no existe. */
export class NoEncontradoError extends ErrorAplicacion {
  constructor(mensaje = "El registro solicitado no existe") {
    super(mensaje, 404);
  }
}

/** 409: la operación viola una regla de negocio. */
export class ReglaNegocioError extends ErrorAplicacion {
  constructor(mensaje: string) {
    super(mensaje, 409);
  }
}
```

- [ ] **Step 2: `src/lib/restricciones.ts`**

```ts
/**
 * Mensajes en español para las restricciones con nombre de la migración 0001.
 * Son el último resguardo: los servicios validan antes, pero si una regla llega a la
 * base (por ejemplo, por concurrencia), el usuario igual recibe un mensaje comprensible.
 */
const MENSAJES_RESTRICCION: Record<string, string> = {
  // Unicidad
  uq_usuario_email: "Ya existe un usuario con ese email",
  uq_zona_nombre: "Ya existe una zona con ese nombre",
  uq_vecino_dni: "Ya existe un vecino con ese DNI",
  uq_animal_chip: "Ya existe un animal con ese número de chip",
  uq_veterinario_matricula: "Ya existe personal con esa matrícula",
  uq_veterinario_usuario: "Ese usuario ya está vinculado a otro integrante del personal",
  uq_insumo_nombre: "Ya existe un insumo con ese nombre",
  uq_procedimiento_turno: "El turno ya tiene un procedimiento registrado",
  uq_procedimiento_chip: "Ese número de chip ya fue colocado",
  ux_turno_activo_por_animal: "El animal ya tiene un turno pendiente o confirmado",
  // Claves foráneas (al eliminar registros referenciados)
  fk_usuario_rol: "El rol indicado no existe",
  fk_vecino_zona: "La zona tiene vecinos asociados",
  fk_operativo_zona: "La zona tiene operativos asociados",
  fk_reporte_zona: "La zona tiene reportes de avistamiento asociados",
  fk_animal_vecino: "El vecino tiene animales asociados",
  fk_turno_animal: "El animal tiene turnos asociados",
  fk_turno_operativo: "El operativo tiene turnos asociados",
  fk_movimiento_insumo: "El insumo tiene movimientos de stock registrados",
  fk_pi_insumo: "El insumo fue usado en procedimientos",
  fk_procedimiento_veterinario: "El integrante del personal tiene procedimientos registrados",
};

/** Mensaje para una restricción violada, o uno genérico si no está mapeada. */
export function mensajeDeRestriccion(nombre: string | undefined, porDefecto: string): string {
  return (nombre && MENSAJES_RESTRICCION[nombre]) || porDefecto;
}
```

---

### Task 3: Permisos (TDD)

**Files:**
- Test: `tests/lib/permisos.test.ts`
- Create: `src/lib/permisos.ts`

- [ ] **Step 1: Escribir el test que falla**

```ts
import { describe, expect, it } from "vitest";
import { tienePermiso } from "@/lib/permisos";

describe("matriz de permisos (spec §4)", () => {
  it("solo el administrador gestiona usuarios", () => {
    expect(tienePermiso("administrador", "usuarios:gestionar")).toBe(true);
    expect(tienePermiso("operador", "usuarios:gestionar")).toBe(false);
    expect(tienePermiso("veterinario", "usuarios:gestionar")).toBe(false);
  });

  it("solo el administrador cancela operativos", () => {
    expect(tienePermiso("administrador", "operativos:cancelar")).toBe(true);
    expect(tienePermiso("operador", "operativos:cancelar")).toBe(false);
  });

  it("solo el veterinario registra procedimientos", () => {
    expect(tienePermiso("veterinario", "procedimientos:registrar")).toBe(true);
    expect(tienePermiso("administrador", "procedimientos:registrar")).toBe(false);
    expect(tienePermiso("operador", "procedimientos:registrar")).toBe(false);
  });

  it("el veterinario solo consulta vecinos y no accede a reportes", () => {
    expect(tienePermiso("veterinario", "vecinos:ver")).toBe(true);
    expect(tienePermiso("veterinario", "vecinos:gestionar")).toBe(false);
    expect(tienePermiso("veterinario", "reportes:ver")).toBe(false);
  });

  it("el operador ve zonas pero no las gestiona", () => {
    expect(tienePermiso("operador", "zonas:ver")).toBe(true);
    expect(tienePermiso("operador", "zonas:gestionar")).toBe(false);
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run tests/lib/permisos.test.ts`
Expected: FAIL — no existe `@/lib/permisos`.

- [ ] **Step 3: `src/lib/permisos.ts`**

```ts
import type { NombreRol } from "./constantes";

/**
 * Acciones controladas del sistema. Convención: `<módulo>:<operación>`.
 * "ver" = solo lectura; "gestionar" = alta, modificación y baja.
 */
export const ACCIONES = [
  "dashboard:ver",
  "vecinos:ver", "vecinos:gestionar",
  "animales:ver", "animales:gestionar",
  "turnos:ver", "turnos:gestionar",
  "operativos:ver", "operativos:gestionar", "operativos:cancelar",
  "personal:ver", "personal:gestionar",
  "insumos:ver", "insumos:gestionar",
  "procedimientos:registrar",
  "historial:ver",
  "avistamientos:ver", "avistamientos:gestionar",
  "zonas:ver", "zonas:gestionar",
  "usuarios:gestionar",
  "notificaciones:ver", "notificaciones:gestionar",
  "reportes:ver",
] as const;
export type Accion = (typeof ACCIONES)[number];

/** Matriz rol → acciones permitidas (spec §4). */
const PERMISOS_POR_ROL: Record<NombreRol, ReadonlySet<Accion>> = {
  // El administrador puede todo, salvo registrar procedimientos (exclusivo de veterinarios).
  administrador: new Set(ACCIONES.filter((accion) => accion !== "procedimientos:registrar")),
  operador: new Set<Accion>([
    "dashboard:ver",
    "vecinos:ver", "vecinos:gestionar",
    "animales:ver", "animales:gestionar",
    "turnos:ver", "turnos:gestionar",
    "operativos:ver", "operativos:gestionar",
    "personal:ver",
    "insumos:ver", "insumos:gestionar",
    "historial:ver",
    "avistamientos:ver", "avistamientos:gestionar",
    "zonas:ver",
    "notificaciones:ver",
    "reportes:ver",
  ]),
  veterinario: new Set<Accion>([
    "dashboard:ver",
    "vecinos:ver", "animales:ver", "turnos:ver", "operativos:ver",
    "personal:ver", "insumos:ver",
    "procedimientos:registrar",
    "historial:ver", "avistamientos:ver", "zonas:ver",
  ]),
};

/** Indica si un rol puede ejecutar una acción. */
export function tienePermiso(rol: NombreRol, accion: Accion): boolean {
  return PERMISOS_POR_ROL[rol].has(accion);
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npx vitest run tests/lib/permisos.test.ts`
Expected: PASS (5 tests).

---

### Task 4: Esquemas de validación

**Files:**
- Create: `src/schemas/comun.ts`, `src/schemas/auth.ts`, `src/schemas/usuarios.ts`

- [ ] **Step 1: `src/schemas/comun.ts`**

```ts
import { z } from "zod";

// Mensajes de validación de Zod en español para todo el sistema.
// Todos los esquemas deben importar `z` desde este módulo para heredar la configuración.
z.config(z.locales.es());

export { z };

/** Texto obligatorio, sin espacios sobrantes y con longitud máxima. */
export const textoRequerido = (maximo: number) =>
  z.string().trim().min(1, "Este campo es obligatorio").max(maximo, `Máximo ${maximo} caracteres`);

/** Identificador numérico recibido en la URL. */
export const esquemaId = z.coerce.number().int().positive();

/** Parámetros comunes de los listados: página, tamaño de página y texto de búsqueda. */
export const esquemaListado = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  tamanio: z.coerce.number().int().min(1).max(100).default(10),
  busqueda: z.string().trim().max(100).default(""),
});
export type ParametrosListado = z.infer<typeof esquemaListado>;

/** Respuesta estándar de los listados paginados. */
export interface ResultadoPaginado<T> {
  filas: T[];
  total: number;
  pagina: number;
  tamanio: number;
}
```

- [ ] **Step 2: `src/schemas/auth.ts`**

```ts
import { z } from "./comun";

/** Datos del formulario de inicio de sesión. */
export const esquemaLogin = z.object({
  email: z.email("Ingrese un email válido"),
  password: z.string().min(1, "Ingrese la contraseña"),
});
export type DatosLogin = z.infer<typeof esquemaLogin>;
```

- [ ] **Step 3: `src/schemas/usuarios.ts`**

```ts
import { ROLES } from "@/lib/constantes";
import { textoRequerido, z } from "./comun";

/** Campos comunes del alta y la edición de usuarios (F11). */
const camposUsuario = {
  nombre: textoRequerido(60),
  apellido: textoRequerido(60),
  email: z.email("Ingrese un email válido").max(120),
  rol: z.enum(ROLES, "Seleccione un rol"),
  activo: z.boolean(),
};

/** Alta: la contraseña es obligatoria (8 a 72 caracteres; 72 es el límite de bcrypt). */
export const esquemaCrearUsuario = z.object({
  ...camposUsuario,
  password: z.string().min(8, "Mínimo 8 caracteres").max(72, "Máximo 72 caracteres"),
});

/** Edición: contraseña vacía = conservar la actual. */
export const esquemaEditarUsuario = z.object({
  ...camposUsuario,
  password: z
    .string()
    .max(72, "Máximo 72 caracteres")
    .refine((valor) => valor === "" || valor.length >= 8, "Mínimo 8 caracteres"),
});

export type DatosUsuario = z.infer<typeof esquemaCrearUsuario>;
```

---

### Task 5: Autenticación (JWT) y servicio de login (TDD)

**Files:**
- Create: `src/lib/auth.ts`, `src/services/auth.ts`
- Modify: `tests/helpers/bd.ts`
- Create: `tests/helpers/fabricas.ts`
- Test: `tests/services/auth.test.ts`

- [ ] **Step 1: `src/lib/auth.ts`**

```ts
import { jwtVerify, SignJWT } from "jose";
import { ROLES, type NombreRol } from "./constantes";

/**
 * Firma y verificación del JWT de sesión.
 * Este módulo NO accede a la base de datos: lo usa `src/proxy.ts`, que solo hace un
 * chequeo optimista. La validación completa (usuario activo, rol vigente) la hace
 * `src/lib/sesion.ts` en cada página y Route Handler.
 */

export const COOKIE_SESION = "sigcan_sesion";
/** Duración de la sesión: una jornada laboral (8 horas). */
export const DURACION_SESION_SEGUNDOS = 8 * 60 * 60;

/** Datos que viajan dentro del token y que usa la aplicación. */
export interface DatosSesion {
  usuarioId: number;
  nombre: string;
  rol: NombreRol;
}

/** Clave HMAC derivada de JWT_SECRET; se exige una longitud mínima razonable. */
function claveSecreta(): Uint8Array {
  const secreto = process.env.JWT_SECRET;
  if (!secreto || secreto.length < 32) {
    throw new Error("JWT_SECRET debe estar definido en .env y tener al menos 32 caracteres");
  }
  return new TextEncoder().encode(secreto);
}

/** Genera el token firmado (HS256) para la sesión indicada. */
export async function firmarSesion(datos: DatosSesion): Promise<string> {
  return new SignJWT({ nombre: datos.nombre, rol: datos.rol })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(datos.usuarioId))
    .setIssuedAt()
    .setExpirationTime(`${DURACION_SESION_SEGUNDOS}s`)
    .sign(claveSecreta());
}

/** Verifica firma y vencimiento del token; devuelve null si no es válido. */
export async function verificarSesion(token: string | undefined): Promise<DatosSesion | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, claveSecreta(), { algorithms: ["HS256"] });
    const usuarioId = Number(payload.sub);
    const rol = payload.rol as NombreRol;
    if (!Number.isInteger(usuarioId) || !ROLES.includes(rol) || typeof payload.nombre !== "string") {
      return null;
    }
    return { usuarioId, nombre: payload.nombre, rol };
  } catch {
    // Firma inválida, token vencido o mal formado.
    return null;
  }
}
```

- [ ] **Step 2: Agregar `reiniciarDatos()` a `tests/helpers/bd.ts`**

Agregar estos imports al inicio del archivo (junto a los existentes) y la función al final:

```ts
import { QueryTypes } from "sequelize";
import { sembrarDatosIniciales } from "../../db/seeders/inicial";
```

```ts
/**
 * Vacía todas las tablas (reiniciando los identificadores) y vuelve a cargar los datos
 * iniciales. Se usa en `beforeEach` de los tests de servicios, que abren sus propias
 * transacciones y por eso no pueden aislarse con `enTransaccionRevertida`.
 */
export async function reiniciarDatos(): Promise<void> {
  const tablas = await sequelize.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables
     WHERE schemaname = 'public' AND tablename <> 'migraciones_aplicadas'`,
    { type: QueryTypes.SELECT },
  );
  const lista = tablas.map((tabla) => `"${tabla.tablename}"`).join(", ");
  await sequelize.query(`TRUNCATE ${lista} RESTART IDENTITY CASCADE`);
  await sembrarDatosIniciales();
}
```

- [ ] **Step 3: `tests/helpers/fabricas.ts`**

```ts
import bcrypt from "bcryptjs";
import type { DatosSesion } from "@/lib/auth";
import type { NombreRol } from "@/lib/constantes";
import { Rol, Usuario } from "@/lib/db";

/** Contador para generar emails y apellidos únicos dentro de una corrida. */
let secuencia = 0;

export const PASSWORD_PRUEBA = "Clave1234";

/** Crea un usuario de prueba. Usa costo 4 de bcrypt para que los tests sean rápidos. */
export async function crearUsuarioPrueba(
  opciones: { rol?: NombreRol; activo?: boolean; email?: string } = {},
): Promise<Usuario> {
  secuencia += 1;
  const rol = await Rol.findOne({ where: { nombre: opciones.rol ?? "operador" } });
  return Usuario.create({
    nombre: "Usuario",
    apellido: `Prueba ${secuencia}`,
    email: opciones.email ?? `usuario${secuencia}@prueba.local`,
    password_hash: await bcrypt.hash(PASSWORD_PRUEBA, 4),
    activo: opciones.activo ?? true,
    rol_id: rol!.id,
  });
}

/** Administrador creado por el seed inicial. */
export async function adminSemilla(): Promise<Usuario> {
  const admin = await Usuario.findOne({ where: { email: process.env.SEED_ADMIN_EMAIL } });
  return admin!;
}

/** Arma los datos de sesión de un usuario, como los entregaría `requerirSesion()`. */
export function sesionDe(usuario: Usuario, rol: NombreRol): DatosSesion {
  return { usuarioId: usuario.id, nombre: `${usuario.nombre} ${usuario.apellido}`, rol };
}
```

- [ ] **Step 4: Escribir el test que falla `tests/services/auth.test.ts`**

```ts
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { firmarSesion, verificarSesion } from "@/lib/auth";
import { sequelize } from "@/lib/db";
import { autenticar } from "@/services/auth";
import { reiniciarDatos } from "../helpers/bd";
import { crearUsuarioPrueba, PASSWORD_PRUEBA } from "../helpers/fabricas";

beforeEach(reiniciarDatos);
afterAll(() => sequelize.close());

describe("autenticación", () => {
  it("autentica con email (sin distinguir mayúsculas) y contraseña correctos", async () => {
    const usuario = await crearUsuarioPrueba({ rol: "veterinario", email: "vet@prueba.local" });
    const sesion = await autenticar("VET@prueba.local", PASSWORD_PRUEBA);
    expect(sesion).toEqual({ usuarioId: usuario.id, nombre: `Usuario ${usuario.apellido}`, rol: "veterinario" });
  });

  it("rechaza una contraseña incorrecta con mensaje genérico", async () => {
    await crearUsuarioPrueba({ email: "op@prueba.local" });
    await expect(autenticar("op@prueba.local", "otra-clave")).rejects.toThrow("Email o contraseña incorrectos");
  });

  it("rechaza un email inexistente con el mismo mensaje genérico", async () => {
    await expect(autenticar("nadie@prueba.local", PASSWORD_PRUEBA)).rejects.toThrow("Email o contraseña incorrectos");
  });

  it("rechaza a un usuario inactivo", async () => {
    await crearUsuarioPrueba({ email: "inactivo@prueba.local", activo: false });
    await expect(autenticar("inactivo@prueba.local", PASSWORD_PRUEBA)).rejects.toThrow("inactivo");
  });

  it("el token firmado se verifica y uno alterado se rechaza", async () => {
    const token = await firmarSesion({ usuarioId: 7, nombre: "Ana Pérez", rol: "operador" });
    expect(await verificarSesion(token)).toEqual({ usuarioId: 7, nombre: "Ana Pérez", rol: "operador" });
    expect(await verificarSesion(`${token}x`)).toBeNull();
    expect(await verificarSesion(undefined)).toBeNull();
  });
});
```

- [ ] **Step 5: Correr y verificar que falla**

Run: `npx vitest run tests/services/auth.test.ts`
Expected: FAIL — no existe `@/services/auth`.

- [ ] **Step 6: `src/services/auth.ts`**

```ts
import bcrypt from "bcryptjs";
import type { DatosSesion } from "@/lib/auth";
import { Usuario } from "@/lib/db";
import { NoAutenticadoError } from "@/lib/errores";

/**
 * Valida las credenciales y devuelve los datos de sesión del usuario.
 * Ante email inexistente o contraseña incorrecta responde el mismo mensaje,
 * para no revelar qué emails están registrados.
 */
export async function autenticar(email: string, password: string): Promise<DatosSesion> {
  const usuario = await Usuario.scope("conPassword").findOne({
    where: { email: email.trim().toLowerCase() },
    include: ["rol"],
  });

  const credencialesValidas = usuario !== null && (await bcrypt.compare(password, usuario.password_hash));
  if (!usuario || !credencialesValidas) {
    throw new NoAutenticadoError("Email o contraseña incorrectos");
  }
  if (!usuario.activo) {
    throw new NoAutenticadoError("El usuario está inactivo. Contacte al administrador");
  }

  return { usuarioId: usuario.id, nombre: `${usuario.nombre} ${usuario.apellido}`, rol: usuario.rol!.nombre };
}
```

- [ ] **Step 7: Correr y verificar que pasa**

Run: `npx vitest run tests/services/auth.test.ts`
Expected: PASS (5 tests).

---

### Task 6: Servicio de usuarios — F11 (TDD)

**Files:**
- Test: `tests/services/usuarios.test.ts`
- Create: `src/services/usuarios.ts`

Reglas (spec §5 F11): email único (se guarda en minúsculas); contraseña con hash bcrypt; un único rol; nadie puede desactivarse, eliminarse ni cambiarse el rol a sí mismo; debe quedar siempre al menos un administrador activo; un usuario vinculado a personal veterinario no puede dejar de tener rol veterinario; un usuario con registros asociados (movimientos de stock, reportes, cancelaciones de operativos o vínculo con personal) se desactiva en lugar de borrarse.

- [ ] **Step 1: Escribir el test que falla**

```ts
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { Insumo, MovimientoInsumo, sequelize, Usuario, Veterinario } from "@/lib/db";
import { actualizarUsuario, crearUsuario, eliminarUsuario, listarUsuarios } from "@/services/usuarios";
import type { DatosUsuario } from "@/schemas/usuarios";
import { reiniciarDatos } from "../helpers/bd";
import { adminSemilla, crearUsuarioPrueba, sesionDe } from "../helpers/fabricas";

beforeEach(reiniciarDatos);
afterAll(() => sequelize.close());

const datosValidos: DatosUsuario = {
  nombre: "María", apellido: "López", email: "Maria.Lopez@Prueba.local",
  password: "Segura123", rol: "operador", activo: true,
};

describe("crear usuario", () => {
  it("guarda el email en minúsculas y la contraseña hasheada", async () => {
    const creado = await crearUsuario(datosValidos);
    const guardado = await Usuario.scope("conPassword").findByPk(creado.id);
    expect(creado).toMatchObject({ email: "maria.lopez@prueba.local", rol: "operador", activo: true });
    expect(await bcrypt.compare("Segura123", guardado!.password_hash)).toBe(true);
    expect(creado).not.toHaveProperty("password_hash");
  });

  it("rechaza un email repetido indicando el campo", async () => {
    await crearUsuario(datosValidos);
    await expect(crearUsuario({ ...datosValidos, email: "maria.lopez@prueba.local" })).rejects.toMatchObject({
      estado: 400,
      campos: { email: "Ya existe un usuario con ese email" },
    });
  });
});

describe("listar usuarios", () => {
  it("busca por apellido o email y pagina el resultado", async () => {
    await crearUsuario(datosValidos);
    await crearUsuario({ ...datosValidos, apellido: "Gómez", email: "gomez@prueba.local" });

    const porApellido = await listarUsuarios({ pagina: 1, tamanio: 10, busqueda: "lóp" });
    expect(porApellido.filas.map((u) => u.apellido)).toEqual(["López"]);

    const pagina = await listarUsuarios({ pagina: 1, tamanio: 2, busqueda: "" });
    expect(pagina.total).toBe(3); // admin semilla + 2 creados
    expect(pagina.filas).toHaveLength(2);
  });
});

describe("actualizar usuario", () => {
  it("conserva la contraseña si se envía vacía", async () => {
    const creado = await crearUsuario(datosValidos);
    const admin = await adminSemilla();
    await actualizarUsuario(creado.id, { ...datosValidos, nombre: "María José", password: "" }, sesionDe(admin, "administrador"));
    const guardado = await Usuario.scope("conPassword").findByPk(creado.id);
    expect(guardado!.nombre).toBe("María José");
    expect(await bcrypt.compare("Segura123", guardado!.password_hash)).toBe(true);
  });

  it("impide que un usuario se desactive o cambie su propio rol", async () => {
    const admin = await adminSemilla();
    const propios = { nombre: admin.nombre, apellido: admin.apellido, email: admin.email, password: "" };
    await expect(
      actualizarUsuario(admin.id, { ...propios, rol: "administrador", activo: false }, sesionDe(admin, "administrador")),
    ).rejects.toThrow("su propio usuario");
    await expect(
      actualizarUsuario(admin.id, { ...propios, rol: "operador", activo: true }, sesionDe(admin, "administrador")),
    ).rejects.toThrow("su propio usuario");
  });

  it("impide dejar el sistema sin administradores activos", async () => {
    const admin = await adminSemilla();
    const otro = await crearUsuarioPrueba({ rol: "operador" });
    await expect(
      actualizarUsuario(
        admin.id,
        { nombre: admin.nombre, apellido: admin.apellido, email: admin.email, password: "", rol: "operador", activo: true },
        sesionDe(otro, "operador"),
      ),
    ).rejects.toThrow("al menos un administrador activo");
  });

  it("impide quitar el rol veterinario a un usuario vinculado a personal", async () => {
    const admin = await adminSemilla();
    const vet = await crearUsuarioPrueba({ rol: "veterinario" });
    await Veterinario.create({ tipo: "veterinario", nombre: "Luis", apellido: "Gómez", matricula: "MV-100", usuario_id: vet.id });
    await expect(
      actualizarUsuario(
        vet.id,
        { nombre: vet.nombre, apellido: vet.apellido, email: vet.email, password: "", rol: "operador", activo: true },
        sesionDe(admin, "administrador"),
      ),
    ).rejects.toThrow("vinculado al personal");
  });
});

describe("eliminar usuario", () => {
  it("borra físicamente a un usuario sin registros asociados", async () => {
    const admin = await adminSemilla();
    const usuario = await crearUsuarioPrueba();
    expect(await eliminarUsuario(usuario.id, sesionDe(admin, "administrador"))).toEqual({ resultado: "eliminado" });
    expect(await Usuario.findByPk(usuario.id)).toBeNull();
  });

  it("desactiva (no borra) a un usuario con movimientos de stock", async () => {
    const admin = await adminSemilla();
    const usuario = await crearUsuarioPrueba();
    const insumo = await Insumo.create({ nombre: "Ketamina", unidad: "ml", stock_actual: "10" });
    await MovimientoInsumo.create({ tipo: "ingreso", cantidad: "10", insumo_id: insumo.id, usuario_id: usuario.id });

    expect(await eliminarUsuario(usuario.id, sesionDe(admin, "administrador"))).toEqual({ resultado: "desactivado" });
    expect((await Usuario.findByPk(usuario.id))!.activo).toBe(false);
  });

  it("impide que un usuario se elimine a sí mismo", async () => {
    const admin = await adminSemilla();
    await expect(eliminarUsuario(admin.id, sesionDe(admin, "administrador"))).rejects.toThrow("su propio usuario");
  });

  it("informa 404 si el usuario no existe", async () => {
    const admin = await adminSemilla();
    await expect(eliminarUsuario(9999, sesionDe(admin, "administrador"))).rejects.toMatchObject({ estado: 404 });
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run tests/services/usuarios.test.ts`
Expected: FAIL — no existe `@/services/usuarios`.

- [ ] **Step 3: `src/services/usuarios.ts`**

```ts
import bcrypt from "bcryptjs";
import { Op, type Transaction } from "sequelize";
import type { DatosSesion } from "@/lib/auth";
import type { NombreRol } from "@/lib/constantes";
import { MovimientoInsumo, Operativo, ReporteAvistamiento, Rol, sequelize, Usuario, Veterinario } from "@/lib/db";
import { NoEncontradoError, ReglaNegocioError, ValidacionError } from "@/lib/errores";
import type { ParametrosListado, ResultadoPaginado } from "@/schemas/comun";
import type { DatosUsuario } from "@/schemas/usuarios";

/** Costo de bcrypt: 10 rondas es el equilibrio habitual entre seguridad y tiempo de respuesta. */
const RONDAS_BCRYPT = 10;

/** Representación pública de un usuario (nunca incluye el hash de la contraseña). */
export interface UsuarioDto {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  activo: boolean;
  rol: NombreRol;
}

/** Convierte el modelo (con su rol incluido) al DTO público. */
function aDto(usuario: Usuario): UsuarioDto {
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    email: usuario.email,
    activo: usuario.activo,
    rol: usuario.rol!.nombre,
  };
}

/** Busca un usuario con su rol o lanza 404. */
async function buscarUsuario(id: number, transaction?: Transaction): Promise<Usuario> {
  const usuario = await Usuario.findByPk(id, { include: ["rol"], transaction });
  if (!usuario) throw new NoEncontradoError("El usuario no existe");
  return usuario;
}

/** Obtiene el id del rol por su nombre. */
async function idDeRol(nombre: NombreRol, transaction?: Transaction): Promise<number> {
  const rol = await Rol.findOne({ where: { nombre }, transaction });
  if (!rol) throw new ValidacionError("El rol indicado no existe", { rol: "Rol inexistente" });
  return rol.id;
}

/** Verifica que el email no esté usado por otro usuario (comparación en minúsculas). */
async function verificarEmailDisponible(email: string, excluirId?: number, transaction?: Transaction) {
  const existente = await Usuario.findOne({
    where: { email, ...(excluirId ? { id: { [Op.ne]: excluirId } } : {}) },
    transaction,
  });
  if (existente) {
    throw new ValidacionError("Revise los datos ingresados", { email: "Ya existe un usuario con ese email" });
  }
}

/**
 * Si el usuario es un administrador activo que dejaría de serlo (cambio de rol, baja o
 * eliminación), exige que quede al menos otro administrador activo.
 */
async function verificarQuedaAdministrador(usuario: Usuario, transaction: Transaction) {
  if (usuario.rol!.nombre !== "administrador" || !usuario.activo) return;
  const otrosAdministradores = await Usuario.count({
    where: { activo: true, id: { [Op.ne]: usuario.id } },
    include: [{ association: "rol", where: { nombre: "administrador" } }],
    transaction,
  });
  if (otrosAdministradores === 0) {
    throw new ReglaNegocioError("Debe quedar al menos un administrador activo en el sistema");
  }
}

/** Listado paginado con búsqueda por nombre, apellido o email (sin distinguir mayúsculas ni acentos). */
export async function listarUsuarios(parametros: ParametrosListado): Promise<ResultadoPaginado<UsuarioDto>> {
  const { pagina, tamanio, busqueda } = parametros;
  const patron = `%${busqueda}%`;
  // unaccent no está instalado: se compara con translate() para ignorar tildes comunes.
  const sinTildes = (columna: string) =>
    sequelize.fn("translate", sequelize.fn("lower", sequelize.col(columna)), "áéíóúü", "aeiouu");
  const patronSinTildes = patron.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  const where = busqueda
    ? {
        [Op.or]: ["Usuario.nombre", "Usuario.apellido", "Usuario.email"].map((columna) =>
          sequelize.where(sinTildes(columna), { [Op.like]: patronSinTildes }),
        ),
      }
    : {};

  const { rows, count } = await Usuario.findAndCountAll({
    where,
    include: ["rol"],
    order: [["apellido", "ASC"], ["nombre", "ASC"]],
    limit: tamanio,
    offset: (pagina - 1) * tamanio,
  });

  return { filas: rows.map(aDto), total: count, pagina, tamanio };
}

/** Obtiene un usuario por id. */
export async function obtenerUsuario(id: number): Promise<UsuarioDto> {
  return aDto(await buscarUsuario(id));
}

/** Alta de usuario (solo administrador; el permiso se controla en la API). */
export async function crearUsuario(datos: DatosUsuario): Promise<UsuarioDto> {
  const email = datos.email.trim().toLowerCase();
  return sequelize.transaction(async (transaction) => {
    await verificarEmailDisponible(email, undefined, transaction);
    const usuario = await Usuario.create(
      {
        nombre: datos.nombre,
        apellido: datos.apellido,
        email,
        password_hash: await bcrypt.hash(datos.password, RONDAS_BCRYPT),
        activo: datos.activo,
        rol_id: await idDeRol(datos.rol, transaction),
      },
      { transaction },
    );
    return aDto(await buscarUsuario(usuario.id, transaction));
  });
}

/**
 * Modificación de usuario. Contraseña vacía = se conserva la actual.
 * Reglas: nadie cambia su propio rol ni se desactiva; siempre queda un administrador activo;
 * un usuario vinculado a personal veterinario conserva el rol veterinario.
 */
export async function actualizarUsuario(id: number, datos: DatosUsuario, actor: DatosSesion): Promise<UsuarioDto> {
  const email = datos.email.trim().toLowerCase();
  return sequelize.transaction(async (transaction) => {
    const usuario = await buscarUsuario(id, transaction);
    const cambiaRol = usuario.rol!.nombre !== datos.rol;
    const seDesactiva = usuario.activo && !datos.activo;

    if (usuario.id === actor.usuarioId && (cambiaRol || seDesactiva)) {
      throw new ReglaNegocioError("No puede cambiar el rol ni desactivar su propio usuario");
    }
    if (cambiaRol || seDesactiva) {
      await verificarQuedaAdministrador(usuario, transaction);
    }
    if (cambiaRol && usuario.rol!.nombre === "veterinario") {
      const vinculado = await Veterinario.count({ where: { usuario_id: usuario.id }, transaction });
      if (vinculado > 0) {
        throw new ReglaNegocioError(
          "El usuario está vinculado al personal veterinario; desvincúlelo antes de cambiar su rol",
        );
      }
    }
    await verificarEmailDisponible(email, usuario.id, transaction);

    await usuario.update(
      {
        nombre: datos.nombre,
        apellido: datos.apellido,
        email,
        activo: datos.activo,
        rol_id: await idDeRol(datos.rol, transaction),
        ...(datos.password ? { password_hash: await bcrypt.hash(datos.password, RONDAS_BCRYPT) } : {}),
      },
      { transaction },
    );
    return aDto(await buscarUsuario(id, transaction));
  });
}

/**
 * Baja de usuario. Si tiene registros asociados se desactiva (baja lógica) para preservar
 * la trazabilidad; si no, se elimina físicamente.
 */
export async function eliminarUsuario(
  id: number,
  actor: DatosSesion,
): Promise<{ resultado: "eliminado" | "desactivado" }> {
  return sequelize.transaction(async (transaction) => {
    const usuario = await buscarUsuario(id, transaction);
    if (usuario.id === actor.usuarioId) {
      throw new ReglaNegocioError("No puede eliminar su propio usuario");
    }
    await verificarQuedaAdministrador(usuario, transaction);

    const conteos = await Promise.all([
      MovimientoInsumo.count({ where: { usuario_id: id }, transaction }),
      ReporteAvistamiento.count({ where: { usuario_id: id }, transaction }),
      Operativo.count({ where: { usuario_cancelacion_id: id }, transaction }),
      Veterinario.count({ where: { usuario_id: id }, transaction }),
    ]);
    if (conteos.some((cantidad) => cantidad > 0)) {
      await usuario.update({ activo: false }, { transaction });
      return { resultado: "desactivado" as const };
    }

    await usuario.destroy({ transaction });
    return { resultado: "eliminado" as const };
  });
}
```

> Nota: el test "impide que un usuario se desactive o cambie su propio rol" espera el texto `su propio usuario`, presente en ambos mensajes ("...desactivar su propio usuario" y "No puede eliminar su propio usuario").

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npx vitest run tests/services/usuarios.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Correr toda la suite**

Run: `npm test`
Expected: PASS — los 12 tests de la Fase 0 + 21 nuevos.

---

### Task 7: Sesión del servidor y helpers de API

**Files:**
- Create: `src/lib/sesion.ts`, `src/lib/api.ts`

- [ ] **Step 1: `src/lib/sesion.ts`**

```ts
import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_SESION, DURACION_SESION_SEGUNDOS, firmarSesion, verificarSesion, type DatosSesion } from "./auth";
import { Usuario } from "./db";
import { NoAutenticadoError, ProhibidoError } from "./errores";
import { tienePermiso, type Accion } from "./permisos";

/**
 * Lee la sesión desde la cookie y la revalida contra la base: si el usuario fue
 * desactivado o cambió de rol, el cambio rige desde el siguiente request.
 */
export async function obtenerSesion(): Promise<DatosSesion | null> {
  const almacen = await cookies();
  const datos = await verificarSesion(almacen.get(COOKIE_SESION)?.value);
  if (!datos) return null;

  const usuario = await Usuario.findByPk(datos.usuarioId, { include: ["rol"] });
  if (!usuario || !usuario.activo || !usuario.rol) return null;

  return { usuarioId: usuario.id, nombre: `${usuario.nombre} ${usuario.apellido}`, rol: usuario.rol.nombre };
}

/** Para Route Handlers: exige sesión válida (401) y, opcionalmente, un permiso (403). */
export async function requerirSesion(accion?: Accion): Promise<DatosSesion> {
  const sesion = await obtenerSesion();
  if (!sesion) throw new NoAutenticadoError();
  if (accion && !tienePermiso(sesion.rol, accion)) throw new ProhibidoError();
  return sesion;
}

/** Para páginas: sin sesión redirige a /login; sin permiso redirige al inicio. */
export async function exigirPermisoPagina(accion: Accion): Promise<DatosSesion> {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  if (!tienePermiso(sesion.rol, accion)) redirect("/dashboard");
  return sesion;
}

/** Guarda el JWT en una cookie httpOnly (inaccesible desde JavaScript del navegador). */
export async function guardarSesion(datos: DatosSesion): Promise<void> {
  const almacen = await cookies();
  almacen.set({
    name: COOKIE_SESION,
    value: await firmarSesion(datos),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DURACION_SESION_SEGUNDOS,
  });
}

/** Elimina la cookie de sesión. */
export async function cerrarSesion(): Promise<void> {
  const almacen = await cookies();
  almacen.delete(COOKIE_SESION);
}
```

- [ ] **Step 2: `src/lib/api.ts`**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { ForeignKeyConstraintError, UniqueConstraintError } from "sequelize";
import { ZodError, type ZodType } from "zod";
import { ErrorAplicacion, ValidacionError } from "./errores";
import { mensajeDeRestriccion } from "./restricciones";

/** Forma de todas las respuestas de error de la API. */
export interface CuerpoError {
  error: { mensaje: string; campos?: Record<string, string> };
}

/** Convierte los issues de Zod en un mapa campo → primer mensaje. */
function camposDeZod(error: ZodError): Record<string, string> {
  const campos: Record<string, string> = {};
  for (const issue of error.issues) {
    const campo = issue.path.join(".") || "formulario";
    campos[campo] ??= issue.message;
  }
  return campos;
}

/** Traduce cualquier error a una respuesta JSON con el código HTTP adecuado. */
export function respuestaDeError(error: unknown): NextResponse<CuerpoError> {
  if (error instanceof ErrorAplicacion) {
    return NextResponse.json({ error: { mensaje: error.message, campos: error.campos } }, { status: error.estado });
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: { mensaje: "Revise los datos ingresados", campos: camposDeZod(error) } },
      { status: 400 },
    );
  }
  // Resguardo ante restricciones de la base (ver src/lib/restricciones.ts).
  if (error instanceof UniqueConstraintError) {
    const restriccion = (error.parent as { constraint?: string }).constraint;
    return NextResponse.json(
      { error: { mensaje: mensajeDeRestriccion(restriccion, "Ya existe un registro con esos datos") } },
      { status: 409 },
    );
  }
  if (error instanceof ForeignKeyConstraintError) {
    const restriccion = (error.parent as { constraint?: string }).constraint;
    return NextResponse.json(
      { error: { mensaje: mensajeDeRestriccion(restriccion, "La operación afecta registros relacionados") } },
      { status: 409 },
    );
  }
  console.error("Error no controlado en la API:", error);
  return NextResponse.json({ error: { mensaje: "Ocurrió un error inesperado. Intente nuevamente." } }, { status: 500 });
}

/**
 * Envuelve un Route Handler para que cualquier error termine en una respuesta JSON
 * uniforme. Uso: `export const GET = manejarApi(async (request) => { ... })`.
 */
export function manejarApi<Contexto>(
  manejador: (request: NextRequest, contexto: Contexto) => Promise<Response>,
): (request: NextRequest, contexto: Contexto) => Promise<Response> {
  return async (request, contexto) => {
    try {
      return await manejador(request, contexto);
    } catch (error) {
      return respuestaDeError(error);
    }
  };
}

/** Lee y valida el cuerpo JSON de la solicitud con el esquema indicado. */
export async function leerCuerpo<T>(request: NextRequest, esquema: ZodType<T>): Promise<T> {
  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    throw new ValidacionError("El cuerpo de la solicitud no es un JSON válido");
  }
  return esquema.parse(cuerpo);
}

/** Valida los parámetros de la URL (query string) con el esquema indicado. */
export function leerParametros<T>(request: NextRequest, esquema: ZodType<T>): T {
  return esquema.parse(Object.fromEntries(request.nextUrl.searchParams));
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

---

### Task 8: Rutas de API (auth y usuarios) y proxy

**Files:**
- Create: `src/app/api/auth/login/route.ts`, `src/app/api/auth/logout/route.ts`, `src/app/api/usuarios/route.ts`, `src/app/api/usuarios/[id]/route.ts`, `src/proxy.ts`

- [ ] **Step 1: `src/app/api/auth/login/route.ts`**

```ts
import { NextResponse } from "next/server";
import { leerCuerpo, manejarApi } from "@/lib/api";
import { guardarSesion } from "@/lib/sesion";
import { esquemaLogin } from "@/schemas/auth";
import { autenticar } from "@/services/auth";

/** POST /api/auth/login — valida credenciales y abre la sesión (cookie httpOnly). */
export const POST = manejarApi(async (request) => {
  const { email, password } = await leerCuerpo(request, esquemaLogin);
  const sesion = await autenticar(email, password);
  await guardarSesion(sesion);
  return NextResponse.json({ usuario: sesion });
});
```

- [ ] **Step 2: `src/app/api/auth/logout/route.ts`**

```ts
import { NextResponse } from "next/server";
import { manejarApi } from "@/lib/api";
import { cerrarSesion } from "@/lib/sesion";

/** POST /api/auth/logout — elimina la cookie de sesión. */
export const POST = manejarApi(async () => {
  await cerrarSesion();
  return NextResponse.json({ ok: true });
});
```

- [ ] **Step 3: `src/app/api/usuarios/route.ts`**

```ts
import { NextResponse } from "next/server";
import { leerCuerpo, leerParametros, manejarApi } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { esquemaListado } from "@/schemas/comun";
import { esquemaCrearUsuario } from "@/schemas/usuarios";
import { crearUsuario, listarUsuarios } from "@/services/usuarios";

/** GET /api/usuarios?pagina=&tamanio=&busqueda= — listado paginado (solo administrador). */
export const GET = manejarApi(async (request) => {
  await requerirSesion("usuarios:gestionar");
  return NextResponse.json(await listarUsuarios(leerParametros(request, esquemaListado)));
});

/** POST /api/usuarios — alta de usuario (solo administrador). */
export const POST = manejarApi(async (request) => {
  await requerirSesion("usuarios:gestionar");
  const datos = await leerCuerpo(request, esquemaCrearUsuario);
  return NextResponse.json(await crearUsuario(datos), { status: 201 });
});
```

- [ ] **Step 4: `src/app/api/usuarios/[id]/route.ts`**

```ts
import { NextResponse } from "next/server";
import { leerCuerpo, manejarApi } from "@/lib/api";
import { requerirSesion } from "@/lib/sesion";
import { esquemaId } from "@/schemas/comun";
import { esquemaEditarUsuario } from "@/schemas/usuarios";
import { actualizarUsuario, eliminarUsuario, obtenerUsuario } from "@/services/usuarios";

/** En Next.js 16 los parámetros dinámicos de la ruta llegan como Promise. */
type Contexto = { params: Promise<{ id: string }> };

/** GET /api/usuarios/:id */
export const GET = manejarApi<Contexto>(async (_request, { params }) => {
  await requerirSesion("usuarios:gestionar");
  const id = esquemaId.parse((await params).id);
  return NextResponse.json(await obtenerUsuario(id));
});

/** PUT /api/usuarios/:id — modificación (contraseña vacía = sin cambios). */
export const PUT = manejarApi<Contexto>(async (request, { params }) => {
  const sesion = await requerirSesion("usuarios:gestionar");
  const id = esquemaId.parse((await params).id);
  const datos = await leerCuerpo(request, esquemaEditarUsuario);
  return NextResponse.json(await actualizarUsuario(id, datos, sesion));
});

/** DELETE /api/usuarios/:id — elimina o desactiva según tenga registros asociados. */
export const DELETE = manejarApi<Contexto>(async (_request, { params }) => {
  const sesion = await requerirSesion("usuarios:gestionar");
  const id = esquemaId.parse((await params).id);
  return NextResponse.json(await eliminarUsuario(id, sesion));
});
```

- [ ] **Step 5: `src/proxy.ts`**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESION, verificarSesion } from "@/lib/auth";

/** Páginas accesibles sin sesión. */
const RUTAS_PUBLICAS = ["/login"];

/**
 * Chequeo optimista de sesión antes de renderizar páginas (Next.js 16: proxy.ts,
 * runtime Node.js). Solo verifica la firma del JWT para redirigir rápido; la
 * autorización real se hace en cada página (`exigirPermisoPagina`) y Route Handler
 * (`requerirSesion`), que además revalidan al usuario contra la base.
 * Las rutas /api quedan excluidas: responden 401/403 en JSON por sí mismas.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sesion = await verificarSesion(request.cookies.get(COOKIE_SESION)?.value);
  const esPublica = RUTAS_PUBLICAS.includes(pathname);

  if (!sesion && !esPublica) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (sesion && esPublica) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Todo excepto API, archivos internos de Next y recursos estáticos (con extensión).
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
```

- [ ] **Step 6: Verificar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

---

### Task 9: Utilidades de cliente y componentes reutilizables

**Files:**
- Create: `src/lib/cliente-api.ts`, `src/lib/etiquetas.ts`, `src/components/comunes/{encabezado-pagina,buscador,tabla-datos,paginacion,campo-formulario,confirmar-dialogo,badge-estado}.tsx`

- [ ] **Step 1: `src/lib/cliente-api.ts`**

```ts
"use client";

/** Error devuelto por la API, con el código HTTP y los errores por campo. */
export class ErrorApi extends Error {
  constructor(
    mensaje: string,
    public readonly estado: number,
    public readonly campos?: Record<string, string>,
  ) {
    super(mensaje);
  }
}

/**
 * Llama a la API REST propia y devuelve el JSON tipado.
 * Ante 401 (sesión vencida) redirige al login; ante otros errores lanza `ErrorApi`
 * con el mensaje en español preparado por el servidor.
 */
export async function llamarApi<T>(url: string, opciones: { metodo?: string; cuerpo?: unknown } = {}): Promise<T> {
  const respuesta = await fetch(url, {
    method: opciones.metodo ?? "GET",
    headers: opciones.cuerpo !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: opciones.cuerpo !== undefined ? JSON.stringify(opciones.cuerpo) : undefined,
  });

  const datos = await respuesta.json().catch(() => null);

  if (respuesta.status === 401 && !url.startsWith("/api/auth/")) {
    window.location.href = "/login";
  }
  if (!respuesta.ok) {
    throw new ErrorApi(datos?.error?.mensaje ?? "Ocurrió un error inesperado", respuesta.status, datos?.error?.campos);
  }
  return datos as T;
}

/** Fetcher para SWR: `useSWR(url, obtenerJson)`. */
export const obtenerJson = <T,>(url: string) => llamarApi<T>(url);
```

- [ ] **Step 2: `src/lib/etiquetas.ts`**

```ts
import type { NombreRol } from "./constantes";

/** Textos visibles para los valores de dominio. Cada fase agrega los suyos aquí. */
export const ETIQUETAS_ROL: Record<NombreRol, string> = {
  administrador: "Administrador",
  operador: "Operador",
  veterinario: "Veterinario",
};
```

- [ ] **Step 3: `src/components/comunes/encabezado-pagina.tsx`**

```tsx
import type { ReactNode } from "react";

/** Título, descripción y acciones principales de una página del panel. */
export function EncabezadoPagina({ titulo, descripcion, acciones }: { titulo: string; descripcion?: string; acciones?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
        {descripcion && <p className="text-sm text-muted-foreground">{descripcion}</p>}
      </div>
      {acciones && <div className="flex gap-2">{acciones}</div>}
    </div>
  );
}
```

- [ ] **Step 4: `src/components/comunes/buscador.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

/** Campo de búsqueda que notifica el texto con una demora (debounce) para no consultar en cada tecla. */
export function Buscador({ onBuscar, placeholder = "Buscar…", demoraMs = 300 }: {
  onBuscar: (texto: string) => void;
  placeholder?: string;
  demoraMs?: number;
}) {
  const [texto, setTexto] = useState("");

  useEffect(() => {
    const temporizador = setTimeout(() => onBuscar(texto.trim()), demoraMs);
    return () => clearTimeout(temporizador);
  }, [texto, demoraMs, onBuscar]);

  return (
    <div className="relative w-full max-w-sm">
      <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={texto} onChange={(evento) => setTexto(evento.target.value)} placeholder={placeholder} className="pl-8" />
    </div>
  );
}
```

- [ ] **Step 5: `src/components/comunes/tabla-datos.tsx`**

```tsx
import type { ReactNode } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/** Definición de una columna: título y cómo renderizar la celda a partir de la fila. */
export interface Columna<T> {
  titulo: string;
  celda: (fila: T) => ReactNode;
  className?: string;
}

/** Tabla genérica con estados de carga y de lista vacía. */
export function TablaDatos<T>({ columnas, filas, claveFila, cargando, mensajeVacio = "No hay registros para mostrar" }: {
  columnas: Columna<T>[];
  filas: T[] | undefined;
  claveFila: (fila: T) => string | number;
  cargando?: boolean;
  mensajeVacio?: string;
}) {
  const mensaje = cargando ? "Cargando…" : !filas?.length ? mensajeVacio : null;

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            {columnas.map((columna) => (
              <TableHead key={columna.titulo} className={columna.className}>{columna.titulo}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {mensaje ? (
            <TableRow>
              <TableCell colSpan={columnas.length} className="h-24 text-center text-muted-foreground">{mensaje}</TableCell>
            </TableRow>
          ) : (
            filas!.map((fila) => (
              <TableRow key={claveFila(fila)}>
                {columnas.map((columna) => (
                  <TableCell key={columna.titulo} className={columna.className}>{columna.celda(fila)}</TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 6: `src/components/comunes/paginacion.tsx`**

```tsx
"use client";

import { Button } from "@/components/ui/button";

/** Controles de paginación: total de registros, página actual y navegación. */
export function Paginacion({ pagina, tamanio, total, onCambiar }: {
  pagina: number;
  tamanio: number;
  total: number;
  onCambiar: (pagina: number) => void;
}) {
  const totalPaginas = Math.max(1, Math.ceil(total / tamanio));
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
      <span>{total} registro{total === 1 ? "" : "s"}</span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={pagina <= 1} onClick={() => onCambiar(pagina - 1)}>Anterior</Button>
        <span>Página {pagina} de {totalPaginas}</span>
        <Button variant="outline" size="sm" disabled={pagina >= totalPaginas} onClick={() => onCambiar(pagina + 1)}>Siguiente</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: `src/components/comunes/campo-formulario.tsx`**

```tsx
import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";

/** Etiqueta + control + mensaje de error de un campo de formulario. */
export function CampoFormulario({ id, etiqueta, error, children }: {
  id: string;
  etiqueta: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{etiqueta}</Label>
      {children}
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 8: `src/components/comunes/confirmar-dialogo.tsx`**

Usar los nombres de export reales de `src/components/ui/alert-dialog.tsx` (Task 1). Con la versión de shadcn para Base UI son: `AlertDialog`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogCancel`, `AlertDialogAction`.

```tsx
"use client";

import { useState } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Diálogo de confirmación controlado para acciones sensibles (eliminar, cancelar…).
 * Mientras `onConfirmar` se ejecuta, los botones quedan deshabilitados.
 */
export function ConfirmarDialogo({ abierto, titulo, descripcion, textoConfirmar = "Confirmar", onConfirmar, onCerrar }: {
  abierto: boolean;
  titulo: string;
  descripcion: string;
  textoConfirmar?: string;
  onConfirmar: () => Promise<void>;
  onCerrar: () => void;
}) {
  const [procesando, setProcesando] = useState(false);

  async function confirmar() {
    setProcesando(true);
    try {
      await onConfirmar();
    } finally {
      setProcesando(false);
    }
  }

  return (
    <AlertDialog open={abierto} onOpenChange={(abrir) => !abrir && !procesando && onCerrar()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          <AlertDialogDescription>{descripcion}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={procesando}>Volver</AlertDialogCancel>
          <AlertDialogAction disabled={procesando} onClick={confirmar}>
            {procesando ? "Procesando…" : textoConfirmar}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

- [ ] **Step 9: `src/components/comunes/badge-estado.tsx`**

```tsx
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Colores por tono semántico; cada fase mapea sus estados a uno de estos tonos. */
const CLASES_TONO = {
  exito: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  alerta: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  peligro: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  info: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  neutro: "bg-muted text-muted-foreground",
} as const;
export type TonoEstado = keyof typeof CLASES_TONO;

/** Etiqueta de estado con color según su tono. */
export function BadgeEstado({ texto, tono }: { texto: string; tono: TonoEstado }) {
  return <Badge variant="outline" className={cn("border-transparent", CLASES_TONO[tono])}>{texto}</Badge>;
}
```

- [ ] **Step 10: Verificar**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

---

### Task 10: Login, layout del panel y navegación

**Files:**
- Create: `src/lib/navegacion.ts`, `src/components/layout/barra-lateral.tsx`, `src/app/(auth)/login/page.tsx`, `src/app/(panel)/layout.tsx`, `src/app/(panel)/dashboard/page.tsx`
- Modify: `src/app/page.tsx`, `src/app/layout.tsx`

- [ ] **Step 1: `src/lib/navegacion.ts`**

```ts
import { LayoutDashboard, UserCog, type LucideIcon } from "lucide-react";
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
  { titulo: "Usuarios", href: "/usuarios", icono: UserCog, accion: "usuarios:gestionar" },
];
```

- [ ] **Step 2: `src/components/layout/barra-lateral.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DatosSesion } from "@/lib/auth";
import { llamarApi } from "@/lib/cliente-api";
import { ETIQUETAS_ROL } from "@/lib/etiquetas";
import { NAVEGACION } from "@/lib/navegacion";
import { tienePermiso } from "@/lib/permisos";
import { cn } from "@/lib/utils";

/** Menú lateral del panel: muestra solo los módulos permitidos para el rol de la sesión. */
export function BarraLateral({ sesion }: { sesion: DatosSesion }) {
  const rutaActual = usePathname();
  const router = useRouter();
  const items = NAVEGACION.filter((item) => tienePermiso(sesion.rol, item.accion));

  async function salir() {
    await llamarApi("/api/auth/logout", { metodo: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r bg-sidebar p-4">
      <div className="mb-6 px-2">
        <p className="text-lg font-semibold">SIGCAN</p>
        <p className="text-xs text-muted-foreground">Castración y Chipeo — Río Grande</p>
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {items.map((item) => {
          const activo = rutaActual === item.href || rutaActual.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted",
                activo && "bg-muted font-medium",
              )}
            >
              <item.icono className="size-4" />
              {item.titulo}
            </Link>
          );
        })}
      </nav>
      <div className="border-t pt-4">
        <p className="truncate px-2 text-sm font-medium">{sesion.nombre}</p>
        <p className="px-2 text-xs text-muted-foreground">{ETIQUETAS_ROL[sesion.rol]}</p>
        <Button variant="ghost" size="sm" className="mt-2 w-full justify-start" onClick={salir}>
          <LogOut /> Cerrar sesión
        </Button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 3: `src/app/(panel)/layout.tsx`**

```tsx
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { BarraLateral } from "@/components/layout/barra-lateral";
import { obtenerSesion } from "@/lib/sesion";

/** Layout de las páginas autenticadas: revalida la sesión y muestra el menú por rol. */
export default async function LayoutPanel({ children }: { children: ReactNode }) {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <BarraLateral sesion={sesion} />
      <main className="flex-1 overflow-x-auto p-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 4: `src/app/(panel)/dashboard/page.tsx`** (provisorio; el dashboard con indicadores es de la Fase 5)

```tsx
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { ETIQUETAS_ROL } from "@/lib/etiquetas";
import { exigirPermisoPagina } from "@/lib/sesion";

/** Inicio del panel (provisorio hasta la Fase 5). */
export default async function PaginaDashboard() {
  const sesion = await exigirPermisoPagina("dashboard:ver");
  return (
    <EncabezadoPagina
      titulo={`Bienvenido/a, ${sesion.nombre}`}
      descripcion={`Ingresó como ${ETIQUETAS_ROL[sesion.rol]}. Use el menú lateral para acceder a los módulos.`}
    />
  );
}
```

- [ ] **Step 5: `src/app/(auth)/login/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CampoFormulario } from "@/components/comunes/campo-formulario";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ErrorApi, llamarApi } from "@/lib/cliente-api";
import { esquemaLogin, type DatosLogin } from "@/schemas/auth";

/** Pantalla de inicio de sesión del personal municipal. */
export default function PaginaLogin() {
  const router = useRouter();
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<DatosLogin>({
    resolver: zodResolver(esquemaLogin),
    defaultValues: { email: "", password: "" },
  });

  async function ingresar(datos: DatosLogin) {
    setErrorGeneral(null);
    try {
      await llamarApi("/api/auth/login", { metodo: "POST", cuerpo: datos });
      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      setErrorGeneral(error instanceof ErrorApi ? error.message : "No se pudo iniciar sesión");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>SIGCAN</CardTitle>
          <CardDescription>Ingrese con su cuenta del personal municipal</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(ingresar)} className="grid gap-4" noValidate>
            <CampoFormulario id="email" etiqueta="Email" error={formState.errors.email?.message}>
              <Input id="email" type="email" autoComplete="username" {...register("email")} />
            </CampoFormulario>
            <CampoFormulario id="password" etiqueta="Contraseña" error={formState.errors.password?.message}>
              <Input id="password" type="password" autoComplete="current-password" {...register("password")} />
            </CampoFormulario>
            {errorGeneral && <p className="text-sm text-destructive" role="alert">{errorGeneral}</p>}
            <Button type="submit" disabled={formState.isSubmitting}>
              {formState.isSubmitting ? "Ingresando…" : "Ingresar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
```

- [ ] **Step 6: Reemplazar `src/app/page.tsx`** (la raíz redirige al inicio del panel; el proxy envía al login si no hay sesión)

```tsx
import { redirect } from "next/navigation";

/** La raíz del sitio lleva al inicio del panel. */
export default function Inicio() {
  redirect("/dashboard");
}
```

- [ ] **Step 7: Agregar el `Toaster` en `src/app/layout.tsx`**

Importar `import { Toaster } from "@/components/ui/sonner";` y agregar `<Toaster richColors position="top-right" />` como último hijo de `<body>`, sin quitar nada de lo existente.

- [ ] **Step 8: Verificar**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

---

### Task 11: Página de gestión de usuarios (F11)

**Files:**
- Create: `src/components/usuarios/formulario-usuario.tsx`, `src/components/usuarios/gestion-usuarios.tsx`, `src/app/(panel)/usuarios/page.tsx`

- [ ] **Step 1: `src/components/usuarios/formulario-usuario.tsx`**

Usar los nombres de export reales de `dialog.tsx`, `native-select.tsx` y `checkbox.tsx` generados en la Task 1 (con Base UI: `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`; `NativeSelect`, `NativeSelectOption`; `Checkbox` con `checked` y `onCheckedChange`).

```tsx
"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { CampoFormulario } from "@/components/comunes/campo-formulario";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ErrorApi, llamarApi } from "@/lib/cliente-api";
import { ROLES } from "@/lib/constantes";
import { ETIQUETAS_ROL } from "@/lib/etiquetas";
import { esquemaCrearUsuario, esquemaEditarUsuario, type DatosUsuario } from "@/schemas/usuarios";
import type { UsuarioDto } from "@/services/usuarios";

/** Valores del formulario: vacíos para alta, los del usuario para edición. */
function valoresIniciales(usuario: UsuarioDto | null): DatosUsuario {
  return usuario
    ? { nombre: usuario.nombre, apellido: usuario.apellido, email: usuario.email, rol: usuario.rol, activo: usuario.activo, password: "" }
    : { nombre: "", apellido: "", email: "", rol: "operador", activo: true, password: "" };
}

/** Diálogo de alta/edición de usuario. Valida en el cliente con el mismo esquema que usa la API. */
export function FormularioUsuario({ abierto, usuario, onCerrar, onGuardado }: {
  abierto: boolean;
  usuario: UsuarioDto | null;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const esEdicion = usuario !== null;
  const { register, control, handleSubmit, setError, formState } = useForm<DatosUsuario>({
    resolver: zodResolver(esEdicion ? esquemaEditarUsuario : esquemaCrearUsuario),
    values: valoresIniciales(usuario),
  });

  async function guardar(datos: DatosUsuario) {
    try {
      await llamarApi(esEdicion ? `/api/usuarios/${usuario.id}` : "/api/usuarios", {
        metodo: esEdicion ? "PUT" : "POST",
        cuerpo: datos,
      });
      toast.success(esEdicion ? "Usuario actualizado" : "Usuario creado");
      onGuardado();
    } catch (error) {
      if (error instanceof ErrorApi && error.campos) {
        // Muestra los errores del servidor junto a cada campo.
        for (const [campo, mensaje] of Object.entries(error.campos)) {
          setError(campo as keyof DatosUsuario, { message: mensaje });
        }
      }
      toast.error(error instanceof ErrorApi ? error.message : "No se pudo guardar el usuario");
    }
  }

  const errores = formState.errors;
  return (
    <Dialog open={abierto} onOpenChange={(abrir) => !abrir && onCerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{esEdicion ? "Editar usuario" : "Nuevo usuario"}</DialogTitle>
          <DialogDescription>
            {esEdicion ? "Deje la contraseña vacía para conservar la actual." : "Todos los campos son obligatorios."}
          </DialogDescription>
        </DialogHeader>
        <form id="formulario-usuario" onSubmit={handleSubmit(guardar)} className="grid gap-4" noValidate>
          <div className="grid grid-cols-2 gap-4">
            <CampoFormulario id="nombre" etiqueta="Nombre" error={errores.nombre?.message}>
              <Input id="nombre" {...register("nombre")} />
            </CampoFormulario>
            <CampoFormulario id="apellido" etiqueta="Apellido" error={errores.apellido?.message}>
              <Input id="apellido" {...register("apellido")} />
            </CampoFormulario>
          </div>
          <CampoFormulario id="email" etiqueta="Email" error={errores.email?.message}>
            <Input id="email" type="email" {...register("email")} />
          </CampoFormulario>
          <CampoFormulario id="password" etiqueta="Contraseña" error={errores.password?.message}>
            <Input id="password" type="password" autoComplete="new-password" {...register("password")} />
          </CampoFormulario>
          <CampoFormulario id="rol" etiqueta="Rol" error={errores.rol?.message}>
            <NativeSelect id="rol" {...register("rol")}>
              {ROLES.map((rol) => (
                <NativeSelectOption key={rol} value={rol}>{ETIQUETAS_ROL[rol]}</NativeSelectOption>
              ))}
            </NativeSelect>
          </CampoFormulario>
          <Controller
            control={control}
            name="activo"
            render={({ field }) => (
              <div className="flex items-center gap-2">
                <Checkbox id="activo" checked={field.value} onCheckedChange={(marcado) => field.onChange(marcado === true)} />
                <Label htmlFor="activo">Usuario activo</Label>
              </div>
            )}
          />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onCerrar} disabled={formState.isSubmitting}>Cancelar</Button>
          <Button type="submit" form="formulario-usuario" disabled={formState.isSubmitting}>
            {formState.isSubmitting ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

> Nota de tipos: `UsuarioDto` se importa de `@/services/usuarios` solo como tipo (`import type`), por lo que el código del servidor no se incluye en el bundle del cliente.

- [ ] **Step 2: `src/components/usuarios/gestion-usuarios.tsx`**

```tsx
"use client";

import { useCallback, useState } from "react";
import useSWR from "swr";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { BadgeEstado } from "@/components/comunes/badge-estado";
import { Buscador } from "@/components/comunes/buscador";
import { ConfirmarDialogo } from "@/components/comunes/confirmar-dialogo";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { Paginacion } from "@/components/comunes/paginacion";
import { TablaDatos, type Columna } from "@/components/comunes/tabla-datos";
import { Button } from "@/components/ui/button";
import { ErrorApi, llamarApi, obtenerJson } from "@/lib/cliente-api";
import { ETIQUETAS_ROL } from "@/lib/etiquetas";
import type { ResultadoPaginado } from "@/schemas/comun";
import type { UsuarioDto } from "@/services/usuarios";
import { FormularioUsuario } from "./formulario-usuario";

const TAMANIO_PAGINA = 10;

/** Pantalla de F11: listado con búsqueda y paginación, alta, edición y baja de usuarios. */
export function GestionUsuarios() {
  const [pagina, setPagina] = useState(1);
  const [busqueda, setBusqueda] = useState("");
  const [formulario, setFormulario] = useState<{ abierto: boolean; usuario: UsuarioDto | null }>({ abierto: false, usuario: null });
  const [aEliminar, setAEliminar] = useState<UsuarioDto | null>(null);

  const parametros = new URLSearchParams({ pagina: String(pagina), tamanio: String(TAMANIO_PAGINA), busqueda });
  const { data, isLoading, mutate } = useSWR<ResultadoPaginado<UsuarioDto>>(`/api/usuarios?${parametros}`, obtenerJson, {
    keepPreviousData: true,
  });

  // Al cambiar la búsqueda se vuelve a la primera página.
  const buscar = useCallback((texto: string) => {
    setBusqueda(texto);
    setPagina(1);
  }, []);

  async function eliminar() {
    if (!aEliminar) return;
    try {
      const { resultado } = await llamarApi<{ resultado: "eliminado" | "desactivado" }>(`/api/usuarios/${aEliminar.id}`, {
        metodo: "DELETE",
      });
      toast.success(
        resultado === "eliminado" ? "Usuario eliminado" : "El usuario tiene registros asociados: se desactivó en lugar de eliminarse",
      );
      setAEliminar(null);
      await mutate();
    } catch (error) {
      toast.error(error instanceof ErrorApi ? error.message : "No se pudo eliminar el usuario");
    }
  }

  const columnas: Columna<UsuarioDto>[] = [
    { titulo: "Apellido y nombre", celda: (u) => `${u.apellido}, ${u.nombre}` },
    { titulo: "Email", celda: (u) => u.email },
    { titulo: "Rol", celda: (u) => ETIQUETAS_ROL[u.rol] },
    { titulo: "Estado", celda: (u) => <BadgeEstado texto={u.activo ? "Activo" : "Inactivo"} tono={u.activo ? "exito" : "neutro"} /> },
    {
      titulo: "Acciones",
      className: "w-28 text-right",
      celda: (u) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="Editar" onClick={() => setFormulario({ abierto: true, usuario: u })}>
            <Pencil />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Eliminar" onClick={() => setAEliminar(u)}>
            <Trash2 />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <EncabezadoPagina
        titulo="Usuarios"
        descripcion="Cuentas de acceso del personal municipal y sus roles."
        acciones={
          <Button onClick={() => setFormulario({ abierto: true, usuario: null })}>
            <Plus /> Nuevo usuario
          </Button>
        }
      />
      <div className="mb-4">
        <Buscador onBuscar={buscar} placeholder="Buscar por nombre, apellido o email" />
      </div>
      <TablaDatos columnas={columnas} filas={data?.filas} claveFila={(u) => u.id} cargando={isLoading} />
      {data && <Paginacion pagina={pagina} tamanio={TAMANIO_PAGINA} total={data.total} onCambiar={setPagina} />}

      <FormularioUsuario
        abierto={formulario.abierto}
        usuario={formulario.usuario}
        onCerrar={() => setFormulario({ abierto: false, usuario: null })}
        onGuardado={async () => {
          setFormulario({ abierto: false, usuario: null });
          await mutate();
        }}
      />
      <ConfirmarDialogo
        abierto={aEliminar !== null}
        titulo="Eliminar usuario"
        descripcion={`¿Eliminar a ${aEliminar?.nombre} ${aEliminar?.apellido}? Si tiene registros asociados se desactivará en lugar de eliminarse.`}
        textoConfirmar="Eliminar"
        onConfirmar={eliminar}
        onCerrar={() => setAEliminar(null)}
      />
    </>
  );
}
```

- [ ] **Step 3: `src/app/(panel)/usuarios/page.tsx`**

```tsx
import { GestionUsuarios } from "@/components/usuarios/gestion-usuarios";
import { exigirPermisoPagina } from "@/lib/sesion";

/** F11 — Gestión de usuarios (solo administrador). */
export default async function PaginaUsuarios() {
  await exigirPermisoPagina("usuarios:gestionar");
  return <GestionUsuarios />;
}
```

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: sin errores; todos los tests en verde.

---

### Task 12: Verificación manual, refactorización y cierre

- [ ] **Step 1: Crear usuarios de prueba para el recorrido**

Con `npm run dev` corriendo, ingresar como administrador (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`) y crear desde `/usuarios` un operador y un veterinario.

- [ ] **Step 2: Recorrido manual (anotar resultado de cada punto)**

| # | Acción | Resultado esperado |
|---|---|---|
| 1 | Abrir `/usuarios` sin sesión | Redirige a `/login` |
| 2 | Login con contraseña incorrecta | Mensaje "Email o contraseña incorrectos" |
| 3 | Login como administrador | Entra a `/dashboard`; menú con Inicio y Usuarios |
| 4 | Abrir `/login` con sesión iniciada | Redirige a `/dashboard` |
| 5 | Crear usuario con email repetido | Error junto al campo Email |
| 6 | Crear usuario con contraseña de 5 caracteres | Error de validación en el cliente (sin request) |
| 7 | Buscar "lop" encontrando "López" | La búsqueda ignora mayúsculas y tildes |
| 8 | Editar el propio usuario y desmarcar "activo" | Toast: "No puede cambiar el rol ni desactivar su propio usuario" |
| 9 | Login como operador | Menú sin "Usuarios"; `/usuarios` redirige a `/dashboard` |
| 10 | Como operador, `GET /api/usuarios` desde el navegador | 403 con `{"error":{"mensaje":"No tiene permisos…"}}` |
| 11 | Desactivar al operador (como admin) mientras tiene sesión abierta en otra ventana | En la otra ventana, el siguiente request redirige al login |
| 12 | Cerrar sesión | Vuelve a `/login`; la cookie `sigcan_sesion` ya no existe |

- [ ] **Step 3: Pasada de refactorización (`CLAUDE.md`)**

Revisar lo construido en la fase: duplicación entre servicios, componentes o rutas; nombres poco claros; comentarios faltantes o redundantes; imports sin uso. Confirmar que los componentes de `src/components/comunes/` no tengan nada específico de usuarios (deben servir para las fases 2–5).

- [ ] **Step 4: Verificación final**

Run: `npm run lint && npx tsc --noEmit && npm test && npm run build`
Expected: todo sin errores.

- [ ] **Step 5: Punto de control (sin git)**

Informar al usuario: archivos creados y modificados, resultado de los tests y del recorrido manual, desviaciones registradas en `docs/superpowers/desviaciones/fase1.md` (si las hubo). Fase 1 lista para que el usuario haga el commit.
