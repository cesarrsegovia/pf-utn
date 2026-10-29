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
// Con loading.tsx la página se transmite por streaming: Next ya envió el 200 cuando se ejecuta redirect(),
// así que la redirección llega como marca NEXT_REDIRECT (y meta refresh) en el cuerpo, no como un 307.
verificar(
  "la veterinaria no accede a /reportes (redirige a /dashboard)",
  r.estado === 307 || (r.estado === 200 && r.texto.includes("NEXT_REDIRECT;replace;/dashboard;307")),
  r.estado,
);

console.log(`\nPrueba de humo de la Fase 6: OK (${verificaciones} verificaciones)`);
