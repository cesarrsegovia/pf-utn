# SIGCAN — Prueba funcional completa por interfaz (F1–F13)

- **Fecha de ejecución:** 16/11/2026 (hora del servidor: entre las 23:10 y las 23:55).
- **Ejecutó:** revisor Claude (QA), por interfaz con clics reales en Chrome (Chrome DevTools MCP). No se modificó código, `.env`, ni se usó git.
- **Entorno:** `npm run dev` en http://localhost:3000 · **Next.js 16.4.6** (App Router) · Sequelize + Postgres 5433 (contenedor `sigcan-db`). Base reiniciada con `npm run db:demo` antes de empezar y vuelta a reiniciar al terminar.
- **Fuentes de reglas:** `docs/Fase1_corregido_final.docx` (tabla de funcionalidades), `docs/Fase 2 - Diseno del Sistema - CORREGIDO.pdf` §6, `docs/verificacion/recorridos.md`.
- **Método:** los clics y formularios se hicieron por la interfaz. `evaluate_script` se usó solo para leer textos/estado de la pantalla, y para verificar códigos HTTP 403 de rutas API con otro rol (marcado donde ocurre). Los efectos en base de datos (stock, estados, notificaciones, historial) se verificaron además con consultas SQL **de solo lectura** (`select`) sobre `sigcan-db`.
- **Usuarios usados:** operador (Laura Gómez), administrador, veterinaria (Ana Ríos), veterinario (Martín Sosa).
- **SMTP:** no configurado. El envío real de correo queda NO EJECUTADO.

## Observación previa sobre el alcance (13 vs 14 funcionalidades)

`Fase1_corregido_final.docx` declara **14** funcionalidades (la F14 "Gestionar Voluntarios", y el texto "14 funcionalidades/procesos"), pero el sistema implementa **13** y `Fase 2 §8` dice que se eliminaron las tablas `voluntario` y `operativo_voluntario` "porque la funcionalidad de voluntarios se quitó del alcance en la Fase 1 corregida". El documento de Fase 1 que figura en `docs/` no refleja ese cambio (ver H-5). F14 no existe en la interfaz (no hay menú ni ruta), por lo que **no se probó**.

---

## F1 — Gestionar Vecinos/Solicitantes
Registrar, consultar/buscar, modificar y eliminar vecinos. Sin baja física si hay turnos/procedimientos (baja lógica, historial intacto). Fase 2: sin registros se elimina; con registros baja lógica (`activo=false`, `fecha_baja`), turnos pendientes/confirmados pasan a cancelado; un vecino inactivo no puede solicitar turnos.

| N° | Regla / caso | Pasos (resumidos) | Esperado | Obtenido | Resultado |
|---|---|---|---|---|---|
| 1.1 | Campos obligatorios | Vecinos > Nuevo vecino > Guardar vacío | Mensajes por campo | «Este campo es obligatorio» (nombre, apellido, teléfono, dirección), «Ingrese 7 u 8 dígitos, sin puntos» (DNI), «Seleccione una zona» | OK |
| 1.2 | Formato de email | Email "noesemail" | Rechazo en cliente | «Ingrese un email válido» | OK |
| 1.3 | DNI único | Alta con DNI 25300000 (existente) | Rechazo | «Ya existe un vecino con ese DNI» en el campo | OK |
| 1.4 | Alta válida | DNI 30111222 | Se crea | Aparece en el listado | OK |
| 1.5 | Búsqueda, filtros y paginación | Buscar "QA Uno"; Estado Inactivos/Todos; Zona Centro; Siguiente | Resultados filtrados; 10 por página | Búsqueda correcta; zona Centro = 5 vecinos; «30 registros, Página 2 de 3» | OK |
| 1.6 | Modificar | Editar teléfono | Cambio guardado | Teléfono actualizado en el listado | OK |
| 1.7 | Baja física sin registros | Dar de baja al vecino recién creado | Se elimina | Toast «Vecino eliminado»; no figura ni en "Todos" | OK |
| 1.8 | Baja lógica con turno pendiente | Dar de baja a Pereyra, Laura (animal Simón con turno pendiente) | Queda inactivo, turno cancelado "Baja del vecino" | «Vecino dado de baja. Turnos cancelados: 1»; fila «Baja 16/11/2026»; BD: turno 41 cancelado, motivo «Baja del vecino» | OK |
| 1.9 | Vecino inactivo no solicita turnos | Abrir Nuevo turno / Nuevo animal tras la baja | No se ofrece | Sus animales no aparecen en Nuevo turno; no figura como tutor en Nuevo animal | OK |
| 1.10 | Historial intacto tras baja lógica | Turnos > Estado Cancelado | Turno vinculado visible | Turno de Simón / Pereyra figura Cancelado | OK |
| 1.11 | Reactivar (extra, no figura en Fase 1) | Estado Inactivos > Reactivar | Vuelve a activo | Pereyra deja de figurar como inactivo | OK |

## F2 — Gestionar Animales (Caninos)
Ficha del animal (raza, sexo, edad, condición). Fase 2: callejero/asilvestrado = sin tutor; chip único; no se elimina con turnos/procedimientos.

| N° | Regla / caso | Pasos | Esperado | Obtenido | Resultado |
|---|---|---|---|---|---|
| 2.1 | Con tutor requiere tutor | Nuevo animal > Guardar | Rechazo | «Seleccione el tutor» | OK |
| 2.2 | Chip de 15 dígitos | Chip de 12 dígitos | Rechazo | «El chip debe tener 15 dígitos» | OK |
| 2.3 | Edad no negativa | Edad -3 | Rechazo | «No puede ser negativa» | OK |
| 2.4 | Alta con tutor | Rocco, tutor Prueba Correo | Se crea | Creado | OK |
| 2.5 | Callejero sin tutor | Condición Callejero | Se oculta el campo Tutor; se crea | Campo Tutor oculto; "Calle QA" creado | OK |
| 2.6 | Chip único | Chip 900000000000001 ya usado | Rechazo | «Ya existe un animal con ese número de chip» | OK |
| 2.7 | Búsqueda por DNI de tutor | Buscar 25521732 | Animales del tutor | Rocco y Toby | OK |
| 2.8 | Modificar | Editar Rocco, marcar Castrado | Cambio guardado | Castrado = Sí | OK |
| 2.9 | Eliminar sin turnos | Eliminar Rocco | Se elimina | Toast «Animal eliminado» | OK |
| 2.10 | No eliminar con turnos | Eliminar Duque (tutor Acosta) | Rechazo | «No se puede eliminar el animal porque tiene 2 turnos registrados» | OK |
| 2.11 | Filtro Condición | — | — | No se ejercitó el filtro Condición por separado | NO EJECUTADO |

## F3 — Gestionar Turnos
Solicitar, confirmar, reprogramar, cancelar. Cupo disponible; un solo turno pendiente/confirmado por animal.

| N° | Regla / caso | Pasos | Esperado | Obtenido | Resultado |
|---|---|---|---|---|---|
| 3.1 | Horario obligatorio | Guardar sin horario | Rechazo | «Ingrese una hora válida (HH:MM)» | OK |
| 3.2 | Horario dentro del operativo | Toby, operativo 09–13, hora 15:30 | Rechazo | «El horario debe estar entre las 09:00 y las 13:00» | OK |
| 3.3 | Alta válida | Toby, operativo 21/11, 10:00 | Pendiente | Turno creado (Pendiente) | OK |
| 3.4 | Un turno activo por animal | Segundo turno para Toby en otro operativo | Rechazo | «El animal ya tiene un turno pendiente o confirmado» | OK |
| 3.5 | Cupo agotado | Operativo cupo 1: un turno y un segundo animal | 0 libres y rechazo | La lista muestra «(0 libres)»; al guardar: «El operativo no tiene cupo disponible» | OK |
| 3.6 | Cupo se recalcula | Tras baja de Pereyra | 11 libres en operativo de hoy | «11 libres» (antes 10) | OK |
| 3.7 | Confirmar | Confirmar turno de Toby | Estado Confirmado | Confirmado (diálogo de confirmación previo) | OK |
| 3.8 | Reprogramar | Toby: operativo 28/11 a las 11:30 | Cambia fecha/hora/lugar | Turno pasó a 28/11 11:30, lugar Austral | OK |
| 3.9 | Cancelar exige motivo | Cancelar turno sin motivo | Rechazo | «Este campo es obligatorio» | OK |
| 3.10 | Cancelar con motivo | Motivo "Pedido del vecino" | Cancelado, motivo guardado | Estado Cancelado; BD guarda el motivo | OK |
| 3.11 | Filtro Estado y búsqueda | Estado Cancelado | Solo cancelados | 10 cancelados listados | OK |
| 3.12 | Animales ofrecidos al pedir turno | Abrir Nuevo turno | (Usabilidad) | Se listan animales que ya tienen turno activo (se rechaza al guardar) | OK (obs. H-8) |

## F4 — Gestionar Operativos/Jornadas
Fecha, lugar, personal, cupo; cupo calculado; cancelación (futura, ≥48 h salvo fuerza mayor, motivo, cascada, sin afectar completados).

| N° | Regla / caso | Pasos | Esperado | Obtenido | Resultado |
|---|---|---|---|---|---|
| 4.1 | Campos obligatorios | Guardar vacío | Mensajes | «Ingrese una fecha válida», «Seleccione una zona», «Este campo es obligatorio» | OK |
| 4.2 | Fecha futura | Fecha 01/11/2026 | Rechazo | «La fecha y hora de inicio deben ser futuras» | OK |
| 4.3 | Fin posterior al inicio | Fin 08:00 con inicio 09:00 | Rechazo | «Debe ser posterior a la hora de inicio» | OK |
| 4.4 | Alta válida y cupo calculado | 20/11, cupo 1 | Cupo 0/1 | «0/1 (1 libres)» | OK |
| 4.5 | Cupo según turnos | Agregar un turno | 1/1 (0 libres) | «1/1 (0 libres)» | OK |
| 4.6 | Asignar personal | Detalle > asignar QA Vet | Figura asignado | Figura en «Personal asignado» | OK |
| 4.7 | Cancelación: motivo obligatorio | Cancelar sin motivo | Rechazo | «Este campo es obligatorio» | OK |
| 4.8 | Cancelación con <48 h sin fuerza mayor | Operativo de mañana 09:00 | Rechazo | «Faltan menos de 48 h para el inicio: solo se puede cancelar por fuerza mayor…» | OK |
| 4.9 | Cancelación con fuerza mayor | Marcar casilla y justificar | Cancelado | Cancelado con «Motivo de cancelación» visible | OK |
| 4.10 | Cancelación >48 h en cascada | Operativo 20/11 con turno confirmado de Toby | Turno cancelado, recordatorio anulado, notificación al vecino | BD: turno cancelado «Cancelación del operativo»; recordatorio «anulado»; notificación «cancelacion» generada; cupo 0/1 | OK |
| 4.11 | Pantalla tras cancelar/finalizar | Ver tabla de turnos del detalle sin recargar | Estado actualizado | La tabla de turnos sigue mostrando «Confirmado» hasta recargar (la cabecera sí cambia). Ocurre también con Finalizar | Falla H-1 |
| 4.12 | No cancelar operativo ya comenzado | Cancelar el de hoy (fecha pasada de hora de inicio) con fuerza mayor | Rechazo | «El operativo ya comenzó: no se puede cancelar» | OK |
| 4.13 | En curso/realizado no ofrecen Cancelar | Detalle del operativo en curso y realizado | Sin botón Cancelar | Solo Editar/Finalizar (en curso); ninguno (realizado) | OK |
| 4.14 | Iniciar solo el día programado | Iniciar operativo 21/11 | Rechazo | «El operativo solo se puede iniciar el día programado (21/11/2026)» | OK |
| 4.15 | Iniciar el de hoy | Iniciar operativo de hoy | En curso | «En curso» | OK |
| 4.16 | Finalizar: «No se presentó» | Finalizar operativo de hoy | Turnos confirmados sin atender quedan cancelados «No se presentó» | BD: Jack y Malena cancelados «No se presentó»; operativo «Realizado» | OK |
| 4.17 | Edición: cupo no menor a turnos | Cupo 2 con 3 turnos | Rechazo | «No puede ser menor a los 3 turnos ya asignados» | OK |
| 4.18 | Cancelar operativo con turno completado | (cubierto por 4.12/4.13: operativo con completados está en curso/realizado) | No cancelable | No hay vía de cancelación | OK |

## F5 — Gestionar Veterinarios/Personal Actuante

| N° | Regla / caso | Pasos | Esperado | Obtenido | Resultado |
|---|---|---|---|---|---|
| 5.1 | Matrícula obligatoria al veterinario | Alta tipo Veterinario/a sin matrícula | Rechazo | «La matrícula es obligatoria para veterinarios» | OK |
| 5.2 | Matrícula única | MV-1201 repetida | Rechazo | «Ya existe personal con esa matrícula» | OK |
| 5.3 | Alta válida | MV-9999 | Se crea | Figura en el listado | OK |
| 5.4 | No eliminar si está en operativo futuro | Eliminar QA Vet asignado a operativo programado | Rechazo | «No se puede dar de baja: el integrante está asignado a un operativo programado o en curso» | OK |
| 5.5 | Con historial se desactiva | Eliminar tras cancelarse ese operativo | Se desactiva | «Tiene operativos o procedimientos registrados: se desactivó en lugar de eliminarse» | OK |
| 5.6 | Operador solo consulta | Operador abre Personal | Sin altas/ediciones | Sin botones de acción | OK |
| 5.7 | Edición y filtros Tipo/Estado | — | — | No se ejercitaron | NO EJECUTADO |
| 5.8 | Selector de personal en operativo | Asignar a un operativo | (Usabilidad) | La lista sigue ofreciendo al personal ya asignado | OK (obs. H-8) |

## F6 — Gestionar Insumos Veterinarios

| N° | Regla / caso | Pasos | Esperado | Obtenido | Resultado |
|---|---|---|---|---|---|
| 6.1 | Stock inicial no negativo | Stock -5 | Rechazo | «No puede ser negativo» | OK |
| 6.2 | Alta | Insumo QA, stock 5, mínimo 10 | Creado, «Bajo mínimo» | Creado, con movimiento «Stock inicial» (Laura Gómez) | OK |
| 6.3 | Egreso mayor al stock | Egreso 8 con stock 5 | Rechazo | «Stock insuficiente de Insumo QA: disponible 5,00 ampollas, requerido 8,00 ampollas» | OK |
| 6.4 | Cantidad > 0 | Egreso -2 | Rechazo | «Debe ser mayor a 0» | OK |
| 6.5 | Egreso válido | Egreso 2 | Stock 3; movimiento con usuario | Stock 3,00; movimiento «Egreso 2,00 · Manual · Laura Gómez» | OK |
| 6.6 | Eliminar con movimientos | Eliminar Insumo QA | Rechazo | «No se puede eliminar el insumo porque tiene 2 movimientos de stock registrados» | OK |
| 6.7 | Filtro Bajo mínimo | Stock > Bajo mínimo | Solo bajo mínimo | Gasas estériles e Insumo QA | OK |
| 6.8 | Ingreso manual posterior y edición del insumo | — | — | No se ejercitaron (solo el ingreso inicial) | NO EJECUTADO |

## F7 — Registrar Procedimiento Realizado

| N° | Regla / caso | Pasos | Esperado | Obtenido | Resultado |
|---|---|---|---|---|---|
| 7.1 | Chip obligatorio si hay chipeo | Duque (castración y chipeo): registrar sin chip | Rechazo | «Ingrese el número de chip colocado» | OK |
| 7.2 | Chip de 15 dígitos | 11 dígitos | Rechazo | «El chip debe tener 15 dígitos» | OK |
| 7.3 | Chip único | Chip ya registrado | Rechazo en el campo | «El chip 985141000000001 ya está registrado» | OK |
| 7.4 | Stock insuficiente | Ketamina 1000 ml | Rechazo, nada cambia | «Stock insuficiente de Ketamina: disponible 460,00 ml, requerido 1.000,00 ml»; stock sin cambios | OK |
| 7.5 | Confirmación previa | Registrar | Diálogo de confirmación | «Confirmar registro… no se puede deshacer» | OK |
| 7.6 | Registro válido en cascada | Duque: chip 900000000000777, Ketamina 2,5 ml, Microchip 1 | Turno completado; stock descontado; egresos; historial; animal castrado/chipeado | BD: turno 37 completado; Ketamina 460→457,50, Microchip 64→63; 2 egresos con `procedimiento_id` y usuario de Ana; animal castrado = true y chip copiado; entrada de historial creada | OK |
| 7.7 | Registro sin insumos | Pupi (castración) | Se registra | Turno completado, historial «Sin insumos registrados» | OK |
| 7.8 | Tipos ofrecidos | Abrir turno de Pupi | Solo lo solicitado | Solo «Castración» | OK |
| 7.9 | Solo veterinarios del operativo | Martín Sosa (no asignado) | Sin turnos para atender | «No tiene turnos confirmados en operativos en curso» | OK |
| 7.10 | Lista de pendientes | Tras registrar | El turno sale de la lista | Sale de la lista | OK |
| 7.11 | Operador sin acceso | Operador abre /procedimientos | Redirige | Redirige a /dashboard (menú sin Procedimientos) | OK |

## F8 — Gestionar Historial Clínico del Animal

| N° | Regla / caso | Pasos | Esperado | Obtenido | Resultado |
|---|---|---|---|---|---|
| 8.1 | Entradas automáticas, orden cronológico | Historial tras F7 | Duque y Pupi arriba, más reciente primero | Correcto, con veterinaria, chip e insumos | OK |
| 8.2 | Solo consulta | Revisar pantalla | Sin alta/edición/baja | Sin botones | OK |
| 8.3 | Filtro por tipo | Tipo = Chipeo | Chipeos | Solo «Chipeo» (excluye «Castración y chipeo») | OK (obs. H-6) |
| 8.4 | Filtro por fechas | Desde 10/11/2026 + Chipeo | Vacío | «No hay procedimientos registrados» | OK |
| 8.5 | Historial completo de un animal (`?animal=`) | — | — | No se abrió la vista por animal | NO EJECUTADO |

## F9 — Gestionar Reportes de Avistamiento

| N° | Regla / caso | Pasos | Esperado | Obtenido | Resultado |
|---|---|---|---|---|---|
| 9.1 | Obligatorios | Guardar vacío | Mensajes | «Seleccione una zona», «Este campo es obligatorio» | OK |
| 9.2 | Fecha no futura | Día 17 | Rechazo | «La fecha y hora no pueden ser futuras» | OK |
| 9.3 | Cantidad > 0 (edición) | Cantidad 0 | Rechazo | «Debe ser mayor a 0» | OK |
| 9.4 | Alta (anónimo) | Zona Centro, 2 animales | Pendiente | Alta Pendiente, «Anónimo» | OK |
| 9.5 | Filtros | Estado Pendiente + Zona Centro; Desde 15/11 | Filtrado | Correcto | OK |
| 9.6 | Atender con operativo de la zona | Atender > operativos | Solo operativos de la zona | Solo los 3 de Centro; queda Atendido con fecha y operativo | OK |
| 9.7 | Atendido no editable | Ver fila atendida | Sin acciones | 0 botones | OK |
| 9.8 | Editar pendiente | Cantidad 3 | Cambia | Guardado | OK |
| 9.9 | Eliminar pendiente | Eliminar | Se elimina | Desaparece | OK |
| 9.10 | Veterinaria solo consulta | Veterinaria abre Avistamientos | Sin acciones | Sin botones | OK |

## F10 — Gestionar Zonas/Barrios

| N° | Regla / caso | Pasos | Esperado | Obtenido | Resultado |
|---|---|---|---|---|---|
| 10.1 | Nombre obligatorio | Guardar vacío | Rechazo | «Este campo es obligatorio» | OK |
| 10.2 | Nombre único | "Centro" | Rechazo | «Ya existe una zona con ese nombre» | OK |
| 10.3 | Alta y edición | "Zona QA" + descripción | Se crea y edita | Correcto | OK |
| 10.4 | No eliminar con asociados | Eliminar "Centro" | Rechazo con conteos | «…5 vecinos, 3 operativos y 4 reportes de avistamiento» | OK |
| 10.5 | Eliminar sin asociados | Eliminar "Zona QA" | Se elimina | Eliminada | OK |
| 10.6 | Operador solo consulta | Operador abre Zonas | Sin altas | Sin botones | OK |

## F11 — Gestionar Usuarios y Roles

| N° | Regla / caso | Pasos | Esperado | Obtenido | Resultado |
|---|---|---|---|---|---|
| 11.1 | Obligatorios, email, contraseña | Guardar vacío / "abc" | Mensajes | «Este campo es obligatorio», «Ingrese un email válido», «Mínimo 8 caracteres» | OK |
| 11.2 | Email único | operador@sigcan.local | Rechazo | «Ya existe un usuario con ese email» | OK |
| 11.3 | Alta con un único rol | qa.operador, rol Operador | Se crea | Creado | OK |
| 11.4 | Cambiar rol y desactivar | Rol Veterinario + inactivo | Guardado | «Veterinario · Inactivo» | OK |
| 11.5 | Usuario inactivo no ingresa | Ingresar con ese usuario | Rechazo | «El usuario está inactivo. Contacte al administrador» | OK |
| 11.6 | Eliminar sin registros | Eliminar usuario QA | Se elimina | Desaparece | OK |
| 11.7 | No auto-eliminarse | Administrador se elimina a sí mismo | Rechazo | «No puede eliminar su propio usuario» | OK |
| 11.8 | Solo el administrador gestiona usuarios | Operador y veterinaria abren /usuarios | Redirige | Redirigen a /dashboard; `/api/usuarios` con operador: 403 (verificado con fetch) | OK |
| 11.9 | Login: validación y error | Vacío / clave errónea | Mensajes | «Ingrese un email válido», «Ingrese la contraseña»; «Email o contraseña incorrectos» | OK |

## F12 — Gestionar Notificaciones a Vecinos
Confirmación y cancelación por cambio de estado; reprogramación por cambio de fecha/horario/lugar; recordatorio 24 h antes, solo turnos confirmados, recalculado y anulado; sin tutor/sin correo no se generan. (Vecina de pruebas con correo: Toby.)

| N° | Regla / caso | Pasos | Esperado | Obtenido | Resultado |
|---|---|---|---|---|---|
| 12.1 | Confirmación | Confirmar turno de Toby | Notificación «Confirmación» | Generada con fecha, hora y lugar | OK |
| 12.2 | Recordatorio 24 h antes | Turno 21/11 10:00 | Programado 20/11 10:00 | «20/11/26 10:00 · Recordatorio» | OK |
| 12.3 | Reprogramación y recálculo | Cambiar a 28/11 11:30 | Reprogramación + recordatorio nuevo; anterior anulado | «Reprogramación» generada; nuevo recordatorio 27/11 11:30; anterior «Anulado» | OK |
| 12.4 | Cancelación | Cancelar turno | «Cancelación» + recordatorio anulado | Generada; recordatorio «Anulado» | OK |
| 12.5 | Cancelación por operativo | Cancelar operativo con turno confirmado | Notificación por vecino afectado | Notificación «cancelacion» generada | OK |
| 12.6 | Sin correo no se genera | Cancelación de turnos de vecinos sin email (baja de Pereyra, «No se presentó») | Sin notificación | 0 notificaciones para esos turnos | OK |
| 12.7 | Procesar pendientes sin SMTP | «Procesar pendientes» | Estado visible | «Enviadas: 0 · Fallidas: 5»; las 5 quedan «Fallido» | OK |
| 12.8 | Filtros del listado | Tipo/Estado/fechas/búsqueda | Filtrar | No se ejercitaron por la interfaz | NO EJECUTADO |
| 12.9 | Envío real de correo | — | Correo recibido | Requiere SMTP del usuario | NO EJECUTADO |
| 12.10 | Envío automático cada minuto | Observar 10 min | Pendientes se envían | Sin SMTP el procesador no arranca (por diseño, `procesador-notificaciones.ts`); el texto de pantalla dice que se envían solos | OK (obs. H-3) |

## F13 — Generar Reportes Estadísticos
Las cifras se contrastaron con consultas SQL de solo lectura.

| N° | Regla / caso | Pasos | Esperado | Obtenido | Resultado |
|---|---|---|---|---|---|
| 13.1 | Castraciones/chipeos por zona | Reportes (rango por defecto) | 18 y 17 | 18 castraciones · 17 chipeos; BD: 9+9 castraciones y 9+8 chipeos | OK |
| 13.2 | Sube tras registrar procedimientos | Antes 16/16 (Inicio); registrar Duque (C+C) y Pupi (C) | Castrados 18, chipeados 17 | Inicio: Castrados 18 (35 %), Chipeados 17 (33 %); BD idem | OK |
| 13.3 | Filtro por zona | Zona Centro | Solo Centro | «6 castraciones · 5 chipeos», tabla coincide | OK |
| 13.4 | Rango inválido | «Desde» 20/11 > «Hasta» | Aviso | «Elija un rango válido: «desde» no puede ser posterior a «hasta»» | OK |
| 13.5 | Cumplimiento de operativos | Realizados/(realizados+cancelados) de fecha pasada | 8/(8+2)=80 % | 80 % | OK (obs. H-7) |
| 13.6 | Asistencia a turnos | Antes 26/8 → tras Finalizar | 26/(26+10)=72,2 % | 72,2 % (No se presentaron 10) | OK |
| 13.7 | Ocupación de cupo | Σ asignados no cancelados / Σ cupo | 26/91=28,6 % | 28,6 % (antes de finalizar 30,8 %) | OK (obs. H-7) |
| 13.8 | Avistamientos por mes | Evolución | Mes a mes y promedio | Cuadra con altas, atenciones y bajas hechas (Nov: 1 pendiente, 1 atendido, 0 días) | OK |
| 13.9 | Inicio: indicadores | Vecinos activos 28, animales 51, pendientes 3 | Coherentes con la prueba | 28 (29−1 baja lógica), 51 (50+1), 3 avistamientos pendientes, 2 insumos bajo mínimo | OK |

---

## Permisos por rol

| N° | Caso | Esperado | Obtenido | Resultado |
|---|---|---|---|---|
| P.1 | Menú del administrador | Todos los módulos + Usuarios | Inicio, Turnos, Notificaciones, Vecinos, Animales, Historial, Avistamientos, Operativos, Insumos, Personal, Zonas, Reportes, Usuarios | OK |
| P.2 | Menú del operador | Sin Usuarios ni Procedimientos | Sin ambos | OK |
| P.3 | Menú del veterinario | Sin Notificaciones, Reportes ni Usuarios; con Procedimientos | Inicio, Turnos, Procedimientos, Vecinos, Animales, Historial, Avistamientos, Operativos, Insumos, Personal, Zonas | OK |
| P.4 | Operador a /usuarios y /procedimientos | Redirige | Ambos a /dashboard; `/api/usuarios` → 403 (fetch) | OK |
| P.5 | Veterinaria a /reportes, /usuarios y /notificaciones | Redirige | Los tres a /dashboard; `/api/notificaciones` → 403 (fetch) | OK |
| P.6 | Veterinaria solo lectura en Vecinos y Avistamientos | Sin altas/ediciones | Sin botones de acción | OK |
| P.7 | Operador sin gestión de Personal/Zonas | Solo consulta | Sin botones | OK |
| P.8 | Operador sin «Cancelar operativo» en el listado | Solo administrador cancela | El listado solo ofrece Ver detalle/Editar; no se abrió el detalle como operador | NO EJECUTADO (detalle) |

## Transversal: modo oscuro, móvil, consola, usabilidad

| N° | Caso | Esperado | Obtenido | Resultado |
|---|---|---|---|---|
| T.1 | Oscuro: Inicio | Legible | Texto, tarjetas, estados y tablas legibles | OK |
| T.2 | Oscuro: Reportes | Ejes, leyendas, tablas legibles | Gráficos y tablas legibles; en la tabla de ocupación la última columna queda cortada por el borde con barra de desplazamiento a esa anchura | OK (obs. H-9) |
| T.3 | Oscuro: listado y formulario | Legible | Listados y diálogos legibles (capturas de Turnos y Nuevo turno en oscuro) | OK |
| T.4 | Móvil 390×844: Inicio | Sin desborde de página | `scrollWidth` 390; menú hamburguesa; tablas con desplazamiento propio | OK |
| T.5 | Móvil: formulario (Nuevo vecino) | Usable | Formulario de una columna, botones a todo el ancho | OK |
| T.6 | Móvil: Reportes y listado Vecinos | Sin desborde | `scrollWidth` 390 en ambos | OK |
| T.7 | Consola | Sin errores | `list_console_messages` (errores/avisos) sin mensajes en Reportes móvil. No se auditó la consola en cada pantalla | OK (alcance parcial) |
| T.8 | Títulos de pestaña | «Vecinos · SIGCAN», etc. | Verificados en todas las pantallas visitadas | OK |
| T.9 | Diálogos de error de servidor | Mensaje visible | Los errores de negocio aparecen en un aviso emergente que desaparece en pocos segundos; el diálogo queda abierto | OK |

---

## Hallazgos

### H-1 (media) — La tabla de turnos del detalle de operativo no se actualiza tras Cancelar/Finalizar
- **Pasos:** Administrador > Operativos > abrir uno con turnos confirmados > Cancelar (con motivo) o Finalizar.
- **Esperado:** la tabla de turnos pasa a «Cancelado» al instante.
- **Obtenido:** la cabecera cambia (Cancelado/Realizado, cupo), pero los turnos siguen «Confirmado» hasta recargar la página. La base de datos sí es correcta (verificado por SQL). Puede hacer creer al usuario que la cascada falló.
- **Archivo probable:** `src/components/operativos/detalle-operativo.tsx` (`mutate()` del operativo no revalida el SWR propio de `ListadoTurnos`, `src/components/turnos/listado-turnos.tsx`).

### H-2 (baja) — Texto de ingreso menciona "perros y gatos"
- **Obtenido:** la pantalla de Ingreso dice «…castración y chipeo de perros y gatos…»; el proyecto (Fase 1) trata solo canes.
- **Archivo:** `src/app/(auth)/login/page.tsx` línea 48.

### H-3 (baja) — Mensaje de envío automático inexacto sin SMTP
- **Obtenido:** Notificaciones dice «Las pendientes se envían automáticamente cada minuto», pero sin SMTP el procesador no arranca y pasaron más de 10 minutos con notificaciones «pendiente». Además, la «Confirmación» pendiente de un turno ya cancelado sigue en cola y se enviaría después de la cancelación.
- **Archivos:** `src/lib/procesador-notificaciones.ts`, texto en la pantalla de Notificaciones.

### H-4 (baja) — El motivo de cancelación de un turno no se ve en la interfaz
- **Obtenido:** en Turnos y en el detalle del operativo los turnos cancelados muestran solo «Cancelado»; el motivo («Baja del vecino», «No se presentó», etc.) solo existe en la base de datos. Dificulta explicar al docente la trazabilidad.

### H-5 (media para la entrega) — Fase 1 declara 14 funcionalidades; el sistema implementa 13
- **Obtenido:** `docs/Fase1_corregido_final.docx` incluye F14 «Gestionar Voluntarios» y dice «14 funcionalidades»; Fase 2 §8 afirma que se quitó del alcance. No hay F14 en el sistema. Conviene alinear los documentos antes de la entrega.

### H-6 (baja) — Filtro «Chipeo» del Historial excluye «Castración y chipeo»
- **Obtenido:** filtrar por Chipeo no muestra los procedimientos combinados, aunque incluyen un chipeo (Reportes sí los suma a ambos). Aclarar con una etiqueta o incluirlos.

### H-7 (baja) — Matices en indicadores de Reportes
- «Cumplimiento» solo cuenta operativos con fecha ya pasada: el operativo de hoy, recién finalizado («Realizado»), no entra hasta mañana.
- «Ocupación» cuenta solo turnos no cancelados: al finalizar un operativo, los «No se presentó» dejan de contarse y la ocupación de esa jornada baja (el operativo de hoy pasó de 4/15 a 2/15). Puede sorprender; es coherente con la definición mostrada pero conviene explicarlo.

### H-8 (baja) — Listas desplegables ofrecen opciones que luego se rechazan
- Nuevo turno lista animales que ya tienen un turno pendiente/confirmado (se rechaza al guardar), y el selector de personal del operativo sigue ofreciendo al personal ya asignado. Filtrarlos evitaría errores de usuario.

### H-9 (baja) — Tablas con la última columna cortada a ancho de escritorio
- En Reportes (tabla «Ocupación de cupo por operativo») a 1905 px la columna «Ocupación» queda cortada con barra horizontal; en Inicio, «Próximos operativos con cupo» muestra una barra horizontal a 1920 px.


---

## Resumen

Conteo de casos por tabla de resultados (cada fila numerada de F1–F13, Permisos y Transversal):

| Casos totales | OK | Fallas | NO EJECUTADO |
|---|---|---|---|
| 145 | 137 | 1 | 7 |

Las observaciones marcadas «OK (obs. H-n)» pasan el caso pero tienen una mejora anotada. Fallas: 1 (H-1). Hallazgos totales: 9 (1 media funcional, 1 media documental, 7 bajas).

## No ejecutado / no determinado
- Envío real de correo (F12.9): requiere SMTP.
- Filtros del listado de Notificaciones (F12.8), filtro Condición de Animales (2.11), edición y filtros de Personal (5.7), ingreso manual y edición de insumos (6.8), vista de historial por animal (8.5), detalle de operativo como operador (P.8).
- F14 Voluntarios: no existe en el sistema (ver H-5).
- Consola del navegador: solo se auditó en Reportes móvil, no en cada pantalla.
- No se ejercitó la pantalla con el rol «vecino» (no existe como usuario del sistema; Fase 1 menciona que el vecino consulta el historial de su mascota, pero la aplicación es de uso exclusivo del personal).

## Correcciones posteriores (17/11/2026)

Aplicadas por el supervisor tras la prueba. Verificación: `tsc` 0 errores, lint 0 errores (1 advertencia previa aceptada), 160/160 tests (2 nuevos), `next build` OK.

| Hallazgo | Estado | Corrección | Verificación |
|---|---|---|---|
| H-1 | Corregido | `detalle-operativo.tsx`: al finalizar o cancelar, se recargan el operativo y todos los listados de turnos en caché. | Por UI: operativo de hoy iniciado y finalizado; los 5 turnos pasaron a «Cancelado» sin recargar. |
| H-2 | Corregido | Texto del ingreso: «chipeo de perros». | Revisión del texto. |
| H-3 | Corregido | Notificaciones informa si el envío automático está activo (SMTP configurado) o no. Al cancelar, reprogramar o completar un turno se anulan todos sus avisos pendientes (`anularAvisosPendientes`), no solo el recordatorio. | Tests de turnos y operativos actualizados a la nueva regla. |
| H-4 | Sin cambio | Decisión: el motivo queda registrado en la base y en el aviso al vecino. | — |
| H-5 | Pendiente (equipo) | Alinear el documento de Fase 1 con el alcance de 13 funcionalidades. | — |
| H-6 | Corregido | Filtrar por «Castración» o «Chipeo» incluye «Castración y chipeo» (`tiposQueIncluyen`). | Test nuevo en `historial.test.ts`. |
| H-7 | Sin cambio | Comportamiento conforme a la regla de cumplimiento de Fase 2 (operativos con fecha ya pasada). | — |
| H-8 | Corregido | El formulario de turno no ofrece animales con turno activo ni ya castrados y chipeados; el de personal no ofrece a quien ya está asignado. | Test nuevo en `operativos.test.ts`; por UI, el desplegable de personal del operativo de hoy solo ofrece a Martín Sosa. |
| H-9 | Corregido | Columna «Lugar» (con la zona, en Reportes) puede ocupar dos líneas. | Por UI a 1440 px: todas las tablas de Inicio y Reportes entran en su tarjeta. |

## Casos pendientes ejecutados (17/11/2026)

Ejecutados por interfaz en Chrome (Chrome DevTools MCP) sobre el servidor de producción http://localhost:3107 (base de test con datos de demostración, tras una prueba de humo previa). Sin cambios de código, `.env` ni git. Los filtros y selectores se accionaron por la interfaz; en varios casos se usó `evaluate_script` para disparar el cambio del control y leer las filas resultantes (se contrastó con la API de solo lectura cuando hizo falta). Se creó y eliminó un registro temporal de Personal («Temporal, Prueba») para poder probar el filtro Inactivos; se registraron movimientos de stock en «Gasas estériles» (15 → 25 → 19) y se editó su stock mínimo (20 → 15), y se cambió teléfono/especialidad de «Díaz, Carla».

| N° | Regla / caso | Pasos | Esperado | Obtenido | Resultado |
|---|---|---|---|---|---|
| 12.8 | Filtros del listado de Notificaciones (administrador) | Notificaciones (2 registros: Recordatorio 21/11 y Confirmación 17/11, ambos Pendiente). Tipo: Recordatorio / Cancelación; Estado: Enviado / Pendiente; buscar «zzzz» y «mepotdf»; rango «Desde/Hasta» 20/11, 18/11, 17–17, 21–21, 25–26 y 22/11 > 20/11; limpiar | Cada filtro devuelve solo filas que lo cumplen; al limpiar vuelven las 2 | Recordatorio = 1 (el de 21/11); Cancelación = 0; Enviado = 0; Pendiente = 2; «zzzz» = 0; «mepotdf» = 2; Desde 20/11 = 1 (21/11); 17–17 = solo la Confirmación; 21–21 = solo el Recordatorio; 25–26 = 0; limpiar = 2 registros | OK (obs.: con «Desde» posterior a «Hasta» muestra 0 resultados sin aviso, a diferencia de Reportes) |
| 2.11 | Filtro «Condición» en Animales | Animales (50 registros) > Condición: Con tutor / Callejero / Asilvestrado / Todas | Solo la condición elegida; 40+5+5 = 50 | Con tutor = 40 (4 páginas, todas «Con tutor»); Callejero = 5; Asilvestrado = 5; «Todas» = 50 | OK |
| 5.7 | Edición y filtros de Personal | Filtros Tipo (Veterinario/Auxiliar), Estado (Activos/Inactivos/Todos), búsqueda («MV-13», «ríos», «rios», «zzz»). Editar a Carla Díaz: teléfono, especialidad y desmarcar Activo; luego reactivar y guardar. Alta temporal de auxiliar, desactivarlo por edición, probar Inactivos | Filtros correctos; edición persiste; no se desactiva personal asignado a operativo programado | Veterinario = 2, Auxiliar = 1, Activos = 3, Todos = 3 (luego 4); búsqueda por matrícula y apellido (con y sin tilde) correcta; «zzz» = 0. Desactivar a Carla (asignada al operativo del 22/11): «No se puede dar de baja: el integrante está asignado a un operativo programado o en curso». Teléfono 2964409999 y especialidad «Logística» guardados («Personal actualizado», confirmado por API). El auxiliar temporal sin asignaciones pasó a Inactivo; Inactivos = 1, Todos = 4, Auxiliar + Inactivos = 1; al limpiar vuelven los 3 activos. El temporal se eliminó al terminar | OK |
| 6.8 | Ingreso manual posterior y edición de insumos | Insumo «Gasas estériles» (stock 15, mín. 20, «Bajo mínimo») > Registrar movimiento: Ingreso 0, Ingreso -5, Egreso 100, Ingreso 10, Egreso 6. Editar insumo: nombre vacío, mínimo -1, nombre «Ketamina» (duplicado), mínimo 15 | Cantidad ≤ 0 y egreso > stock rechazados; movimientos válidos actualizan stock; edición validada | Cantidad 0: «Debe ser mayor a 0» (y «Este campo es obligatorio» en Motivo: el motivo es obligatorio en movimientos manuales); -5: «Debe ser mayor a 0»; Egreso 100: «Stock insuficiente de Gasas estériles: disponible 15,00 paquetes, requerido 100,00 paquetes» (nada cambió). Ingreso 10 → stock 25,00 y estado «Normal»; Egreso 6 → 19,00 y «Bajo mínimo»; los 3 movimientos figuran con motivo, origen «Manual» y usuario. Edición: «Este campo es obligatorio» (nombre), «No puede ser negativo» (mínimo), «Ya existe un insumo con ese nombre»; mínimo 15 guardado: estado «Normal», stock sin cambios (19,00) y el filtro «Bajo mínimo» queda vacío | OK |
| 8.5 | Historial completo de un animal (`/historial?animal=`) | Enlaces «Ver historial clínico» de Animales (`?animal=id`). Abrir animal 44 (Canela, callejera), 21 (Duque, con tutor), 39 (Toby, sin procedimientos, con tutor), 50 (sin procedimientos, sin nombre), 99999 (inexistente); filtro de tipo y «Ver todos» | Solo los procedimientos de ese animal, con encabezado (nombre, chip, tutor); sin procedimientos: vacío | Animal 44: «Historial clínico de Canela», chip 985141000000016, sin tutor, 1 registro (no mezcla con otra «Canela» de otro id). Animal 21: «Duque», chip 985141919626561, tutor Acosta, Carolina; los filtros Castración/Chipeo/Castración y chipeo mantienen el registro (combinado, regla H-6) y `?animal=21` se conserva. Toby: encabezado correcto y «No hay procedimientos registrados». «Ver todos» enlaza a `/historial`. La API confirma 1 procedimiento por animal. Animal inexistente: sin error, lista general vacía | OK (obs. 1 y 2 abajo) |
| P.8 | Detalle de un operativo visto como operador | Ingresar como operador (Laura Gómez) > Operativos > detalle del 22/11 (programado, 4 turnos) y del 17/11 (realizado); comparar con la vista del administrador; `POST /api/operativos/13/cancelar` con fetch (cuerpo vacío, solo para ver el código) | Ve el detalle y gestiona (editar, iniciar, personal, turnos) pero no cancela el operativo (permiso `operativos:cancelar` es solo de administrador) | Operador (programado): Volver, Editar, Iniciar, Quitar/Asignar personal, Nuevo turno y por turno Confirmar/Reprogramar/Cancelar turno; **sin** botón «Cancelar» de operativo (el administrador sí lo ve). Realizado: solo «Volver» y tabla, sin acciones. API de cancelación como operador: 403 «No tiene permisos para realizar esta acción» | OK |

### Observaciones de los casos pendientes
- **Obs. 1 (baja) — Historial por animal, animal sin procedimientos ni nombre.** `/historial?animal=50` (animal «Sin nombre», asilvestrado): el título dice «Historial clínico de Animal #50» y «Chip: sin chip · Tutor: sin tutor». Es correcto para ese animal, pero el título cae a «Animal #n» porque el nombre/chip/tutor parecen derivarse de los procedimientos o del nombre vacío; conviene verificar que un animal con chip y sin procedimientos muestre su chip (Toby con tutor sí mostró su tutor).
- **Obs. 2 (baja) — Animal inexistente.** `/historial?animal=99999` no avisa que el animal no existe: muestra el listado general vacío con el texto «Elija un animal…». Sin error.
- **Obs. 3 (baja) — Rango de fechas invertido en Notificaciones.** Con «Desde» 22/11 y «Hasta» 20/11 el listado queda vacío sin ningún aviso (en Reportes sí se avisa el rango inválido).
- **Consola:** durante estos casos solo apareció un error 403 (Forbidden), provocado a propósito con el `fetch` de cancelación como operador. No se detectaron otros errores ni avisos en las últimas pantallas visitadas (Operativos detalle como operador); la consola no se auditó pantalla por pantalla en el resto.
- **Defectos:** ninguno nuevo en estos 6 casos. Los 6 casos pasan (OK), con 3 observaciones menores.

### Corrección de las observaciones (17/11/2026)

| Obs. | Cambio | Verificación |
|---|---|---|
| 1 | El listado de Animales usa el mismo nombre visible que el resto del sistema (`nombreAnimal`): un animal sin nombre figura como «Animal #N» en Animales, Historial, Turnos y Notificaciones. | Navegador (desarrollo, demo): los animales 46 a 50 se muestran como «Animal #46»…«Animal #50». |
| 2 | Historial con `?animal=` de un animal inexistente muestra «Animal no encontrado · El animal no existe» con el botón «Ver todos»; un id mal formado (`?animal=abc`) muestra la página 404. | Navegador (producción): `?animal=99999` y `?animal=abc`. |
| 3 | Aviso reutilizable de rango invertido (`avisoRangoFechas` en `lib/fechas.ts` y propiedad `aviso` de `ListadoPaginado`) en Notificaciones, Historial y Avistamientos; Reportes usa el mismo texto. | Test unitario nuevo (161/161); navegador (producción): Notificaciones con «Desde» 22/11 y «Hasta» 20/11 muestra el aviso y desaparece al corregir el rango. |
