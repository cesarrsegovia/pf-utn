/**
 * Prueba de humo de la Fase 5 contra el servidor de producción (`next start`).
 * Verifica F9 (alta, validaciones, filtros y atención de avistamientos), F13 (indicadores,
 * filtro de zona y validación del rango), el dashboard por rol y los permisos (401/403).
 * Uso (desde la raíz del proyecto): node tests/humo/fase5.mjs [url-base]
 * Resultado esperado: "Prueba de humo de la Fase 5: OK (28 verificaciones)".
 */
try {
  process.loadEnvFile(".env");
} catch {
  // Sin .env se usan los valores por defecto de .env.example.
}

const BASE = process.argv[2] ?? "http://localhost:3107";
/** Cookie de sesión por usuario: se prueban dos roles a la vez. */
const cookies = { admin: "", vet: "" };
/** Cantidad de verificaciones superadas (lección L6: se reporta el número exacto). */
let verificaciones = 0;

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

/** Corta la prueba con el detalle si una verificación falla; si pasa, la cuenta. */
function verificar(paso, condicion, detalle) {
  if (!condicion) {
    console.error(`✗ ${paso}`, detalle === undefined ? "" : JSON.stringify(detalle));
    process.exit(1);
  }
  verificaciones += 1;
  console.log(`✓ ${paso}`);
}

/** Fecha local de Río Grande (UTC−3) desplazada `dias` días, en formato YYYY-MM-DD. */
const fechaLocal = (dias = 0) => new Date(Date.now() - 3 * 3_600_000 + dias * 86_400_000).toISOString().slice(0, 10);
const hoy = fechaLocal();
const mesActual = hoy.slice(0, 7);
const sufijo = String(Date.now()).slice(-7);
const passwordVet = "Clave1234";

// 1) Administrador y zonas
let r = await llamar("admin", "POST", "/api/auth/login", {
  email: process.env.SEED_ADMIN_EMAIL ?? "admin@sigcan.local",
  password: process.env.SEED_ADMIN_PASSWORD ?? "Admin1234",
});
verificar("login del administrador", r.estado === 200, r);
r = await llamar("admin", "GET", "/api/zonas/opciones");
const [zonaA, zonaB] = r.datos;

// 2) Avistamientos: alta, validaciones y listado
const reporte = {
  fecha: hoy, hora: "00:00", descripcion: `Humo 5 ${sufijo}: perros sueltos`, cantidad_animales: 4,
  direccion_referencia: "", zona_id: zonaA.id, vecino_id: null,
};
r = await llamar("admin", "POST", "/api/avistamientos", reporte);
verificar("alta de avistamiento pendiente (201)", r.estado === 201 && r.datos.estado === "pendiente", r);
const reporteId = r.datos.id;
r = await llamar("admin", "POST", "/api/avistamientos", { ...reporte, fecha: fechaLocal(1) });
verificar("fecha futura → 400 en el campo", r.estado === 400 && r.datos.error.campos?.fecha, r);
r = await llamar("admin", "POST", "/api/avistamientos", { ...reporte, cantidad_animales: 0 });
verificar("cantidad 0 → 400 en el campo", r.estado === 400 && r.datos.error.campos?.cantidad_animales, r);
r = await llamar("admin", "GET", `/api/avistamientos?estado=pendiente&busqueda=${encodeURIComponent(`Humo 5 ${sufijo}`)}`);
verificar("el reporte figura entre los pendientes", r.datos.filas.some((f) => f.id === reporteId), r);

// 3) Atención con operativo de la misma zona
const operativo = { fecha: fechaLocal(7), hora_inicio: "09:00", hora_fin: "13:00", lugar: "SUM humo 5", cupo_maximo: 10 };
r = await llamar("admin", "POST", "/api/operativos", { ...operativo, zona_id: zonaA.id });
verificar("alta de operativo en la zona del reporte", r.estado === 201, r);
const operativoA = r.datos.id;
r = await llamar("admin", "POST", "/api/operativos", { ...operativo, zona_id: zonaB.id });
verificar("alta de operativo en otra zona", r.estado === 201, r);
const operativoB = r.datos.id;
r = await llamar("admin", "GET", `/api/avistamientos/operativos?zona_id=${zonaA.id}`);
verificar(
  "opciones de atención: solo operativos de la zona",
  r.datos.some((o) => o.id === operativoA) && !r.datos.some((o) => o.id === operativoB),
  r,
);
r = await llamar("admin", "POST", `/api/avistamientos/${reporteId}/atender`, { operativo_id: operativoB });
verificar("operativo de otra zona → 400", r.estado === 400 && r.datos.error.campos?.operativo_id, r);
r = await llamar("admin", "POST", `/api/avistamientos/${reporteId}/atender`, { operativo_id: operativoA });
verificar("atención del reporte (200)", r.estado === 200 && r.datos.estado === "atendido" && r.datos.operativo_id === operativoA, r);
r = await llamar("admin", "PUT", `/api/avistamientos/${reporteId}`, reporte);
verificar("un reporte atendido no se edita → 409", r.estado === 409, r);
r = await llamar("admin", "DELETE", `/api/avistamientos/${reporteId}`);
verificar("un reporte atendido no se elimina → 409", r.estado === 409, r);

// 4) Reportes estadísticos
const periodo = `desde=${mesActual}-01&hasta=${fechaLocal(30)}`;
r = await llamar("admin", "GET", `/api/reportes?${periodo}`);
verificar(
  "reportes: el mes actual cuenta el avistamiento atendido",
  r.estado === 200 && r.datos.avistamientos.meses.find((m) => m.mes === mesActual)?.atendidos >= 1,
  r.estado,
);
verificar(
  "reportes: ocupación del operativo nuevo en 0 %",
  r.datos.ocupacion.operativos.some((o) => o.id === operativoA && o.asignados === 0 && o.porcentaje === 0),
  r.datos.ocupacion,
);
r = await llamar("admin", "GET", `/api/reportes?${periodo}&zona_id=${zonaB.id}`);
verificar(
  "reportes: el filtro de zona deja solo esa zona",
  r.estado === 200 && r.datos.ocupacion.operativos.every((o) => o.zona === zonaB.etiqueta),
  r.datos?.ocupacion,
);
r = await llamar("admin", "GET", `/api/reportes?desde=${hoy}&hasta=${fechaLocal(-1)}`);
verificar("rango invertido → 400", r.estado === 400, r);

// 5) Dashboard del administrador
r = await llamar("admin", "GET", "/api/dashboard");
verificar(
  "dashboard general con totales",
  r.estado === 200 && r.datos.tipo === "general" && Number.isInteger(r.datos.totales.animales),
  r,
);

// 6) Veterinario sin vínculo con el personal: permisos y dashboard propio
const emailVet = `humo5.vet.${sufijo}@prueba.local`;
r = await llamar("admin", "POST", "/api/usuarios", {
  nombre: "Vito", apellido: "Humo", email: emailVet, rol: "veterinario", activo: true, password: passwordVet,
});
verificar("alta de usuario veterinario", r.estado === 201, r);
r = await llamar("vet", "POST", "/api/auth/login", { email: emailVet, password: passwordVet });
verificar("login del veterinario", r.estado === 200, r);
r = await llamar("vet", "GET", "/api/dashboard");
verificar(
  "dashboard del veterinario con aviso de vínculo",
  r.datos.tipo === "veterinario" && r.datos.motivo?.includes("no está vinculado"),
  r,
);
r = await llamar("vet", "GET", "/api/avistamientos");
verificar("el veterinario consulta avistamientos (200)", r.estado === 200, r.estado);
r = await llamar("vet", "POST", "/api/avistamientos", reporte);
verificar("el veterinario no carga avistamientos → 403", r.estado === 403, r);
r = await llamar("vet", "GET", `/api/reportes?${periodo}`);
verificar("el veterinario no ve reportes → 403", r.estado === 403, r);
r = await llamar(null, "GET", `/api/reportes?${periodo}`);
verificar("reportes sin sesión → 401", r.estado === 401, r);

// 7) Páginas
for (const pagina of ["/dashboard", "/avistamientos", "/reportes"]) {
  r = await llamar("admin", "GET", pagina);
  verificar(`GET ${pagina} (administrador) → 200`, r.estado === 200, r.estado);
}
r = await llamar("vet", "GET", "/dashboard");
verificar("GET /dashboard (veterinario) → 200", r.estado === 200, r.estado);

console.log(`\nPrueba de humo de la Fase 5: OK (${verificaciones} verificaciones)`);
