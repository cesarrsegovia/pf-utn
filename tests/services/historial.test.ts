import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { OperativoVeterinario, sequelize } from "@/lib/db";
import { hoyLocal, sumarDias } from "@/lib/fechas";
import { listarHistorial } from "@/services/historial";
import { registrarProcedimiento } from "@/services/procedimientos";
import { reiniciarDatos } from "../helpers/bd";
import {
  crearAnimalPrueba, crearOperativoPrueba, crearTurnoPrueba, crearVeterinarioConUsuario,
} from "../helpers/fabricas";

beforeEach(reiniciarDatos);
afterAll(() => sequelize.close());

const CHIP = "985112003456789";
const BASE = { pagina: 1, tamanio: 10, busqueda: "" };

/**
 * Tres procedimientos en un operativo en curso: castración y después chipeo del mismo
 * animal, y por último la castración de otro animal.
 */
async function tresProcedimientos() {
  const { usuario, personal } = await crearVeterinarioConUsuario();
  const operativo = await crearOperativoPrueba({ diasDesdeHoy: 0, estado: "en_curso" });
  await OperativoVeterinario.create({ operativo_id: operativo.id, veterinario_id: personal.id });
  const sinChip = { numero_chip_colocado: "", observaciones: "", insumos: [] };

  const animal = await crearAnimalPrueba();
  const castracion = await crearTurnoPrueba(animal.id, operativo.id, "confirmado");
  await registrarProcedimiento({ ...sinChip, turno_id: castracion.id, tipo: "castracion" }, usuario.id);
  const chipeo = await crearTurnoPrueba(animal.id, operativo.id, "confirmado");
  await chipeo.update({ tipo_solicitado: "chipeo" });
  await registrarProcedimiento({ ...sinChip, turno_id: chipeo.id, tipo: "chipeo", numero_chip_colocado: CHIP }, usuario.id);

  const otro = await crearAnimalPrueba();
  const turnoOtro = await crearTurnoPrueba(otro.id, operativo.id, "confirmado");
  await registrarProcedimiento({ ...sinChip, turno_id: turnoOtro.id, tipo: "castracion" }, usuario.id);
  return { animal, otro };
}

describe("historial clínico (F8)", () => {
  it("muestra la vida clínica de un animal en orden cronológico", async () => {
    const { animal } = await tresProcedimientos();
    const { filas, total } = await listarHistorial({ ...BASE, animal_id: animal.id });
    expect(total).toBe(2);
    expect(filas.map((f) => [f.animal_id, f.tipo])).toEqual([
      [animal.id, "castracion"],
      [animal.id, "chipeo"],
    ]);
  });

  it("sin filtro de animal ordena del más reciente al más antiguo", async () => {
    const { otro } = await tresProcedimientos();
    const { filas } = await listarHistorial(BASE);
    expect(filas).toHaveLength(3);
    expect(filas[0].animal_id).toBe(otro.id);
  });

  it("filtra por tipo y por rango de fechas, y busca por chip del animal", async () => {
    const { animal } = await tresProcedimientos();
    expect((await listarHistorial({ ...BASE, tipo: "castracion" })).total).toBe(2);
    expect((await listarHistorial({ ...BASE, desde: hoyLocal(), hasta: hoyLocal() })).total).toBe(3);
    expect((await listarHistorial({ ...BASE, hasta: sumarDias(hoyLocal(), -1) })).total).toBe(0);

    const porChip = await listarHistorial({ ...BASE, busqueda: CHIP });
    expect(porChip.total).toBe(2);
    expect(porChip.filas.every((f) => f.animal_id === animal.id && f.numero_chip === CHIP)).toBe(true);
  });
});
