import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ReglaNegocioError, ValidacionError } from "@/lib/errores";
import { ReporteAvistamiento, sequelize } from "@/lib/db";
import { hoyLocal, sumarDias } from "@/lib/fechas";
import type { DatosAvistamiento } from "@/schemas/avistamientos";
import {
  actualizarAvistamiento, atenderAvistamiento, crearAvistamiento, eliminarAvistamiento, listarAvistamientos,
} from "@/services/avistamientos";
import { reiniciarDatos } from "../helpers/bd";
import { adminSemilla, crearOperativoPrueba, crearVecinoPrueba, zonaSemilla } from "../helpers/fabricas";

beforeEach(reiniciarDatos);
afterAll(() => sequelize.close());

const BASE = { pagina: 1, tamanio: 10, busqueda: "" };

/** Datos válidos de un reporte anónimo de hoy a las 00:00 (siempre en el pasado) en la zona indicada. */
function datosReporte(zonaId: number, cambios: Partial<DatosAvistamiento> = {}): DatosAvistamiento {
  return {
    fecha: hoyLocal(),
    hora: "00:00",
    descripcion: "Jauría de cinco perros cerca de la escuela",
    cantidad_animales: 5,
    direccion_referencia: "",
    zona_id: zonaId,
    vecino_id: null,
    ...cambios,
  };
}

describe("alta y listado de avistamientos (F9)", () => {
  it("registra el reporte con el usuario en sesión, pendiente y anónimo o con vecino", async () => {
    const admin = await adminSemilla();
    const zona = await zonaSemilla();
    const anonimo = await crearAvistamiento(datosReporte(zona.id), admin.id);
    expect(anonimo).toMatchObject({ estado: "pendiente", vecino: null, zona: "Centro", fecha_atencion: null });
    expect(anonimo.usuario).toBe(`${admin.nombre} ${admin.apellido}`);
    expect(anonimo.direccion_referencia).toBeNull();

    const vecino = await crearVecinoPrueba();
    const conVecino = await crearAvistamiento(datosReporte(zona.id, { vecino_id: vecino.id }), admin.id);
    expect(conVecino.vecino).toBe(`${vecino.apellido}, ${vecino.nombre}`);
  });

  it("rechaza una fecha futura y una zona inexistente (errores por campo)", async () => {
    const admin = await adminSemilla();
    const zona = await zonaSemilla();
    const futura = crearAvistamiento(datosReporte(zona.id, { fecha: sumarDias(hoyLocal(), 1) }), admin.id);
    await expect(futura).rejects.toMatchObject({ campos: { fecha: "La fecha y hora no pueden ser futuras" } });
    const sinZona = crearAvistamiento(datosReporte(9999), admin.id);
    await expect(sinZona).rejects.toBeInstanceOf(ValidacionError);
    await expect(sinZona).rejects.toMatchObject({ campos: { zona_id: "La zona seleccionada no existe" } });
    expect(await ReporteAvistamiento.count()).toBe(0);
  });

  it("filtra por estado y zona, busca por descripción y ordena del más reciente al más antiguo", async () => {
    const admin = await adminSemilla();
    const centro = await zonaSemilla();
    const austral = await zonaSemilla("Austral");
    const antiguo = await crearAvistamiento(
      datosReporte(centro.id, { fecha: sumarDias(hoyLocal(), -3), descripcion: "Gatos en el baldío" }),
      admin.id,
    );
    const reciente = await crearAvistamiento(datosReporte(centro.id), admin.id);
    const otraZona = await crearAvistamiento(datosReporte(austral.id), admin.id);
    await atenderAvistamiento(otraZona.id, { operativo_id: null });

    const todos = await listarAvistamientos(BASE);
    expect(todos.filas.map((fila) => fila.id)).toEqual([otraZona.id, reciente.id, antiguo.id]);
    expect((await listarAvistamientos({ ...BASE, estado: "pendiente" })).total).toBe(2);
    expect((await listarAvistamientos({ ...BASE, zona_id: austral.id })).filas[0].id).toBe(otraZona.id);
    expect((await listarAvistamientos({ ...BASE, busqueda: "BALDIO" })).filas.map((f) => f.id)).toEqual([antiguo.id]);
    const ultimosDosDias = await listarAvistamientos({ ...BASE, desde: sumarDias(hoyLocal(), -1) });
    expect(ultimosDosDias.total).toBe(2);
  });
});

describe("atención de avistamientos (F9)", () => {
  it("pasa a atendido con fecha de atención y el operativo de la misma zona", async () => {
    const admin = await adminSemilla();
    const zona = await zonaSemilla();
    const operativo = await crearOperativoPrueba({ zonaId: zona.id });
    const reporte = await crearAvistamiento(datosReporte(zona.id), admin.id);

    const atendido = await atenderAvistamiento(reporte.id, { operativo_id: operativo.id });
    expect(atendido.estado).toBe("atendido");
    expect(atendido.fecha_atencion).not.toBeNull();
    expect(atendido.operativo_id).toBe(operativo.id);
    expect(atendido.operativo).toContain("SUM municipal");
  });

  it("rechaza un operativo de otra zona o cancelado, sin cambiar el reporte", async () => {
    const admin = await adminSemilla();
    const zona = await zonaSemilla();
    const otraZona = await crearOperativoPrueba({ zonaId: (await zonaSemilla("Austral")).id });
    const cancelado = await crearOperativoPrueba({ zonaId: zona.id });
    await cancelado.update({
      estado: "cancelado", motivo_cancelacion: "Lluvia", fecha_cancelacion: new Date(), usuario_cancelacion_id: admin.id,
    });
    const reporte = await crearAvistamiento(datosReporte(zona.id), admin.id);

    await expect(atenderAvistamiento(reporte.id, { operativo_id: otraZona.id })).rejects.toMatchObject({
      campos: { operativo_id: "El operativo debe ser de la misma zona que el reporte" },
    });
    await expect(atenderAvistamiento(reporte.id, { operativo_id: cancelado.id })).rejects.toMatchObject({
      campos: { operativo_id: "No se puede asociar un operativo cancelado" },
    });
    expect((await ReporteAvistamiento.findByPk(reporte.id))!.estado).toBe("pendiente");
  });

  it("un reporte atendido no se edita, elimina ni vuelve a atender", async () => {
    const admin = await adminSemilla();
    const zona = await zonaSemilla();
    const reporte = await crearAvistamiento(datosReporte(zona.id), admin.id);
    await atenderAvistamiento(reporte.id, { operativo_id: null });

    await expect(atenderAvistamiento(reporte.id, { operativo_id: null })).rejects.toBeInstanceOf(ReglaNegocioError);
    await expect(actualizarAvistamiento(reporte.id, datosReporte(zona.id))).rejects.toThrow(
      "No se puede editar un reporte ya atendido",
    );
    await expect(eliminarAvistamiento(reporte.id)).rejects.toThrow("No se puede eliminar un reporte ya atendido");
  });

  it("edita y elimina un reporte pendiente", async () => {
    const admin = await adminSemilla();
    const zona = await zonaSemilla();
    const reporte = await crearAvistamiento(datosReporte(zona.id), admin.id);

    const editado = await actualizarAvistamiento(
      reporte.id,
      datosReporte(zona.id, { cantidad_animales: 2, direccion_referencia: "Frente a la plaza" }),
    );
    expect(editado).toMatchObject({ cantidad_animales: 2, direccion_referencia: "Frente a la plaza" });

    await eliminarAvistamiento(reporte.id);
    expect(await ReporteAvistamiento.count()).toBe(0);
  });
});
