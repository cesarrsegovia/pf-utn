import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { MOTIVOS_CANCELACION, type EstadoOperativo, type EstadoTurno, type TipoProcedimiento } from "@/lib/constantes";
import { sequelize } from "@/lib/db";
import { hoyLocal, instanteLocal, mesesDelRango, sumarDias } from "@/lib/fechas";
import { generarReportes } from "@/services/reportes";
import { reiniciarDatos } from "../helpers/bd";
import {
  adminSemilla, crearAnimalPrueba, crearAvistamientoPrueba, crearOperativoPrueba, crearPersonalPrueba,
  crearProcedimientoPrueba, crearTurnoPrueba, zonaSemilla,
} from "../helpers/fabricas";

beforeEach(reiniciarDatos);
afterAll(() => sequelize.close());

/** Período amplio que contiene todos los datos de prueba (30 días hacia atrás y hacia adelante). */
const periodo = () => ({ desde: sumarDias(hoyLocal(), -30), hasta: sumarDias(hoyLocal(), 30) });

/** Instante local a las 10:00 del día indicado (relativo a hoy). */
const alasDiez = (dias: number) => instanteLocal(sumarDias(hoyLocal(), dias), "10:00");

/**
 * Operativo en el estado indicado. Los cancelados se crean programados y se cancelan con los
 * datos que exige ck_operativo_cancelacion (motivo, fecha y usuario).
 */
async function operativo(dias: number, estado: EstadoOperativo, zonaId: number) {
  if (estado !== "cancelado") return crearOperativoPrueba({ diasDesdeHoy: dias, estado, zonaId });
  const creado = await crearOperativoPrueba({ diasDesdeHoy: dias, zonaId });
  const admin = await adminSemilla();
  return creado.update({
    estado, motivo_cancelacion: "Lluvia", fecha_cancelacion: new Date(), usuario_cancelacion_id: admin.id,
  });
}

/** Turno de un animal nuevo; los cancelados llevan el motivo indicado. */
async function turno(operativoId: number, estado: EstadoTurno, motivo?: string) {
  const creado = await crearTurnoPrueba((await crearAnimalPrueba()).id, operativoId, estado);
  if (motivo) await creado.update({ motivo_cancelacion: motivo });
  return creado;
}

/**
 * Escenario controlado en dos zonas (Centro y Austral):
 * - Centro: A1 realizado (hace 10 días) con 2 completados, 1 "No se presentó" y 1 cancelado por otro motivo;
 *   A2 cancelado (hace 5 días); A3 programado sin cerrar (hace 2 días, sin turnos);
 *   A4 programado futuro (en 5 días) con 1 pendiente; A5 cancelado futuro (en 6 días).
 * - Austral: B1 realizado (hace 3 días) con 1 completado.
 * - Procedimientos: en A1 castración y chipeo + castración; en B1 chipeo.
 */
async function escenario() {
  const centro = await zonaSemilla();
  const austral = await zonaSemilla("Austral");
  const a1 = await operativo(-10, "realizado", centro.id);
  await operativo(-5, "cancelado", centro.id);
  await operativo(-2, "programado", centro.id);
  const a4 = await operativo(5, "programado", centro.id);
  await operativo(6, "cancelado", centro.id);
  const b1 = await operativo(-3, "realizado", austral.id);

  const veterinario = await crearPersonalPrueba();
  const procedimiento = (turnoId: number, tipo: TipoProcedimiento, dias: number) =>
    crearProcedimientoPrueba(turnoId, veterinario.id, { tipo, fecha: alasDiez(dias) });

  await procedimiento((await turno(a1.id, "completado")).id, "castracion_y_chipeo", -10);
  await procedimiento((await turno(a1.id, "completado")).id, "castracion", -10);
  await turno(a1.id, "cancelado", MOTIVOS_CANCELACION.noSePresento);
  await turno(a1.id, "cancelado");
  await turno(a4.id, "pendiente");
  await procedimiento((await turno(b1.id, "completado")).id, "chipeo", -3);
  return { centro, austral, a1, b1, a4 };
}

describe("reportes estadísticos (F13)", () => {
  it("cuenta castraciones y chipeos por zona; castración y chipeo suma a ambos", async () => {
    const { centro, austral } = await escenario();
    const { procedimientos } = await generarReportes(periodo());
    expect(procedimientos).toEqual([
      { zona_id: austral.id, zona: "Austral", castraciones: 0, chipeos: 1 },
      { zona_id: centro.id, zona: "Centro", castraciones: 2, chipeos: 1 },
    ]);
    // Desde hace 2 días ya no entra ningún procedimiento (fueron hace 10 y 3 días).
    const recientes = await generarReportes({ desde: sumarDias(hoyLocal(), -2), hasta: hoyLocal() });
    expect(recientes.procedimientos).toEqual([]);
  });

  it("calcula el cumplimiento solo sobre operativos de fecha pasada", async () => {
    const { austral } = await escenario();
    // Pasados: A1 y B1 realizados, A2 cancelado, A3 sin cerrar. A4 y A5 son futuros.
    const { cumplimiento } = await generarReportes(periodo());
    expect(cumplimiento).toEqual({ realizados: 2, cancelados: 1, sin_cerrar: 1, porcentaje: 66.7 });
    const soloAustral = await generarReportes({ ...periodo(), zona_id: austral.id });
    expect(soloAustral.cumplimiento).toEqual({ realizados: 1, cancelados: 0, sin_cerrar: 0, porcentaje: 100 });
  });

  it("calcula la ocupación de cupo por operativo no cancelado y la total", async () => {
    const { a1, b1, a4 } = await escenario();
    const { ocupacion } = await generarReportes(periodo());
    // Cupo 20 en todos: A1 tiene 2 asignados (los cancelados no ocupan), B1 1, A3 0 y A4 1.
    expect(ocupacion.operativos.map((o) => [o.id, o.asignados, o.porcentaje])).toEqual([
      [a1.id, 2, 10],
      [b1.id, 1, 5],
      [expect.any(Number), 0, 0],
      [a4.id, 1, 5],
    ]);
    expect(ocupacion.operativos[0]).toMatchObject({ fecha: sumarDias(hoyLocal(), -10), zona: "Centro", cupo_maximo: 20 });
    expect(ocupacion.porcentaje).toBe(5); // 4 asignados / 80 lugares
  });

  it("calcula la asistencia: completados / (completados + No se presentó)", async () => {
    const { centro } = await escenario();
    const { asistencia } = await generarReportes(periodo());
    expect(asistencia).toEqual({ completados: 3, ausentes: 1, porcentaje: 75 });
    const soloCentro = await generarReportes({ ...periodo(), zona_id: centro.id });
    expect(soloCentro.asistencia).toEqual({ completados: 2, ausentes: 1, porcentaje: 66.7 });
  });

  it("arma la evolución mensual de avistamientos y el tiempo promedio de atención", async () => {
    const admin = await adminSemilla();
    const centro = await zonaSemilla();
    const austral = await zonaSemilla("Austral");
    await crearAvistamientoPrueba(admin.id, { zonaId: centro.id, fecha: alasDiez(-20) });
    await crearAvistamientoPrueba(admin.id, {
      zonaId: centro.id, fecha: alasDiez(-20), estado: "atendido", fechaAtencion: alasDiez(-18),
    });
    await crearAvistamientoPrueba(admin.id, {
      zonaId: austral.id, fecha: alasDiez(-5), estado: "atendido", fechaAtencion: alasDiez(-1),
    });

    const { avistamientos } = await generarReportes(periodo());
    // Un elemento por cada mes del período, aunque no tenga reportes.
    expect(avistamientos.meses.map((m) => m.mes)).toEqual(mesesDelRango(periodo().desde, periodo().hasta));
    const suma = (clave: "pendientes" | "atendidos") => avistamientos.meses.reduce((t, m) => t + m[clave], 0);
    expect(suma("pendientes")).toBe(1);
    expect(suma("atendidos")).toBe(2);
    const mesDelPrimero = avistamientos.meses.find((m) => m.mes === sumarDias(hoyLocal(), -20).slice(0, 7))!;
    expect(mesDelPrimero.pendientes).toBe(1);
    expect(avistamientos.promedio_dias).toBe(3); // (2 + 4) / 2

    const soloAustral = await generarReportes({ ...periodo(), zona_id: austral.id });
    expect(soloAustral.avistamientos.promedio_dias).toBe(4);
  });

  it("sin datos devuelve listas vacías, ceros y porcentajes nulos", async () => {
    const reporte = await generarReportes(periodo());
    expect(reporte.procedimientos).toEqual([]);
    expect(reporte.cumplimiento).toEqual({ realizados: 0, cancelados: 0, sin_cerrar: 0, porcentaje: null });
    expect(reporte.ocupacion).toEqual({ operativos: [], porcentaje: null });
    expect(reporte.asistencia).toEqual({ completados: 0, ausentes: 0, porcentaje: null });
    expect(reporte.avistamientos.meses.every((m) => m.pendientes === 0 && m.atendidos === 0)).toBe(true);
    expect(reporte.avistamientos.promedio_dias).toBeNull();
  });
});
