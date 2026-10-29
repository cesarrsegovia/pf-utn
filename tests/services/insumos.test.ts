import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Insumo, MovimientoInsumo, sequelize } from "@/lib/db";
import type { DatosCrearInsumo } from "@/schemas/insumos";
import {
  actualizarInsumo, crearInsumo, eliminarInsumo, listarInsumos, listarMovimientos, registrarMovimiento,
} from "@/services/insumos";
import { reiniciarDatos } from "../helpers/bd";
import { adminSemilla } from "../helpers/fabricas";

beforeEach(reiniciarDatos);
afterAll(() => sequelize.close());

const ketamina: DatosCrearInsumo = { nombre: "Ketamina", unidad: "ml", stock_minimo: 5, stock_inicial: 10 };

/** Crea el insumo de prueba registrado por el administrador semilla. */
async function crearKetamina(cambios: Partial<DatosCrearInsumo> = {}) {
  const admin = await adminSemilla();
  return { admin, insumo: await crearInsumo({ ...ketamina, ...cambios }, admin.id) };
}

describe("crear y editar insumos", () => {
  it("registra el stock inicial como un movimiento de ingreso", async () => {
    const { insumo } = await crearKetamina();
    expect(insumo).toMatchObject({ stock_actual: "10.00", stock_minimo: "5.00", bajo_minimo: false });
    const movimientos = await MovimientoInsumo.findAll({ where: { insumo_id: insumo.id } });
    expect(movimientos.map((m) => [m.tipo, m.cantidad, m.motivo])).toEqual([["ingreso", "10.00", "Stock inicial"]]);
  });

  it("no registra movimientos si el stock inicial es 0 y rechaza nombres repetidos", async () => {
    const { insumo, admin } = await crearKetamina({ stock_inicial: 0 });
    expect(await MovimientoInsumo.count({ where: { insumo_id: insumo.id } })).toBe(0);
    await expect(crearInsumo({ ...ketamina, nombre: "KETAMINA" }, admin.id)).rejects.toMatchObject({
      campos: { nombre: "Ya existe un insumo con ese nombre" },
    });
  });

  it("la edición no modifica el stock", async () => {
    const { insumo } = await crearKetamina();
    const editado = await actualizarInsumo(insumo.id, { nombre: "Ketamina 5%", unidad: "ml", stock_minimo: 12 });
    expect(editado).toMatchObject({ nombre: "Ketamina 5%", stock_actual: "10.00", bajo_minimo: true });
  });
});

describe("movimientos de stock (F6)", () => {
  it("suma los ingresos y resta los egresos operando con decimales exactos", async () => {
    const { insumo, admin } = await crearKetamina();
    await registrarMovimiento(insumo.id, { tipo: "ingreso", cantidad: 0.1, motivo: "Compra" }, admin.id);
    const resultado = await registrarMovimiento(insumo.id, { tipo: "egreso", cantidad: 0.2, motivo: "Ajuste" }, admin.id);
    expect(resultado.stock_actual).toBe("9.90");
  });

  it("rechaza un egreso mayor al stock sin modificar nada", async () => {
    const { insumo, admin } = await crearKetamina({ stock_inicial: 2 });
    await expect(
      registrarMovimiento(insumo.id, { tipo: "egreso", cantidad: 5, motivo: "Uso" }, admin.id),
    ).rejects.toThrow("Stock insuficiente de Ketamina: disponible 2,00 ml, requerido 5,00 ml");
    expect((await Insumo.findByPk(insumo.id))!.stock_actual).toBe("2.00");
    expect(await MovimientoInsumo.count({ where: { insumo_id: insumo.id } })).toBe(1);
  });

  it("bloquea la fila: un egreso espera a la operación en curso y valida contra el stock actualizado", async () => {
    const { insumo, admin } = await crearKetamina();
    let egreso!: Promise<string>;
    await sequelize.transaction(async (transaction) => {
      // Otra operación toma el insumo con bloqueo y deja el stock en 3.
      const bloqueado = await Insumo.findByPk(insumo.id, { transaction, lock: transaction.LOCK.UPDATE });
      // Egreso concurrente de 6: debe esperar a que la operación anterior termine.
      egreso = registrarMovimiento(insumo.id, { tipo: "egreso", cantidad: 6, motivo: "Uso" }, admin.id).then(
        () => "registrado",
        (error: Error) => error.message,
      );
      await new Promise((resolver) => setTimeout(resolver, 300));
      await bloqueado!.update({ stock_actual: "3.00" }, { transaction });
    });
    // Sin el bloqueo, el egreso habría leído 10, pasado la validación y dejado el stock en 4.
    expect(await egreso).toContain("Stock insuficiente de Ketamina");
    expect((await Insumo.findByPk(insumo.id))!.stock_actual).toBe("3.00");
  });

  it("lista los movimientos del más reciente al más antiguo con el usuario", async () => {
    const { insumo, admin } = await crearKetamina();
    await registrarMovimiento(insumo.id, { tipo: "egreso", cantidad: 1, motivo: "Uso" }, admin.id);
    const movimientos = await listarMovimientos(insumo.id, { pagina: 1, tamanio: 10, busqueda: "" });
    expect(movimientos.filas.map((m) => m.motivo)).toEqual(["Uso", "Stock inicial"]);
    expect(movimientos.filas[0].usuario).toBe(`${admin.nombre} ${admin.apellido}`);
  });
});

describe("listar y eliminar insumos", () => {
  it("filtra los insumos con stock en o bajo el mínimo", async () => {
    await crearKetamina();
    const { insumo: bajo } = await crearKetamina({ nombre: "Suturas", unidad: "u", stock_inicial: 5 });
    const resultado = await listarInsumos({ pagina: 1, tamanio: 10, busqueda: "", stock: "bajo_minimo" });
    expect(resultado.filas.map((i) => i.id)).toEqual([bajo.id]);
  });

  it("no elimina un insumo con movimientos y sí uno sin movimientos", async () => {
    const { insumo: conMovimientos } = await crearKetamina();
    await expect(eliminarInsumo(conMovimientos.id)).rejects.toThrow("1 movimiento de stock");

    const { insumo: sinMovimientos } = await crearKetamina({ nombre: "Gasas", stock_inicial: 0 });
    await eliminarInsumo(sinMovimientos.id);
    expect(await Insumo.findByPk(sinMovimientos.id)).toBeNull();
  });
});
