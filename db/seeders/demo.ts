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
