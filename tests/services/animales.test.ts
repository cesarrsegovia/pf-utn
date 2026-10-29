import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Animal, sequelize, Vecino } from "@/lib/db";
import type { DatosAnimal } from "@/schemas/animales";
import { actualizarAnimal, crearAnimal, eliminarAnimal, listarAnimales } from "@/services/animales";
import { reiniciarDatos } from "../helpers/bd";
import { crearAnimalPrueba, crearOperativoPrueba, crearTurnoPrueba, crearVecinoPrueba } from "../helpers/fabricas";

beforeEach(reiniciarDatos);
afterAll(() => sequelize.close());

/** Datos válidos de un perro con tutor. */
function datosAnimal(vecinoId: number | null, cambios: Partial<DatosAnimal> = {}): DatosAnimal {
  return {
    nombre: "Firulais", raza: "", sexo: "M", edad_estimada: 3, condicion: "con_tutor",
    vecino_id: vecinoId, numero_chip: "", castrado: false, ...cambios,
  };
}

describe("crear y editar animales", () => {
  it("guarda el tutor de un animal con tutor e ignora el vecino de un callejero", async () => {
    const vecino = await crearVecinoPrueba();
    const conTutor = await crearAnimal(datosAnimal(vecino.id));
    expect(conTutor).toMatchObject({ vecino_id: vecino.id, tutor: `${vecino.apellido}, ${vecino.nombre}`, raza: null });

    const callejero = await crearAnimal(datosAnimal(vecino.id, { condicion: "callejero" }));
    expect(callejero).toMatchObject({ vecino_id: null, tutor: null });
  });

  it("no asigna como tutor a un vecino dado de baja o inexistente", async () => {
    const inactivo = await crearVecinoPrueba({ activo: false });
    await expect(crearAnimal(datosAnimal(inactivo.id))).rejects.toMatchObject({
      campos: { vecino_id: "El vecino seleccionado está dado de baja" },
    });
    await expect(crearAnimal(datosAnimal(9999))).rejects.toMatchObject({
      campos: { vecino_id: "El vecino seleccionado no existe" },
    });
  });

  it("permite editar un animal que conserva a su tutor dado de baja", async () => {
    const vecino = await crearVecinoPrueba();
    const animal = await crearAnimal(datosAnimal(vecino.id));
    await Vecino.update({ activo: false, fecha_baja: "2026-01-01" }, { where: { id: vecino.id } });
    const editado = await actualizarAnimal(animal.id, datosAnimal(vecino.id, { nombre: "Firu" }));
    expect(editado).toMatchObject({ nombre: "Firu", vecino_id: vecino.id });
  });

  it("rechaza un número de chip repetido indicando el campo", async () => {
    await crearAnimalPrueba({ numeroChip: "900123456789012" });
    await expect(crearAnimal(datosAnimal(null, { condicion: "callejero", numero_chip: "900123456789012" }))).rejects.toMatchObject({
      campos: { numero_chip: "Ya existe un animal con ese número de chip" },
    });
  });
});

describe("listar animales", () => {
  it("busca por DNI del tutor o por chip y filtra por condición", async () => {
    const vecino = await crearVecinoPrueba();
    const conTutor = await crearAnimalPrueba({ vecinoId: vecino.id });
    const chipeado = await crearAnimalPrueba({ vecinoId: null, numeroChip: "900111222333444" });

    const porDni = await listarAnimales({ pagina: 1, tamanio: 10, busqueda: vecino.dni });
    expect(porDni.filas.map((a) => a.id)).toEqual([conTutor.id]);

    const porChip = await listarAnimales({ pagina: 1, tamanio: 10, busqueda: "222333" });
    expect(porChip.filas.map((a) => a.id)).toEqual([chipeado.id]);

    const callejeros = await listarAnimales({ pagina: 1, tamanio: 10, busqueda: "", condicion: "callejero" });
    expect(callejeros.filas.map((a) => a.id)).toEqual([chipeado.id]);
  });
});

describe("eliminar animales", () => {
  it("no elimina un animal con turnos y sí uno sin turnos", async () => {
    const conTurno = await crearAnimalPrueba();
    await crearTurnoPrueba(conTurno.id, (await crearOperativoPrueba()).id);
    await expect(eliminarAnimal(conTurno.id)).rejects.toThrow("1 turno registrado");

    const sinTurno = await crearAnimalPrueba();
    await eliminarAnimal(sinTurno.id);
    expect(await Animal.findByPk(sinTurno.id)).toBeNull();
  });
});
