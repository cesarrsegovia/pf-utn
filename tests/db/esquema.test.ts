import { afterAll, describe, expect, it } from "vitest";
import { QueryTypes } from "sequelize";
import { sequelize } from "@/lib/db";
import { restriccionViolada } from "../helpers/bd";

afterAll(() => sequelize.close());

/** Ejecuta SQL crudo; se usa para probar las restricciones sin pasar por los modelos. */
const ejecutar = (sql: string) => sequelize.query(sql);

describe("esquema de la base de datos", () => {
  it("crea las 16 tablas del ERD", async () => {
    const filas = await sequelize.query<{ table_name: string }>(
      `SELECT tablename AS table_name FROM pg_tables
       WHERE schemaname = 'public' AND tablename <> 'migraciones_aplicadas'
       ORDER BY tablename`,
      { type: QueryTypes.SELECT },
    );
    expect(filas.map((fila) => fila.table_name)).toEqual([
      "animal", "historial_clinico", "insumo", "movimiento_insumo", "notificacion",
      "operativo", "operativo_veterinario", "procedimiento", "procedimiento_insumo",
      "reporte_avistamiento", "rol", "turno", "usuario", "vecino", "veterinario", "zona",
    ]);
  });

  it("rechaza un sexo de animal distinto de M/H", async () => {
    const restriccion = await restriccionViolada(
      ejecutar("INSERT INTO animal (sexo, condicion) VALUES ('X', 'callejero')"),
    );
    expect(restriccion).toBe("ck_animal_sexo");
  });

  it("exige tutor solo para animales con_tutor", async () => {
    const restriccion = await restriccionViolada(
      ejecutar("INSERT INTO animal (sexo, condicion) VALUES ('M', 'con_tutor')"),
    );
    expect(restriccion).toBe("ck_animal_tutor");
  });

  it("no admite stock negativo", async () => {
    const restriccion = await restriccionViolada(
      ejecutar("INSERT INTO insumo (nombre, unidad, stock_actual) VALUES ('Ketamina', 'ml', -1)"),
    );
    expect(restriccion).toBe("ck_insumo_stock_actual");
  });

  it("exige matrícula al personal de tipo veterinario", async () => {
    const restriccion = await restriccionViolada(
      ejecutar("INSERT INTO veterinario (tipo, nombre, apellido) VALUES ('veterinario', 'Ana', 'Ruiz')"),
    );
    expect(restriccion).toBe("ck_veterinario_matricula");
  });

  it("exige número de chip cuando el procedimiento incluye chipeo", async () => {
    const restriccion = await restriccionViolada(
      ejecutar("INSERT INTO procedimiento (tipo, turno_id, veterinario_id) VALUES ('chipeo', 1, 1)"),
    );
    expect(restriccion).toBe("ck_procedimiento_chip");
  });
});
