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
