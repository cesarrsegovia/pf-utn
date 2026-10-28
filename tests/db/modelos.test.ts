import { afterAll, describe, expect, it } from "vitest";
import {
  Animal, Operativo, OperativoVeterinario, sequelize, Turno, Vecino, Veterinario, Zona,
} from "@/lib/db";
import { enTransaccionRevertida, restriccionViolada } from "../helpers/bd";

afterAll(() => sequelize.close());

describe("modelos y asociaciones", () => {
  it("navega animal → vecino → zona", async () => {
    await enTransaccionRevertida(async (transaction) => {
      const zona = await Zona.create({ nombre: "Zona de prueba modelos" }, { transaction });
      const vecino = await Vecino.create(
        { nombre: "Ana", apellido: "Pérez", dni: "30111222", telefono: "2964400000", direccion: "Calle 1 123", zona_id: zona.id },
        { transaction },
      );
      const animal = await Animal.create({ sexo: "H", condicion: "con_tutor", vecino_id: vecino.id }, { transaction });

      const encontrado = await Animal.findByPk(animal.id, {
        include: [{ association: "vecino", include: ["zona"] }],
        transaction,
      });

      expect(encontrado?.vecino?.zona?.nombre).toBe("Zona de prueba modelos");
      expect(encontrado?.castrado).toBe(false);
    });
  });

  it("asigna personal a un operativo (N:M)", async () => {
    await enTransaccionRevertida(async (transaction) => {
      const zona = await Zona.create({ nombre: "Zona de prueba N:M" }, { transaction });
      const operativo = await Operativo.create(
        { fecha: "2030-05-10", hora_inicio: "09:00", hora_fin: "13:00", lugar: "SUM barrial", cupo_maximo: 20, zona_id: zona.id },
        { transaction },
      );
      const veterinario = await Veterinario.create(
        { tipo: "veterinario", nombre: "Luis", apellido: "Gómez", matricula: "MV-0001" },
        { transaction },
      );
      await OperativoVeterinario.create({ operativo_id: operativo.id, veterinario_id: veterinario.id }, { transaction });

      const conPersonal = await Operativo.findByPk(operativo.id, { include: ["personal"], transaction });

      expect(conPersonal?.estado).toBe("programado");
      expect(conPersonal?.personal?.map((persona) => persona.matricula)).toEqual(["MV-0001"]);
    });
  });

  it("impide dos turnos activos para el mismo animal", async () => {
    await enTransaccionRevertida(async (transaction) => {
      const zona = await Zona.create({ nombre: "Zona de prueba turnos" }, { transaction });
      const operativo = await Operativo.create(
        { fecha: "2030-05-10", hora_inicio: "09:00", hora_fin: "13:00", lugar: "SUM barrial", cupo_maximo: 20, zona_id: zona.id },
        { transaction },
      );
      const animal = await Animal.create({ sexo: "M", condicion: "callejero" }, { transaction });
      const datosTurno = { horario: "09:30", tipo_solicitado: "castracion" as const, animal_id: animal.id, operativo_id: operativo.id };

      await Turno.create(datosTurno, { transaction });
      const restriccion = await restriccionViolada(Turno.create({ ...datosTurno, estado: "confirmado" }, { transaction }));

      expect(restriccion).toBe("ux_turno_activo_por_animal");
    });
  });
});
