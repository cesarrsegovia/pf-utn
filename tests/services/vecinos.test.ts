import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { MOTIVOS_CANCELACION } from "@/lib/constantes";
import { Notificacion, sequelize, Turno, Vecino } from "@/lib/db";
import { hoyLocal } from "@/lib/fechas";
import type { DatosVecino } from "@/schemas/vecinos";
import {
  crearVecino, eliminarVecino, listarVecinos, opcionesVecinos, reactivarVecino,
} from "@/services/vecinos";
import { reiniciarDatos } from "../helpers/bd";
import {
  crearAnimalPrueba, crearOperativoPrueba, crearTurnoPrueba, crearVecinoPrueba, zonaSemilla,
} from "../helpers/fabricas";

beforeEach(reiniciarDatos);
afterAll(() => sequelize.close());

/** Datos válidos de un vecino en la zona indicada. */
function datosVecino(zonaId: number, cambios: Partial<DatosVecino> = {}): DatosVecino {
  return {
    nombre: "Ana", apellido: "Gómez", dni: "28123456", telefono: "2964401122",
    email: "", direccion: "Belgrano 450", zona_id: zonaId, ...cambios,
  };
}

describe("crear vecino", () => {
  it("guarda el email vacío como nulo y en minúsculas cuando se informa", async () => {
    const zona = await zonaSemilla();
    expect((await crearVecino(datosVecino(zona.id))).email).toBeNull();
    const conEmail = await crearVecino(datosVecino(zona.id, { dni: "28123457", email: "Ana.Gomez@Correo.com" }));
    expect(conEmail).toMatchObject({ email: "ana.gomez@correo.com", zona: "Centro", activo: true });
  });

  it("rechaza un DNI repetido y una zona inexistente indicando el campo", async () => {
    const zona = await zonaSemilla();
    await crearVecino(datosVecino(zona.id));
    await expect(crearVecino(datosVecino(zona.id))).rejects.toMatchObject({
      campos: { dni: "Ya existe un vecino con ese DNI" },
    });
    await expect(crearVecino(datosVecino(9999, { dni: "28999999" }))).rejects.toMatchObject({
      campos: { zona_id: "La zona seleccionada no existe" },
    });
  });
});

describe("listar vecinos", () => {
  it("muestra los activos por defecto y filtra por zona y DNI", async () => {
    const otraZona = await zonaSemilla("Austral");
    const activo = await crearVecinoPrueba({ zonaId: otraZona.id });
    await crearVecinoPrueba({ activo: false });

    const activos = await listarVecinos({ pagina: 1, tamanio: 10, busqueda: "", estado: "activos" });
    expect(activos.filas.map((v) => v.id)).toEqual([activo.id]);

    const inactivos = await listarVecinos({ pagina: 1, tamanio: 10, busqueda: "", estado: "inactivos" });
    expect(inactivos.total).toBe(1);

    const porZonaYDni = await listarVecinos({
      pagina: 1, tamanio: 10, busqueda: activo.dni.slice(-4), estado: "todos", zona_id: otraZona.id,
    });
    expect(porZonaYDni.filas.map((v) => v.id)).toEqual([activo.id]);
  });

  it("ofrece como tutores a los activos y al tutor actual aunque esté inactivo", async () => {
    const activo = await crearVecinoPrueba();
    const inactivo = await crearVecinoPrueba({ activo: false });
    expect((await opcionesVecinos()).map((o) => o.id)).toEqual([activo.id]);
    expect((await opcionesVecinos(inactivo.id)).map((o) => o.id).sort()).toEqual([activo.id, inactivo.id].sort());
  });
});

describe("baja de vecino (F1)", () => {
  it("elimina físicamente a un vecino sin registros asociados", async () => {
    const vecino = await crearVecinoPrueba();
    expect(await eliminarVecino(vecino.id)).toEqual({ resultado: "eliminado" });
    expect(await Vecino.findByPk(vecino.id)).toBeNull();
  });

  it("con animales hace baja lógica y cancela en cascada sus turnos activos", async () => {
    const vecino = await crearVecinoPrueba();
    const perro1 = await crearAnimalPrueba({ vecinoId: vecino.id });
    const perro2 = await crearAnimalPrueba({ vecinoId: vecino.id });
    const pasado = await crearOperativoPrueba({ diasDesdeHoy: -30, estado: "realizado" });
    const futuro = await crearOperativoPrueba();

    const completado = await crearTurnoPrueba(perro1.id, pasado.id, "completado");
    const pendiente = await crearTurnoPrueba(perro1.id, futuro.id, "pendiente");
    const confirmado = await crearTurnoPrueba(perro2.id, futuro.id, "confirmado");
    const recordatorio = await Notificacion.create({
      tipo: "recordatorio", mensaje: "Recordatorio de turno", fecha_programada: new Date(),
      turno_id: confirmado.id, vecino_id: vecino.id,
    });

    expect(await eliminarVecino(vecino.id)).toEqual({ resultado: "desactivado", turnosCancelados: 2 });

    const guardado = await Vecino.findByPk(vecino.id);
    expect(guardado).toMatchObject({ activo: false, fecha_baja: hoyLocal() });
    for (const turno of [pendiente, confirmado]) {
      expect(await Turno.findByPk(turno.id)).toMatchObject({
        estado: "cancelado",
        motivo_cancelacion: MOTIVOS_CANCELACION.bajaVecino,
      });
    }
    expect((await Turno.findByPk(completado.id))!.estado).toBe("completado");
    expect((await Notificacion.findByPk(recordatorio.id))!.estado_envio).toBe("anulado");
  });

  it("reactiva a un vecino dado de baja y rechaza reactivar a uno activo", async () => {
    const vecino = await crearVecinoPrueba({ activo: false });
    expect(await reactivarVecino(vecino.id)).toMatchObject({ activo: true, fecha_baja: null });
    await expect(reactivarVecino(vecino.id)).rejects.toThrow("ya está activo");
  });
});
