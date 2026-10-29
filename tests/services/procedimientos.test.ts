import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  Animal, HistorialClinico, Insumo, MovimientoInsumo, Notificacion, OperativoVeterinario, Procedimiento,
  ProcedimientoInsumo, sequelize, Turno,
} from "@/lib/db";
import type { DatosProcedimiento } from "@/schemas/procedimientos";
import { crearInsumo } from "@/services/insumos";
import { registrarProcedimiento, turnosParaAtender } from "@/services/procedimientos";
import { reiniciarDatos } from "../helpers/bd";
import {
  adminSemilla, crearAnimalPrueba, crearNotificacionPrueba, crearOperativoPrueba, crearTurnoPrueba,
  crearUsuarioPrueba, crearVeterinarioConUsuario,
} from "../helpers/fabricas";

beforeEach(reiniciarDatos);
afterEach(() => vi.restoreAllMocks());
afterAll(() => sequelize.close());

const CHIP = "985112003456789";

/**
 * Operativo en curso hoy con un veterinario asignado; turno confirmado de castración y
 * chipeo con un recordatorio pendiente; insumos Ketamina (10 ml) y Sutura (5 u).
 */
async function escenario() {
  const { usuario, personal } = await crearVeterinarioConUsuario();
  const operativo = await crearOperativoPrueba({ diasDesdeHoy: 0, estado: "en_curso" });
  await OperativoVeterinario.create({ operativo_id: operativo.id, veterinario_id: personal.id });
  const animal = await crearAnimalPrueba();
  const turno = await crearTurnoPrueba(animal.id, operativo.id, "confirmado");
  await turno.update({ tipo_solicitado: "castracion_y_chipeo" });
  await crearNotificacionPrueba(turno.id, animal.vecino_id!, {
    tipo: "recordatorio",
    fechaProgramada: new Date(Date.now() + 60 * 60 * 1000),
  });
  const admin = await adminSemilla();
  const ketamina = await crearInsumo({ nombre: "Ketamina", unidad: "ml", stock_minimo: 1, stock_inicial: 10 }, admin.id);
  const sutura = await crearInsumo({ nombre: "Sutura", unidad: "u", stock_minimo: 1, stock_inicial: 5 }, admin.id);
  const datos: DatosProcedimiento = {
    turno_id: turno.id,
    tipo: "castracion_y_chipeo",
    numero_chip_colocado: CHIP,
    observaciones: "Sin complicaciones",
    insumos: [
      { insumo_id: ketamina.id, cantidad: 2.5 },
      { insumo_id: sutura.id, cantidad: 1 },
    ],
  };
  return { usuario, operativo, animal, turno, ketamina, sutura, datos };
}

type Escenario = Awaited<ReturnType<typeof escenario>>;

/** Verifica que no quedó nada persistido del procedimiento (rollback total). */
async function esperarSinCambios({ turno, animal, ketamina, sutura }: Escenario) {
  expect(await Procedimiento.count()).toBe(0);
  expect(await HistorialClinico.count()).toBe(0);
  expect(await ProcedimientoInsumo.count()).toBe(0);
  expect(await MovimientoInsumo.count({ where: { tipo: "egreso" } })).toBe(0);
  expect((await Turno.findByPk(turno.id))!.estado).toBe("confirmado");
  const animalActual = (await Animal.findByPk(animal.id))!;
  expect([animalActual.castrado, animalActual.numero_chip]).toEqual([false, null]);
  expect((await Insumo.findByPk(ketamina.id))!.stock_actual).toBe("10.00");
  expect((await Insumo.findByPk(sutura.id))!.stock_actual).toBe("5.00");
  expect(await Notificacion.count({ where: { tipo: "recordatorio", estado_envio: "pendiente" } })).toBe(1);
}

describe("registro exitoso (F7)", () => {
  it("en una transacción completa el turno, actualiza el animal, descuenta stock y crea el historial", async () => {
    const e = await escenario();
    const resultado = await registrarProcedimiento(e.datos, e.usuario.id);
    expect(resultado).toMatchObject({ turno_id: e.turno.id, tipo: "castracion_y_chipeo", numero_chip_colocado: CHIP });

    expect((await Turno.findByPk(e.turno.id))!.estado).toBe("completado");
    const animal = (await Animal.findByPk(e.animal.id))!;
    expect([animal.castrado, animal.numero_chip]).toEqual([true, CHIP]);
    expect((await Insumo.findByPk(e.ketamina.id))!.stock_actual).toBe("7.50");
    expect((await Insumo.findByPk(e.sutura.id))!.stock_actual).toBe("4.00");

    const egresos = await MovimientoInsumo.findAll({ where: { procedimiento_id: resultado.id }, order: [["insumo_id", "ASC"]] });
    expect(egresos.map((m) => [m.tipo, m.insumo_id, m.cantidad, m.usuario_id])).toEqual([
      ["egreso", e.ketamina.id, "2.50", e.usuario.id],
      ["egreso", e.sutura.id, "1.00", e.usuario.id],
    ]);
    expect(await ProcedimientoInsumo.count({ where: { procedimiento_id: resultado.id } })).toBe(2);

    const historial = (await HistorialClinico.findOne({ where: { procedimiento_id: resultado.id } }))!;
    for (const parte of ["Castración y chipeo", `Chip colocado: ${CHIP}`, "Ketamina 2,50 ml", "Sutura 1,00 u", "Sin complicaciones"]) {
      expect(historial.descripcion).toContain(parte);
    }
    expect(resultado.descripcion).toBe(historial.descripcion);
    expect(await Notificacion.count({ where: { tipo: "recordatorio", estado_envio: "pendiente" } })).toBe(0);
  });

  it("un procedimiento parcial (solo castración) no registra chip ni exige insumos", async () => {
    const e = await escenario();
    const resultado = await registrarProcedimiento(
      { ...e.datos, tipo: "castracion", numero_chip_colocado: "", insumos: [] },
      e.usuario.id,
    );
    expect(resultado.numero_chip_colocado).toBeNull();
    const animal = (await Animal.findByPk(e.animal.id))!;
    expect([animal.castrado, animal.numero_chip]).toEqual([true, null]);
    expect(resultado.descripcion).toContain("Sin insumos registrados");
  });
});

describe("rollback total (F7)", () => {
  it("stock insuficiente en el segundo insumo revierte también el primero", async () => {
    const e = await escenario();
    const datos = { ...e.datos, insumos: [{ insumo_id: e.ketamina.id, cantidad: 2 }, { insumo_id: e.sutura.id, cantidad: 50 }] };
    await expect(registrarProcedimiento(datos, e.usuario.id)).rejects.toThrow(
      "Stock insuficiente de Sutura: disponible 5,00 u, requerido 50,00 u",
    );
    await esperarSinCambios(e);
  });

  it("un chip ya registrado en otro animal revierte todo", async () => {
    const e = await escenario();
    await crearAnimalPrueba({ numeroChip: CHIP });
    await expect(registrarProcedimiento(e.datos, e.usuario.id)).rejects.toMatchObject({
      campos: { numero_chip_colocado: `El chip ${CHIP} ya está registrado` },
    });
    await esperarSinCambios(e);
  });

  it("una falla en el último paso (historial) no deja nada persistido", async () => {
    const e = await escenario();
    vi.spyOn(HistorialClinico, "create").mockRejectedValueOnce(new Error("Falla simulada"));
    await expect(registrarProcedimiento(e.datos, e.usuario.id)).rejects.toThrow("Falla simulada");
    await esperarSinCambios(e);
  });
});

describe("validaciones previas", () => {
  it("exige turno confirmado y operativo en curso", async () => {
    const e = await escenario();
    await e.turno.update({ estado: "pendiente" });
    await expect(registrarProcedimiento(e.datos, e.usuario.id)).rejects.toThrow("El turno debe estar confirmado");
    await e.turno.update({ estado: "confirmado" });
    await e.operativo.update({ estado: "programado" });
    await expect(registrarProcedimiento(e.datos, e.usuario.id)).rejects.toThrow("El operativo debe estar en curso");
  });

  it("solo registra un veterinario activo, con matrícula y asignado al operativo (403)", async () => {
    const e = await escenario();
    const sinPersonal = await crearUsuarioPrueba({ rol: "veterinario" });
    await expect(registrarProcedimiento(e.datos, sinPersonal.id)).rejects.toMatchObject({ estado: 403 });
    await expect(registrarProcedimiento(e.datos, sinPersonal.id)).rejects.toThrow("no está vinculado");

    const auxiliar = await crearVeterinarioConUsuario({ tipo: "auxiliar", matricula: null });
    await OperativoVeterinario.create({ operativo_id: e.operativo.id, veterinario_id: auxiliar.personal.id });
    await expect(registrarProcedimiento(e.datos, auxiliar.usuario.id)).rejects.toThrow(
      "Solo un veterinario con matrícula",
    );

    const noAsignado = await crearVeterinarioConUsuario();
    await expect(registrarProcedimiento(e.datos, noAsignado.usuario.id)).rejects.toThrow(
      "No está asignado a este operativo",
    );
  });

  it("lo realizado debe estar incluido en lo solicitado y no repetir lo ya hecho", async () => {
    const e = await escenario();
    await e.turno.update({ tipo_solicitado: "castracion" });
    await expect(registrarProcedimiento({ ...e.datos, tipo: "chipeo" }, e.usuario.id)).rejects.toThrow(
      "debe estar incluido en lo solicitado (Castración)",
    );

    await e.turno.update({ tipo_solicitado: "castracion_y_chipeo" });
    await e.animal.update({ castrado: true });
    await expect(registrarProcedimiento(e.datos, e.usuario.id)).rejects.toThrow("El animal ya está castrado");
  });
});

describe("turnos para atender", () => {
  it("lista solo los turnos confirmados de operativos en curso donde el veterinario está asignado", async () => {
    const e = await escenario();
    await crearTurnoPrueba((await crearAnimalPrueba()).id, e.operativo.id, "pendiente");
    const ajeno = await crearOperativoPrueba({ diasDesdeHoy: 0, estado: "en_curso" });
    await crearTurnoPrueba((await crearAnimalPrueba()).id, ajeno.id, "confirmado");

    const resultado = await turnosParaAtender(e.usuario.id);
    expect(resultado.habilitado).toBe(true);
    expect(resultado.turnos.map((t) => t.id)).toEqual([e.turno.id]);

    const sinPersonal = await crearUsuarioPrueba({ rol: "veterinario" });
    const bloqueado = await turnosParaAtender(sinPersonal.id);
    expect(bloqueado).toMatchObject({ habilitado: false, turnos: [] });
    expect(bloqueado.motivo).toContain("no está vinculado");
  });
});
