import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Insumo, OperativoVeterinario, sequelize } from "@/lib/db";
import { resumenDashboard } from "@/services/dashboard";
import { reiniciarDatos } from "../helpers/bd";
import {
  adminSemilla, crearAnimalPrueba, crearAvistamientoPrueba, crearOperativoPrueba, crearTurnoPrueba,
  crearUsuarioPrueba, crearVecinoPrueba, crearVeterinarioConUsuario, sesionDe,
} from "../helpers/fabricas";

beforeEach(reiniciarDatos);
afterAll(() => sequelize.close());

describe("dashboard", () => {
  it("muestra totales, operativos con cupo, insumos bajo mínimo y avistamientos pendientes", async () => {
    const admin = await adminSemilla();
    // Totales: 1 vecino activo y 1 inactivo; 3 animales (1 castrado, 1 chipeado).
    const tutor = await crearVecinoPrueba();
    await crearVecinoPrueba({ activo: false });
    await crearAnimalPrueba({ vecinoId: tutor.id });
    const castrado = await crearAnimalPrueba({ vecinoId: null });
    await castrado.update({ castrado: true });
    await crearAnimalPrueba({ vecinoId: null, numeroChip: "985112000000001" });

    // Operativos: uno con cupo, uno lleno (cupo 1 ocupado) y uno pasado: solo aparece el primero.
    const conCupo = await crearOperativoPrueba({ diasDesdeHoy: 3 });
    const lleno = await crearOperativoPrueba({ diasDesdeHoy: 4 });
    await lleno.update({ cupo_maximo: 1 });
    await crearTurnoPrueba((await crearAnimalPrueba()).id, lleno.id);
    await crearOperativoPrueba({ diasDesdeHoy: -1 });

    await Insumo.create({ nombre: "Ketamina", unidad: "ml", stock_actual: "1.00", stock_minimo: "5.00" });
    await Insumo.create({ nombre: "Guantes", unidad: "par", stock_actual: "50.00", stock_minimo: "5.00" });
    await crearAvistamientoPrueba(admin.id);
    await crearAvistamientoPrueba(admin.id, { estado: "atendido" });

    const resumen = await resumenDashboard(sesionDe(admin, "administrador"));
    if (resumen.tipo !== "general") throw new Error("Se esperaba el resumen general");
    // El animal del turno del operativo lleno (y su tutor) también suman: 2 vecinos activos y 4 animales.
    expect(resumen.totales).toEqual({ vecinos_activos: 2, animales: 4, castrados: 1, chipeados: 1 });
    expect(resumen.proximos_operativos.map((o) => o.id)).toEqual([conCupo.id]);
    expect(resumen.insumos_bajo_minimo.total).toBe(1);
    expect(resumen.insumos_bajo_minimo.filas[0].nombre).toBe("Ketamina");
    expect(resumen.avistamientos_pendientes.total).toBe(1);
  });

  it("lista los turnos de hoy: todos para el operador, solo los asignados para el veterinario", async () => {
    const { usuario, personal } = await crearVeterinarioConUsuario();
    const asignado = await crearOperativoPrueba({ diasDesdeHoy: 0 });
    const otro = await crearOperativoPrueba({ diasDesdeHoy: 0 });
    const manana = await crearOperativoPrueba({ diasDesdeHoy: 1 });
    await OperativoVeterinario.create({ operativo_id: asignado.id, veterinario_id: personal.id });
    await OperativoVeterinario.create({ operativo_id: manana.id, veterinario_id: personal.id });

    const propio = await crearTurnoPrueba((await crearAnimalPrueba()).id, asignado.id, "confirmado");
    await crearTurnoPrueba((await crearAnimalPrueba()).id, asignado.id, "cancelado");
    const ajeno = await crearTurnoPrueba((await crearAnimalPrueba()).id, otro.id);
    await crearTurnoPrueba((await crearAnimalPrueba()).id, manana.id, "confirmado");

    const operador = await crearUsuarioPrueba({ rol: "operador" });
    const general = await resumenDashboard(sesionDe(operador, "operador"));
    expect(general.turnos_hoy.map((t) => t.id).sort()).toEqual([propio.id, ajeno.id].sort());

    const veterinario = await resumenDashboard(sesionDe(usuario, "veterinario"));
    expect(veterinario).toMatchObject({ tipo: "veterinario", motivo: null });
    expect(veterinario.turnos_hoy.map((t) => t.id)).toEqual([propio.id]);
  });

  it("avisa al veterinario sin vínculo con el personal", async () => {
    const usuario = await crearUsuarioPrueba({ rol: "veterinario" });
    const resumen = await resumenDashboard(sesionDe(usuario, "veterinario"));
    expect(resumen).toMatchObject({ tipo: "veterinario", turnos_hoy: [] });
    if (resumen.tipo !== "veterinario") throw new Error("Se esperaba el resumen del veterinario");
    expect(resumen.motivo).toContain("no está vinculado");
  });
});
