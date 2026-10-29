import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sequelize, Vecino } from "@/lib/db";
import { hoyLocal, sumarDias } from "@/lib/fechas";
import type { Correo } from "@/lib/mailer";
import { listarNotificaciones, procesarPendientes, reintentarNotificacion } from "@/services/notificaciones";
import { reiniciarDatos } from "../helpers/bd";
import { crearAnimalPrueba, crearNotificacionPrueba, crearOperativoPrueba, crearTurnoPrueba } from "../helpers/fabricas";

beforeEach(reiniciarDatos);
afterEach(() => vi.restoreAllMocks());
afterAll(() => sequelize.close());

/** Turno confirmado de un animal con tutor (el tutor de las fábricas siempre tiene email). */
async function turnoConTutor() {
  const animal = await crearAnimalPrueba();
  const operativo = await crearOperativoPrueba();
  const turno = await crearTurnoPrueba(animal.id, operativo.id, "confirmado");
  const vecino = (await Vecino.findByPk(animal.vecino_id!))!;
  return { turno, vecino };
}

/** Envío simulado: registra los correos en lugar de mandarlos por SMTP. */
function envioSimulado() {
  const enviados: Correo[] = [];
  return { enviados, enviar: async (correo: Correo) => void enviados.push(correo) };
}

describe("procesador de envío (F12)", () => {
  it("envía las pendientes vencidas y deja las programadas a futuro", async () => {
    const { turno, vecino } = await turnoConTutor();
    const inmediata = await crearNotificacionPrueba(turno.id, vecino.id);
    const futura = await crearNotificacionPrueba(turno.id, vecino.id, {
      tipo: "recordatorio",
      fechaProgramada: new Date(Date.now() + 60 * 60 * 1000),
    });
    const { enviados, enviar } = envioSimulado();

    expect(await procesarPendientes(enviar)).toEqual({ enviadas: 1, fallidas: 0 });
    expect(enviados).toEqual([{ para: vecino.email, asunto: "SIGCAN – Turno confirmado", texto: "Mensaje de prueba" }]);
    await inmediata.reload();
    expect(inmediata.estado_envio).toBe("enviado");
    expect(inmediata.fecha_envio).not.toBeNull();
    await futura.reload();
    expect(futura.estado_envio).toBe("pendiente");
  });

  it("marca como fallidas las que no se pudieron enviar y permite reintentarlas", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { turno, vecino } = await turnoConTutor();
    const notificacion = await crearNotificacionPrueba(turno.id, vecino.id);

    const fallar = async () => {
      throw new Error("SMTP caído");
    };
    expect(await procesarPendientes(fallar)).toEqual({ enviadas: 0, fallidas: 1 });
    await notificacion.reload();
    expect(notificacion.estado_envio).toBe("fallido");

    await reintentarNotificacion(notificacion.id);
    await notificacion.reload();
    expect(notificacion.estado_envio).toBe("pendiente");
    expect(await procesarPendientes(envioSimulado().enviar)).toEqual({ enviadas: 1, fallidas: 0 });
  });

  it("falla la notificación si el vecino ya no tiene email", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { turno, vecino } = await turnoConTutor();
    await crearNotificacionPrueba(turno.id, vecino.id);
    await vecino.update({ email: null });
    expect(await procesarPendientes(envioSimulado().enviar)).toEqual({ enviadas: 0, fallidas: 1 });
  });

  it("solo reintenta notificaciones fallidas", async () => {
    const { turno, vecino } = await turnoConTutor();
    const notificacion = await crearNotificacionPrueba(turno.id, vecino.id);
    await expect(reintentarNotificacion(notificacion.id)).rejects.toThrow(
      "Solo se pueden reintentar las notificaciones fallidas",
    );
  });
});

describe("listado de notificaciones", () => {
  it("filtra por estado, tipo y rango de fechas", async () => {
    const { turno, vecino } = await turnoConTutor();
    await crearNotificacionPrueba(turno.id, vecino.id, { estado: "fallido" });
    await crearNotificacionPrueba(turno.id, vecino.id, { tipo: "cancelacion" });
    const base = { pagina: 1, tamanio: 10, busqueda: "" };

    expect((await listarNotificaciones({ ...base, estado: "fallido" })).total).toBe(1);
    expect((await listarNotificaciones({ ...base, tipo: "cancelacion" })).filas).toEqual([
      expect.objectContaining({ tipo: "cancelacion", email: vecino.email }),
    ]);
    expect((await listarNotificaciones({ ...base, desde: hoyLocal(), hasta: hoyLocal() })).total).toBe(2);
    expect((await listarNotificaciones({ ...base, hasta: sumarDias(hoyLocal(), -1) })).total).toBe(0);
  });
});
