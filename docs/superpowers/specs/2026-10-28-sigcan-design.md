# SIGCAN — Documento de diseño (Fase 3: Desarrollo)

**Proyecto:** SIGCAN – Sistema de Gestión de Castración y Chipeo Animal (Río Grande)
**Equipo:** Marcos Sebastián Albornoz — Cesar Segovia (grupo de 2)
**Fecha:** 28/10/2026
**Entrega Fase 3:** viernes 13/11/2026 (coordinar revisión con ccardozo@frtdf.utn.edu.ar)

**Fuentes:** consigna "Trabajo Final Integrador 2026", Fase 1 corregida, Fase 2 corregida (tecnologías, ERD, diccionario de datos y reglas de negocio) e imagen del ERD (`DERtp-final.jpeg`).

---

## 1. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Alcance | **13 funcionalidades** (F1–F13) según la Fase 2. Se descarta F14 Voluntarios, que todavía aparece en el `.docx` de Fase 1. |
| Fuente de verdad del modelo | El **ERD** (imagen). El diccionario de datos del PDF de Fase 2 tiene columnas desalineadas; donde difieren, manda el ERD. |
| Regla de cancelación de operativos | La de la **Fase 2** (admin, 48 h, fuerza mayor, motivo obligatorio), que reemplaza la de Fase 1. |
| Stack | El de la Fase 2, sin cambios: Next.js 16 (App Router) + TypeScript, PostgreSQL 18, Sequelize, Tailwind CSS v4 + shadcn/ui, JWT (`jose`) en cookie httpOnly, `bcryptjs`. |
| Agregados al stack | **Zod** (validación compartida cliente/servidor), **Nodemailer** (SMTP real), **node-cron** o equivalente (procesador de notificaciones), **Vitest** (tests), **Recharts** vía componentes chart de shadcn (gráficos F13). |
| Acceso del vecino | **No usa el sistema.** Solo el personal municipal (admin, operador, veterinario) inicia sesión; el vecino recibe correos. |
| Entorno | **Local + Docker Compose** (PostgreSQL 18 en contenedor) para que ambos integrantes levanten el mismo entorno. |
| Correo | **Envío real por SMTP** (por ejemplo Gmail con contraseña de aplicación), configurable por `.env`. |
| Git | **Lo maneja el usuario.** Claude no ejecuta `git init`, commits ni push (ver `CLAUDE.md`). Cada fase termina en un punto de control para que el usuario commitee. |
| Código | Comentarios profesionales, claros y concisos que documentan cada procedimiento; código reutilizable; refactorización al cierre de cada fase (ver `CLAUDE.md`). |

## 2. Arquitectura

Monolito Next.js con **API REST + capa de servicios**:

```
Página (cliente, shadcn/ui + react-hook-form + Zod)
   │ fetch JSON
   ▼
Route Handler  src/app/api/**/route.ts
   │ 1) verifica sesión JWT   2) verifica permiso del rol
   │ 3) valida body/query con Zod   4) llama al servicio
   ▼
Servicio  src/services/*.ts   ← reglas de negocio + transacciones Sequelize
   ▼
Modelos  src/models/*.ts  →  PostgreSQL 18
```

### 2.1 Estructura de carpetas

```
/
├─ CLAUDE.md
├─ docker-compose.yml            PostgreSQL 18 con volumen persistente
├─ .env.example                  DATABASE_URL, DATABASE_URL_TEST, JWT_SECRET,
│                                SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS,
│                                SMTP_FROM, CRON_SECRET
├─ db/
│  ├─ migrations/                creación del esquema (FK, UNIQUE, CHECK)
│  └─ seeders/                   roles, admin inicial, zonas, datos demo
├─ src/
│  ├─ proxy.ts                   (Next 16; antes middleware.ts) protege páginas
│  ├─ instrumentation.ts         arranca el procesador periódico de notificaciones
│  ├─ app/
│  │  ├─ (auth)/login/
│  │  ├─ (panel)/layout.tsx      sidebar filtrado por rol, header con usuario
│  │  ├─ (panel)/dashboard, vecinos, animales, turnos, operativos, personal,
│  │  │   insumos, procedimientos, historial, avistamientos, zonas, usuarios,
│  │  │   notificaciones, reportes
│  │  └─ api/**/route.ts
│  ├─ lib/
│  │  ├─ auth.ts                 firmar/verificar JWT (edge-safe: NO importa db)
│  │  ├─ sesion.ts               leer la sesión desde la cookie en Route Handlers
│  │  ├─ db.ts                   instancia única de Sequelize + asociaciones
│  │  ├─ api.ts                  wrapper de handlers: errores → respuesta JSON
│  │  ├─ errores.ts              ReglaNegocioError, NoEncontradoError, etc.
│  │  ├─ permisos.ts             matriz rol → acciones
│  │  └─ mailer.ts               transporte Nodemailer + plantillas
│  ├─ models/                    16 modelos, uno por tabla
│  ├─ schemas/                   esquemas Zod por entidad
│  ├─ services/                  un servicio por funcionalidad
│  └─ components/                ui/ (shadcn) + componentes reutilizables
│                                (TablaDatos, FormularioDialogo, ConfirmarDialogo,
│                                 FiltroFechas, BadgeEstado…)
└─ tests/                        Vitest sobre servicios (base de datos de test)
```

### 2.2 Decisiones técnicas

- **Esquema con migraciones, no con `sync()`.** La Fase 2 (sección 7) afirma que la base garantiza UNIQUE, FK y CHECK (valores de estado y tipo, cantidades > 0, stock ≥ 0). `sync()` no crea CHECK, así que se usan migraciones de Sequelize (sequelize-cli/umzug).
- **`auth.ts` edge-safe.** `proxy.ts` solo importa `auth.ts` (jose), nunca `db.ts`. Las rutas de API validan su propio token.
- **Errores uniformes.** Los servicios lanzan errores tipados (`ReglaNegocioError` → 409, `ValidacionError` → 400, `NoEncontradoError` → 404, `ProhibidoError` → 403). El wrapper de `api.ts` los convierte en `{ error: { mensaje, campos? } }`, y el frontend los muestra en toasts o en el campo correspondiente del formulario. Errores no previstos → 500 con mensaje genérico, y el detalle va al log.
- **Validación doble.** El mismo esquema Zod se usa en el formulario (react-hook-form) y en el Route Handler.
- **Concurrencia.** Las operaciones que compiten por cupo o stock bloquean filas (`SELECT … FOR UPDATE`) dentro de la transacción.
- **Listados.** Búsqueda, paginación del lado del servidor y filtros por query string, con un componente de tabla reutilizable.
- **Fechas y horas.** Zona horaria `America/Argentina/Ushuaia` para mostrar y para calcular las 48 h y los recordatorios de 24 h.

## 3. Modelo de datos

Las 16 tablas del ERD, sin cambios estructurales: `rol`, `usuario`, `zona`, `vecino`, `animal`, `veterinario`, `operativo`, `operativo_veterinario`, `turno`, `procedimiento`, `insumo`, `procedimiento_insumo`, `movimiento_insumo`, `historial_clinico`, `reporte_avistamiento`, `notificacion`.

Restricciones que se implementan en la base:

| Tabla | Restricciones |
|---|---|
| rol | `nombre` UNIQUE, CHECK ∈ {administrador, operador, veterinario} |
| usuario | `email` UNIQUE; FK `rol_id` |
| zona | `nombre` UNIQUE |
| vecino | `dni` UNIQUE; FK `zona_id` |
| animal | `numero_chip` UNIQUE NULL; `sexo` CHECK ∈ {M, H}; `condicion` CHECK ∈ {con_tutor, callejero, asilvestrado}; FK `vecino_id` NULL |
| veterinario | `tipo` CHECK ∈ {veterinario, auxiliar}; `matricula` UNIQUE NULL; `usuario_id` UNIQUE NULL FK; CHECK (tipo='auxiliar' OR matricula IS NOT NULL) |
| operativo | `estado` CHECK ∈ {programado, en_curso, realizado, cancelado}; `cupo_maximo` > 0; `hora_fin` > `hora_inicio`; FK `zona_id`, `usuario_cancelacion_id` NULL |
| operativo_veterinario | PK compuesta (operativo_id, veterinario_id) |
| turno | `tipo_solicitado` CHECK ∈ {castracion, chipeo, castracion_y_chipeo}; `estado` CHECK ∈ {pendiente, confirmado, completado, cancelado}; FK `animal_id`, `operativo_id` |
| procedimiento | `tipo` CHECK (mismos valores que tipo_solicitado); `turno_id` UNIQUE; `numero_chip_colocado` UNIQUE NULL; FK `veterinario_id` |
| insumo | `nombre` UNIQUE; `stock_actual` ≥ 0; `stock_minimo` ≥ 0 |
| procedimiento_insumo | PK compuesta; `cantidad_usada` > 0 |
| movimiento_insumo | `tipo` CHECK ∈ {ingreso, egreso}; `cantidad` > 0; FK `procedimiento_id` NULL |
| historial_clinico | `procedimiento_id` UNIQUE FK |
| reporte_avistamiento | `estado` CHECK ∈ {pendiente, atendido}; `cantidad_animales` > 0; FK `zona_id`, `usuario_id`, `vecino_id` NULL, `operativo_id` NULL |
| notificacion | `tipo` CHECK ∈ {recordatorio, confirmacion, cancelacion, reprogramacion}; `canal` CHECK = 'email'; `estado_envio` CHECK ∈ {pendiente, enviado, fallido, anulado}* |

\* Se agrega el valor `anulado` para registrar los recordatorios que se anulan cuando se cancela o reprograma un turno, en lugar de borrarlos (trazabilidad). Es el único agregado a los valores documentados en la Fase 2.

## 4. Roles y permisos

L = solo lectura, ✔ = gestión completa, — = sin acceso.

| Módulo | Administrador | Operador | Veterinario |
|---|---|---|---|
| F1 Vecinos | ✔ | ✔ | L |
| F2 Animales | ✔ | ✔ | L |
| F3 Turnos | ✔ | ✔ | L |
| F4 Operativos (crear, editar, asignar personal, cambiar estado) | ✔ | ✔ | L |
| F4 Cancelar operativo | ✔ | — | — |
| F5 Personal actuante | ✔ | L | L |
| F6 Insumos y movimientos | ✔ | ✔ | L |
| F7 Registrar procedimiento | — | — | ✔ (solo si su registro de personal tiene tipo=veterinario, matrícula y asignación al operativo) |
| F8 Historial clínico | L | L | L |
| F9 Avistamientos | ✔ | ✔ | L |
| F10 Zonas | ✔ | L | L |
| F11 Usuarios | ✔ | — | — |
| F12 Notificaciones (ver, reintentar fallidas, procesar pendientes) | ✔ | L | — |
| F13 Reportes | ✔ | ✔ | — |
| Dashboard | ✔ | ✔ | ✔ (sus turnos del día) |

La validación real ocurre en el servidor (`requerirPermiso(sesion, accion)` → 403). En el cliente solo se ocultan el menú y los botones.

## 5. Reglas de negocio por funcionalidad

### Estados

- **Turno:** `pendiente → confirmado → completado`; desde `pendiente` o `confirmado` → `cancelado` (con motivo).
- **Operativo:** `programado → en_curso → realizado`; desde `programado` → `cancelado`.
- **Avistamiento:** `pendiente → atendido`.

### F1 Vecinos (Media)
- DNI único, nombre, apellido, teléfono, dirección y zona obligatorios; email válido si se informa.
- Eliminar: si no tiene animales ni otros registros asociados (turnos, avistamientos, notificaciones), se borra físicamente. Si tiene alguno, baja lógica (`activo=false`, `fecha_baja=hoy`) y, en la misma transacción, sus turnos pendientes o confirmados pasan a `cancelado` (motivo "Baja del vecino").
- Un vecino inactivo no puede solicitar turnos. Puede reactivarse.

### F2 Animales (Media)
- `condicion=con_tutor` exige `vecino_id`; `callejero`/`asilvestrado` lo dejan nulo.
- `numero_chip` único. No se elimina un animal con turnos o procedimientos.

### F3 Turnos (Media-Alta)
- **Solicitar:** el operativo debe estar `programado` y con fecha futura; el `horario` debe estar entre `hora_inicio` y `hora_fin`; debe haber cupo (`cupo_maximo − turnos pendiente|confirmado|completado > 0`, con bloqueo de fila del operativo); el animal no puede tener otro turno pendiente o confirmado; el tutor (si tiene) debe estar activo; no se solicita castración para un animal castrado ni chipeo para uno chipeado.
- **Confirmar:** pasa a `confirmado`; genera la notificación de *confirmación* y programa el *recordatorio* (fecha_programada = fecha del operativo + horario − 24 h). Si ese momento ya pasó, no se programa.
- **Reprogramar** (cambiar horario y/o operativo): se revalidan las mismas condiciones contra el destino; genera la notificación de *reprogramación* y recalcula el recordatorio (el anterior pasa a `anulado`).
- **Cancelar:** motivo obligatorio; genera la notificación de *cancelación*; anula el recordatorio pendiente.

### F4 Operativos (Media-Alta)
- Fecha futura al crear; `hora_fin > hora_inicio`; cupo > 0; zona existente.
- Cupo disponible calculado automáticamente y visible en listados y detalle.
- **Asignar personal:** la misma persona no puede estar en dos operativos del mismo día con horarios superpuestos; solo personal activo.
- **Editar:** el `cupo_maximo` no puede quedar por debajo de los turnos ocupados. Si cambia fecha, horario o lugar, cada turno activo recibe una notificación de *reprogramación* y se recalcula su recordatorio. No se editan operativos `realizado` ni `cancelado`.
- **Cancelar (solo administrador):** motivo obligatorio; al menos 48 h antes de `fecha + hora_inicio`, salvo la casilla "fuerza mayor", que solo exige que no haya comenzado (el motivo debe justificarla). No se cancela si está `en_curso` o `realizado`. En una transacción: estado `cancelado`, `fecha_cancelacion`, `usuario_cancelacion_id`; turnos pendientes o confirmados → `cancelado`; recordatorios → `anulado`; notificación de cancelación para cada vecino con correo.
- **Cambios de estado:** `programado → en_curso` (el día del operativo); `en_curso → realizado`: los turnos que siguen pendientes o confirmados pasan a `cancelado` con motivo "No se presentó".

### F5 Personal actuante (Media)
- `tipo=veterinario` exige matrícula (única). Vinculación opcional con un usuario de rol veterinario (`usuario_id` único).
- No se elimina personal asignado a un operativo futuro. Si tiene procedimientos, se desactiva (`activo=false`) en lugar de borrarse.

### F6 Insumos (Media)
- Nombre único; stock inicial ≥ 0; stock mínimo ≥ 0.
- Movimientos manuales de ingreso o egreso: cantidad > 0; un egreso no puede superar el stock; cada movimiento registra al usuario. Todo en una transacción con bloqueo de fila.
- Alerta visual de insumos con `stock_actual ≤ stock_minimo` (listado y dashboard).
- No se elimina un insumo con movimientos o usos registrados.

### F7 Registrar procedimiento (Media-Alta) — una única transacción
1. El turno debe estar `confirmado` y su operativo `en_curso`; el veterinario (personal vinculado al usuario en sesión) debe ser `tipo=veterinario`, estar activo, tener matrícula y estar asignado al operativo.
2. El `tipo` del procedimiento debe estar incluido en el `tipo_solicitado` del turno.
3. Si incluye chipeo: `numero_chip_colocado` obligatorio y único (tampoco puede existir en `animal.numero_chip`).
4. Por cada insumo usado (cantidad > 0, sin repetir): bloquear fila, verificar stock, descontar, crear `procedimiento_insumo` y un `movimiento_insumo` de egreso con `procedimiento_id`.
5. Animal: `castrado=true` si incluye castración; `numero_chip` ← chip colocado si incluye chipeo.
6. Turno → `completado`; recordatorio pendiente → `anulado`; alta en `historial_clinico` con una descripción generada (tipo, veterinario, insumos, chip, observaciones).
7. Cualquier falla → rollback total y un mensaje explícito (ej.: "Stock insuficiente de Ketamina: disponible 2,00 ml, requerido 5,00 ml").

### F8 Historial clínico (Media)
- Solo consulta. Vista por animal en orden cronológico (animal y fecha se obtienen de procedimiento → turno), con filtros por rango de fechas y tipo. Sin alta, edición ni baja manual.

### F9 Avistamientos (Media)
- Carga por personal (usuario en sesión), con zona obligatoria, cantidad > 0 y vecino opcional; sin GPS.
- Atender: `pendiente → atendido`, con `fecha_atencion` y operativo opcional (debe ser de la misma zona).

### F10 Zonas (Baja)
- Nombre único. No se elimina una zona con vecinos, operativos o reportes.

### F11 Usuarios y roles (Media)
- Solo el administrador gestiona. Email único; contraseña con hash bcrypt (mínimo 8 caracteres); un único rol.
- No se puede desactivar ni eliminar al propio usuario ni al último administrador activo. Un usuario con registros asociados se desactiva en lugar de borrarse. Un usuario inactivo no puede iniciar sesión.

### F12 Notificaciones (Baja)
- Se generan dentro de las transacciones de F3/F4 según el tipo: confirmación y cancelación (cambio de estado), reprogramación (cambio de horario u operativo, o de fecha/horario/lugar del operativo) y recordatorio (24 h antes, solo turnos confirmados).
- No se generan si el animal no tiene tutor o el vecino no tiene correo.
- **Procesador:** un servicio toma las notificaciones `pendiente` con `fecha_programada ≤ ahora`, las envía por SMTP y las marca `enviado` (con `fecha_envio`) o `fallido`. Se ejecuta cada minuto desde `instrumentation.ts` y también a demanda (botón "Procesar pendientes" y endpoint protegido con `CRON_SECRET`). Las fallidas pueden reintentarse.
- Listado con filtros por tipo, estado y fecha.

### F13 Reportes estadísticos (Media-Alta)
Filtros: zona (o todas) y rango de fechas. Sin tablas propias.
- Castraciones y chipeos por zona y período (`castracion_y_chipeo` suma a ambos).
- % cumplimiento de operativos = realizados / (realizados + cancelados), sobre los operativos con fecha ya pasada.
- % ocupación de cupo por operativo = turnos asignados (no cancelados) / cupo_maximo.
- % asistencia = turnos completados / (completados + cancelados con motivo "No se presentó").
- Evolución mensual de avistamientos (pendientes y atendidos) y tiempo promedio de atención (días).
- Cada indicador se muestra en un gráfico y en una tabla.

### Dashboard
Totales (vecinos activos, animales, castrados, chipeados), próximos operativos con cupo disponible, turnos del día, insumos bajo mínimo y avistamientos pendientes. El veterinario ve sus turnos del día.

## 6. Manejo de errores y UX

- Mensajes en español, específicos y accionables. Los errores de validación se muestran junto al campo y las reglas de negocio en un toast.
- Confirmación explícita antes de eliminar, cancelar y registrar procedimientos.
- Estados de carga y vacíos en todas las tablas; deshabilitar botones mientras se envía.
- Badges de color por estado (turno, operativo, notificación, avistamiento).

## 7. Pruebas

- **Automatizadas (Vitest + base de test en Docker)**, escritas con TDD sobre los servicios:
  - F3: sin cupo, turno activo duplicado, horario fuera de rango, vecino inactivo.
  - F4: regla de 48 h y fuerza mayor, cascada de cancelación, cupo menor a lo ocupado, "No se presentó" al finalizar.
  - F7: transacción exitosa completa y rollback por stock insuficiente o chip duplicado.
  - F1: baja física vs. baja lógica con cascada. F6: stock nunca negativo.
  - F12: programación, recálculo y anulación de recordatorios.
  - F13: fórmulas de indicadores sobre datos controlados.
- **Manuales:** checklist de recorridos completos por rol (evidencia de "verificación interna del equipo" que pide la consigna).
- **Seed demo:** zonas de Río Grande, alrededor de 30 vecinos, 50 animales, personal, insumos, operativos pasados (realizados y cancelados) y futuros, turnos, procedimientos y avistamientos, para que los reportes tengan contenido en la defensa.

## 8. Fases de construcción

Cada fase cierra con: **verificación** (tests + prueba manual) → **pasada de refactorización** → **punto de control** (aviso al usuario para que haga el commit).

| Fase | Fechas | Contenido | Criterio de cierre |
|---|---|---|---|
| 0. Base | 28–29/10 | Next.js 16 + TS + Tailwind v4 + shadcn/ui; Docker Compose; Sequelize; migraciones de las 16 tablas; modelos y asociaciones; seed inicial; Vitest configurado; `.env.example`; README | `docker compose up -d` + `npm run db:reset` crea la base con datos; `npm test` corre |
| 1. Acceso | 30–31/10 | Login/logout (JWT cookie httpOnly), `proxy.ts`, permisos, layout con menú por rol, componentes reutilizables base, F11 Usuarios | Cada rol entra y ve solo lo que corresponde |
| 2. Catálogos | 01–04/11 | F10, F5, F1, F2, F6 | CRUDs con búsqueda, paginación, validación doble y errores claros |
| 3. Operativos y turnos | 04–07/11 | F4, F3, F12 (Nodemailer, procesador, reintentos) | Circuito turno → confirmación → correo recibido; cancelación en cascada |
| 4. Procedimiento | 07–09/11 | F7, F8 | Procedimiento actualiza stock, turno, animal e historial; rollback probado |
| 5. Seguimiento | 09–10/11 | F9, F13, Dashboard | Indicadores correctos con el seed |
| 6. Verificación | 11–13/11 | Recorridos por rol, corrección de errores, usabilidad, seed demo final, README de instalación | Requisitos del entregable de Fase 3 cumplidos |

**Riesgo principal:** el plazo. Si hay atraso, primero se simplifica la presentación visual de F13 (gráficos → solo tablas). Las reglas de negocio de las 4 funcionalidades media-alta no se recortan.

## 9. Fuera de alcance

Facturación, integración con sistemas municipales, historia clínica detallada (diagnósticos o tratamientos), reporte ciudadano geolocalizado con mapa, voluntarios, portal o login para vecinos, despliegue en la nube.
