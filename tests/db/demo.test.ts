import { Op } from "sequelize";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { aCentesimos } from "@/lib/cantidades";
import { Animal, HistorialClinico, Insumo, MovimientoInsumo, Procedimiento, sequelize, Turno, Usuario, Vecino } from "@/lib/db";
import { rangoUltimosMeses } from "@/lib/fechas";
import { resumenDashboard } from "@/services/dashboard";
import { generarReportes } from "@/services/reportes";
import { CORREO_PRUEBA, sembrarDatosDemo, USUARIOS_DEMO } from "../../db/seeders/demo";
import { reiniciarDatos } from "../helpers/bd";

// La demo se carga sobre una base con solo los datos iniciales y, al terminar, la base vuelve
// a ese estado para no afectar a los demás archivos de test.
beforeAll(async () => {
  await reiniciarDatos();
  await sembrarDatosDemo();
}, 120_000);

afterAll(async () => {
  await reiniciarDatos();
  await sequelize.close();
});

/** Busca un usuario de la demo por su email. */
async function usuarioDemo(email: string): Promise<Usuario> {
  return (await Usuario.findOne({ where: { email } }))!;
}

describe("seed de demostración", () => {
  it("carga vecinos, animales y un usuario por cada credencial de la demo", async () => {
    expect(await Vecino.count()).toBe(30);
    expect(await Vecino.count({ where: { activo: true } })).toBe(29);
    expect(await Animal.count()).toBe(50);
    // El único email es el de prueba: no se envían correos a direcciones inventadas.
    expect(await Vecino.count({ where: { email: { [Op.ne]: null } } })).toBe(1);
    expect(await Vecino.count({ where: { email: CORREO_PRUEBA } })).toBe(1);
    for (const { email } of Object.values(USUARIOS_DEMO)) {
      expect(await Usuario.count({ where: { email } })).toBe(1);
    }
  });

  it("no se carga dos veces sobre la misma base", async () => {
    await expect(sembrarDatosDemo()).rejects.toThrow("La base ya tiene vecinos");
  });

  it("cada turno completado tiene procedimiento e historial, y el animal refleja lo realizado", async () => {
    expect(await Turno.count({ where: { estado: "completado" } })).toBe(24);
    expect(await Procedimiento.count()).toBe(24);
    expect(await HistorialClinico.count()).toBe(24);
    expect(await Animal.count({ where: { castrado: true } })).toBe(16);
    expect(await Animal.count({ where: { numero_chip: { [Op.ne]: null } } })).toBe(16);
  });

  it("el stock de cada insumo coincide con sus movimientos y solo las gasas quedan bajo el mínimo", async () => {
    const insumos = await Insumo.findAll({ order: [["nombre", "ASC"]] });
    for (const insumo of insumos) {
      const movimientos = await MovimientoInsumo.findAll({ where: { insumo_id: insumo.id } });
      const saldo = movimientos.reduce(
        (total, movimiento) => total + (movimiento.tipo === "ingreso" ? 1 : -1) * aCentesimos(movimiento.cantidad),
        0,
      );
      expect(saldo).toBe(aCentesimos(insumo.stock_actual));
    }
    const bajoMinimo = insumos.filter((insumo) => aCentesimos(insumo.stock_actual) <= aCentesimos(insumo.stock_minimo));
    expect(bajoMinimo.map((insumo) => insumo.nombre)).toEqual(["Gasas estériles"]);
    expect(insumos.find((insumo) => insumo.nombre === "Ketamina")?.stock_actual).toBe("460.00");
  });

  it("los reportes de los últimos 12 meses dan los valores del escenario", async () => {
    const reporte = await generarReportes(rangoUltimosMeses(12));
    const suma = (clave: "castraciones" | "chipeos") =>
      reporte.procedimientos.reduce((total, fila) => total + fila[clave], 0);
    expect(suma("castraciones")).toBe(16);
    expect(suma("chipeos")).toBe(16);
    expect(reporte.cumplimiento).toEqual({ realizados: 8, cancelados: 2, sin_cerrar: 0, porcentaje: 80 });
    expect(reporte.asistencia).toEqual({ completados: 24, ausentes: 8, porcentaje: 75 });
    // 8 realizados + el de hoy (los cancelados no cuentan y los futuros quedan fuera del período).
    expect(reporte.ocupacion.operativos).toHaveLength(9);
    const avisos = reporte.avistamientos.meses.reduce((total, mes) => total + mes.pendientes + mes.atendidos, 0);
    expect(avisos).toBe(18);
    expect(reporte.avistamientos.promedio_dias).not.toBeNull();
  });

  it("el inicio muestra los totales y los turnos de hoy según el rol", async () => {
    const operador = await usuarioDemo(USUARIOS_DEMO.operador.email);
    const general = await resumenDashboard({ usuarioId: operador.id, nombre: "Laura Gómez", rol: "operador" });
    if (general.tipo !== "general") throw new Error("Se esperaba el resumen general");
    expect(general.totales).toEqual({ vecinos_activos: 29, animales: 50, castrados: 16, chipeados: 16 });
    expect(general.turnos_hoy).toHaveLength(5);
    expect(general.insumos_bajo_minimo.total).toBe(1);
    expect(general.avistamientos_pendientes.total).toBe(4);

    const ana = await usuarioDemo(USUARIOS_DEMO.veterinaria.email);
    const deAna = await resumenDashboard({ usuarioId: ana.id, nombre: "Ana Ríos", rol: "veterinario" });
    expect(deAna).toMatchObject({ tipo: "veterinario", motivo: null });
    expect(deAna.turnos_hoy).toHaveLength(5);

    // Martín no está asignado al operativo de hoy.
    const martin = await usuarioDemo(USUARIOS_DEMO.veterinario.email);
    const deMartin = await resumenDashboard({ usuarioId: martin.id, nombre: "Martín Sosa", rol: "veterinario" });
    expect(deMartin.turnos_hoy).toHaveLength(0);
  });
});
