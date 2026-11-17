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

Fecha del recorrido: 2026-10-29 · Ejecutado por: el revisor (Claude) con Chrome DevTools sobre `npm run dev`. Los pasos marcados «API en navegador» se ejecutaron con `fetch` autenticado desde la pestaña (mismas rutas que usa la interfaz); los clics sobre formularios quedan para el usuario. R-F12, GEN-3, GEN-4 y ADM-2 siguen **Pendiente (usuario)**.

## R-ADM — Administrador

| N° | Paso | Resultado esperado | Resultado |
|---|---|---|---|
| ADM-1 | Ingresar con el administrador | Inicio con 4 totales (29 vecinos activos, 50 animales, 16 castrados, 16 chipeados), 5 turnos de hoy, próximos operativos, "Gasas estériles" bajo el mínimo y 4 avistamientos pendientes | OK (API en navegador): 29/50/16/16, 5 turnos hoy, 1 insumo bajo mínimo, 4 avistamientos pendientes |
| ADM-2 | Menú lateral | Ve todos los módulos, incluidos Usuarios, Zonas y Reportes | Pendiente (usuario) |
| ADM-3 | Usuarios: crear un operador nuevo, desactivarlo e intentar ingresar con él | Alta correcta; con el usuario inactivo el ingreso se rechaza | OK (API en navegador): alta 201, desactivación 200, ingreso con el inactivo 401 |
| ADM-4 | Zonas: crear "Zona de prueba" y luego intentar eliminar "Centro" | Alta correcta; "Centro" no se elimina porque tiene vecinos/operativos asociados | OK (API en navegador): alta 201; eliminar Centro 409 (5 vecinos, 3 operativos, 3 avistamientos) |
| ADM-5 | Personal: ver a Ana, Martín y Carla; intentar crear un veterinario sin matrícula | La matrícula es obligatoria para tipo veterinario | OK (API en navegador): lista Carla, Ana, Martín; sin matrícula 400 con mensaje del campo |
| ADM-6 | Operativos: crear uno para mañana (menos de 48 h) con cupo 2 | Queda programado | OK (API en navegador): creado para mañana (ver nota H-1) |
| ADM-7 | Cancelar ese operativo sin marcar fuerza mayor (si faltan 48 h o más, la cancelación ordinaria es válida) | Se rechaza por faltar menos de 48 h | OK (API en navegador): 409 «Faltan menos de 48 h…» (ver nota H-1) |
| ADM-8 | Cancelarlo marcando fuerza mayor y con motivo | Queda cancelado con motivo, fecha y usuario | OK (API en navegador): 200, estado cancelado con motivo |
| ADM-9 | Operativos: abrir el operativo de hoy e iniciarlo | Pasa a "En curso" | OK (API en navegador): pasa a en_curso |
| ADM-10 | Notificaciones: listado y filtros por tipo y estado | El listado responde a los filtros | OK (API en navegador): listado y filtros responden 200 |
| ADM-11 | Reportes: cambiar zona y período | Los cinco indicadores se actualizan (gráfico y tabla); con "desde" posterior a "hasta" aparece el aviso | OK (API en navegador): cinco indicadores; desde > hasta devuelve 400 con el aviso |
| ADM-12 | Cerrar sesión | Vuelve a la pantalla de ingreso | OK (API en navegador): cierre de sesión 200 |

## R-OPE — Operador

| N° | Paso | Resultado esperado | Resultado |
|---|---|---|---|
| OPE-1 | Ingresar con el operador | Inicio general; el menú no muestra Usuarios | OK (API en navegador): ingreso 200; /api/usuarios devuelve 403 |
| OPE-2 | Vecinos: alta con un DNI ya cargado | Error en el campo DNI | OK (API en navegador): error en el campo dni «Ya existe un vecino con ese DNI» |
| OPE-3 | Vecinos: alta correcta y búsqueda por apellido | El vecino aparece en la búsqueda | OK (API en navegador): alta 201 y búsqueda por apellido devuelve 1 |
| OPE-4 | Animales: alta "con tutor" para ese vecino; alta "callejero" sin tutor | Ambas altas correctas; un callejero no admite tutor | OK (API en navegador): ambas altas 201; el callejero con tutor se guarda con vecino_id nulo (ver observación O-1) |
| OPE-5 | Turnos: pedir turno para el animal nuevo en el próximo operativo | Queda pendiente | OK (API en navegador): turno pendiente |
| OPE-6 | Pedir un segundo turno para el mismo animal | Se rechaza: ya tiene un turno activo | OK (API en navegador): 409 «El animal ya tiene un turno pendiente o confirmado» |
| OPE-7 | Confirmar el turno y luego reprogramarlo a otro horario | Confirmado y reprogramado | OK (API en navegador): confirmado y reprogramado a 12:40 |
| OPE-8 | Dar de baja al vecino del paso 3 | Sus turnos activos quedan cancelados con motivo "Baja del vecino" | OK (API en navegador): turno cancelado con motivo «Baja del vecino» |
| OPE-9 | Insumos: registrar un ingreso de 10 paquetes de "Gasas estériles" | El stock sube a 25 y deja de figurar bajo el mínimo | OK (API en navegador): stock 15,00 a 25,00; sin insumos bajo el mínimo |
| OPE-10 | Insumos: registrar un egreso mayor que el stock | Se rechaza (el stock nunca queda negativo) | OK (API en navegador): 409 «Stock insuficiente…»; stock sin cambios |
| OPE-11 | Avistamientos: alta sin vecino; intentar fecha futura | Alta correcta; la fecha futura se rechaza | OK (API en navegador): alta 201; fecha futura 400 |
| OPE-12 | Atender un avistamiento pendiente eligiendo un operativo de su zona | Queda atendido; ya no muestra acciones de edición | OK (API en navegador): atendido (200); editarlo después da 409 |
| OPE-13 | Intentar abrir `/usuarios` escribiendo la dirección | Redirige al inicio | OK (API en navegador): la página redirige a /dashboard (con streaming llega como NEXT_REDIRECT en el cuerpo, ver H-2) |

## R-VET — Veterinaria (Ana Ríos)

Requiere que el operativo de hoy esté "En curso" (ADM-9).

| N° | Paso | Resultado esperado | Resultado |
|---|---|---|---|
| VET-1 | Ingresar con la veterinaria | El inicio muestra solo sus turnos de hoy (5) | OK (API en navegador): 5 turnos de hoy |
| VET-2 | Procedimientos: ver los turnos para atender | Figuran los 4 confirmados del operativo de hoy | OK (API en navegador): 4 turnos para atender |
| VET-3 | Registrar el turno "Castración y chipeo" con un chip de 12 dígitos | Error en el campo chip (15 dígitos) | OK (API en navegador): 400 «El chip debe tener 15 dígitos» |
| VET-4 | Registrarlo con un chip de 15 dígitos y 2,5 ml de Ketamina | Registro correcto; el turno desaparece de la lista | OK (API en navegador): 201; quedan 3 turnos en la lista |
| VET-5 | Registrar otro turno pidiendo 1000 ml de Ketamina | "Stock insuficiente de Ketamina…" y nada cambia (stock, turno, animal) | OK (API en navegador): 409 «Stock insuficiente de Ketamina: disponible 457,50 ml…»; stock y turnos sin cambios |
| VET-6 | Historial: buscar el animal del paso 4 | Entrada con tipo, veterinaria, chip e insumos | OK (API en navegador): 1 entrada con tipo, veterinaria, chip e insumos |
| VET-7 | Avistamientos | Solo consulta: sin botones de alta ni acciones | OK (API en navegador): consulta 200; alta 403 |
| VET-8 | Intentar abrir `/reportes` | Redirige al inicio | OK (API en navegador): redirige a /dashboard; /api/reportes devuelve 403 |

Al terminar, el administrador **finaliza** el operativo de hoy: los turnos sin atender quedan cancelados con "No se presentó" y la asistencia de Reportes baja en consecuencia.

## R-VET2 — Veterinario sin turnos hoy (Martín Sosa)

| N° | Paso | Resultado esperado | Resultado |
|---|---|---|---|
| VT2-1 | Ingresar con el veterinario | Inicio sin turnos de hoy ("No hay turnos para hoy") | OK (navegador): inicio con «No hay turnos para hoy» |
| VT2-2 | Procedimientos | Sin turnos para atender (no está asignado a un operativo en curso) | OK (API en navegador): habilitado, 0 turnos |

## R-F12 — Correo real (lo realiza el usuario)

Requiere completar en `.env` `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (en Gmail, una contraseña de aplicación) y `SMTP_FROM`, y reiniciar el servidor.

| N° | Paso | Resultado esperado | Resultado |
|---|---|---|---|
| F12-1 | Operador: pedir turno para "Toby" (vecina "Prueba Correo") en el próximo operativo y confirmarlo | En Notificaciones aparece una "Confirmación" para `mepotdf@gmail.com` | Pendiente (usuario) |
| F12-2 | Esperar el procesador o usar "Procesar pendientes" | La confirmación pasa a "Enviado" y el correo llega a `mepotdf@gmail.com` | Pendiente (usuario) |
| F12-3 | Cancelar el turno de Toby con un motivo | Llega el correo de cancelación con el motivo; el recordatorio queda "Anulado" | Pendiente (usuario) |

## R-GEN — Transversales

| N° | Paso | Resultado esperado | Resultado |
|---|---|---|---|
| GEN-1 | Abrir una dirección inexistente (ej.: `/inexistente`) | Página 404 en español con "Volver al inicio" | OK (navegador): 404 en español con «Volver al inicio» |
| GEN-2 | Títulos de pestaña al navegar | "Vecinos · SIGCAN", "Reportes · SIGCAN", etc. | OK (HTML de 10 rutas): «Vecinos · SIGCAN», «Inicio · SIGCAN», etc.; «Iniciar sesión · SIGCAN» en /login |
| GEN-3 | Tema oscuro del sistema operativo en Inicio y Reportes | Textos, ejes, leyendas y tooltips legibles | Pendiente (usuario) |
| GEN-4 | Ventana angosta (≈ 400 px) en Vecinos y Reportes | Las tablas se desplazan horizontalmente sin romper la página | Pendiente (usuario) |
| GEN-5 | Ingreso con contraseña incorrecta | Mensaje de error sin revelar si el email existe | OK (navegador): «Email o contraseña incorrectos» |
