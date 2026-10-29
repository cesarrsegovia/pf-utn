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
