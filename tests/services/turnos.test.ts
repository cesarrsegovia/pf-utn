import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { HORAS_RECORDATORIO } from "@/lib/constantes";
import { Notificacion, sequelize, Vecino } from "@/lib/db";
import { instanteLocal, MS_POR_HORA } from "@/lib/fechas";
import type { DatosSolicitarTurno } from "@/schemas/turnos";
import { cancelarTurno, confirmarTurno, listarTurnos, reprogramarTurno, solicitarTurno } from "@/services/turnos";
import { reiniciarDatos } from "../helpers/bd";
import { crearAnimalPrueba, crearOperativoPrueba, crearTurnoPrueba, crearVecinoPrueba } from "../helpers/fabricas";

beforeEach(reiniciarDatos);
afterAll(() => sequelize.close());

/** Operativo a 7 días (09:00 a 13:00, cupo 20), animal con tutor y datos de una solicitud a las 10:00. */
async function escenario() {
  const operativo = await crearOperativoPrueba();
  const animal = await crearAnimalPrueba();
  const datos: DatosSolicitarTurno = {
    animal_id: animal.id,
    operativo_id: operativo.id,
    horario: "10:00",
    tipo_solicitado: "castracion",
  };
  return { operativo, animal, datos };
}

/** Notificaciones de un turno como pares [tipo, estado], en orden de creación. */
async function notificacionesDe(turnoId: number) {
  const filas = await Notificacion.findAll({ where: { turno_id: turnoId }, order: [["id", "ASC"]] });
  return filas.map((notificacion) => [notificacion.tipo, notificacion.estado_envio]);
}

describe("solicitar turno (F3)", () => {
  it("crea el turno pendiente sin generar notificaciones", async () => {
    const { datos } = await escenario();
    const turno = await solicitarTurno(datos);
    expect(turno).toMatchObject({ estado: "pendiente", horario: "10:00", tipo_solicitado: "castracion" });
    expect(await notificacionesDe(turno.id)).toEqual([]);
  });

  it("rechaza la solicitud si el operativo no tiene cupo; los turnos cancelados liberan cupo", async () => {
    const { operativo, datos } = await escenario();
    await operativo.update({ cupo_maximo: 1 });
    const ocupante = await crearTurnoPrueba((await crearAnimalPrueba()).id, operativo.id);
    await expect(solicitarTurno(datos)).rejects.toThrow("El operativo no tiene cupo disponible");

    await ocupante.update({ estado: "cancelado", motivo_cancelacion: "Prueba" });
    await expect(solicitarTurno(datos)).resolves.toMatchObject({ estado: "pendiente" });
  });

  it("rechaza un segundo turno activo para el mismo animal", async () => {
    const { datos } = await escenario();
    await solicitarTurno(datos);
    const otro = await crearOperativoPrueba({ diasDesdeHoy: 10 });
    await expect(solicitarTurno({ ...datos, operativo_id: otro.id })).rejects.toThrow(
      "El animal ya tiene un turno pendiente o confirmado",
    );
  });

  it("rechaza horarios fuera de la franja del operativo", async () => {
    const { datos } = await escenario();
    const error = { campos: { horario: "El horario debe estar entre las 09:00 y las 13:00" } };
    await expect(solicitarTurno({ ...datos, horario: "08:59" })).rejects.toMatchObject(error);
    await expect(solicitarTurno({ ...datos, horario: "13:00" })).rejects.toMatchObject(error);
  });

  it("rechaza animales cuyo tutor está dado de baja y acepta callejeros", async () => {
    const { datos } = await escenario();
    const tutorInactivo = await crearVecinoPrueba({ activo: false });
    const conTutorInactivo = await crearAnimalPrueba({ vecinoId: tutorInactivo.id });
    await expect(solicitarTurno({ ...datos, animal_id: conTutorInactivo.id })).rejects.toThrow(
      "El tutor del animal está dado de baja",
    );

    const callejero = await crearAnimalPrueba({ vecinoId: null });
    await expect(solicitarTurno({ ...datos, animal_id: callejero.id })).resolves.toMatchObject({ tutor: null });
  });

  it("no solicita castración para un animal castrado ni chipeo para uno chipeado", async () => {
    const { animal, datos } = await escenario();
    await animal.update({ castrado: true, numero_chip: "123456789012345" });
    await expect(solicitarTurno(datos)).rejects.toThrow("El animal ya está castrado");
    await expect(solicitarTurno({ ...datos, tipo_solicitado: "chipeo" })).rejects.toThrow(
      "El animal ya tiene chip colocado",
    );
  });

  it("rechaza operativos que no están programados", async () => {
    const { operativo, datos } = await escenario();
    await operativo.update({ estado: "en_curso" });
    await expect(solicitarTurno(datos)).rejects.toThrow("El operativo no admite turnos: está en curso");
  });
});

describe("confirmar turno", () => {
  it("genera la confirmación y programa el recordatorio 24 h antes del turno", async () => {
    const { operativo, datos } = await escenario();
    const turno = await confirmarTurno((await solicitarTurno(datos)).id);
    expect(turno.estado).toBe("confirmado");
    expect(await notificacionesDe(turno.id)).toEqual([
      ["confirmacion", "pendiente"],
      ["recordatorio", "pendiente"],
    ]);

    const recordatorio = await Notificacion.findOne({ where: { turno_id: turno.id, tipo: "recordatorio" } });
    const esperado = instanteLocal(operativo.fecha, "10:00").getTime() - HORAS_RECORDATORIO * MS_POR_HORA;
    expect(recordatorio!.fecha_programada.getTime()).toBe(esperado);
    expect(recordatorio!.mensaje).toContain("a las 10:00 h");
  });

  it("no programa el recordatorio si faltan menos de 24 h", async () => {
    const operativo = await crearOperativoPrueba({ diasDesdeHoy: 0 });
    const turno = await crearTurnoPrueba((await crearAnimalPrueba()).id, operativo.id);
    await confirmarTurno(turno.id);
    expect(await notificacionesDe(turno.id)).toEqual([["confirmacion", "pendiente"]]);
  });

  it("no genera notificaciones si el tutor no tiene email", async () => {
    const { animal, datos } = await escenario();
    await Vecino.update({ email: null }, { where: { id: animal.vecino_id! } });
    const turno = await confirmarTurno((await solicitarTurno(datos)).id);
    expect(await notificacionesDe(turno.id)).toEqual([]);
  });

  it("solo confirma turnos pendientes", async () => {
    const { datos } = await escenario();
    const turno = await confirmarTurno((await solicitarTurno(datos)).id);
    await expect(confirmarTurno(turno.id)).rejects.toThrow("Solo se pueden confirmar turnos pendientes");
  });
});

describe("reprogramar turno", () => {
  it("cambia operativo y horario, anula el recordatorio anterior y programa uno nuevo", async () => {
    const { datos } = await escenario();
    const turno = await confirmarTurno((await solicitarTurno(datos)).id);
    const destino = await crearOperativoPrueba({ diasDesdeHoy: 10 });

    const reprogramado = await reprogramarTurno(turno.id, { operativo_id: destino.id, horario: "11:30" });
    expect(reprogramado).toMatchObject({ operativo_id: destino.id, horario: "11:30", estado: "confirmado" });
    expect(await notificacionesDe(turno.id)).toEqual([
      ["confirmacion", "pendiente"],
      ["recordatorio", "anulado"],
      ["reprogramacion", "pendiente"],
      ["recordatorio", "pendiente"],
    ]);
  });

  it("valida el cupo del operativo de destino", async () => {
    const { datos } = await escenario();
    const turno = await solicitarTurno(datos);
    const destino = await crearOperativoPrueba({ diasDesdeHoy: 10 });
    await destino.update({ cupo_maximo: 1 });
    await crearTurnoPrueba((await crearAnimalPrueba()).id, destino.id);
    await expect(reprogramarTurno(turno.id, { operativo_id: destino.id, horario: "11:00" })).rejects.toThrow(
      "El operativo no tiene cupo disponible",
    );
  });

  it("permite cambiar solo el horario dentro del mismo operativo aunque esté completo", async () => {
    const { operativo, datos } = await escenario();
    await operativo.update({ cupo_maximo: 1 });
    const turno = await solicitarTurno(datos);
    const reprogramado = await reprogramarTurno(turno.id, { operativo_id: operativo.id, horario: "12:00" });
    expect(reprogramado.horario).toBe("12:00");
    await expect(reprogramarTurno(turno.id, { operativo_id: operativo.id, horario: "12:00" })).rejects.toMatchObject({
      campos: { horario: "Indique un horario u operativo distinto del actual" },
    });
  });
});

describe("cancelar turno", () => {
  it("anula el recordatorio y avisa la cancelación con el motivo; no cancela dos veces", async () => {
    const { datos } = await escenario();
    const turno = await confirmarTurno((await solicitarTurno(datos)).id);

    const cancelado = await cancelarTurno(turno.id, { motivo: "El vecino no puede asistir" });
    expect(cancelado).toMatchObject({ estado: "cancelado", motivo_cancelacion: "El vecino no puede asistir" });
    expect(await notificacionesDe(turno.id)).toEqual([
      ["confirmacion", "pendiente"],
      ["recordatorio", "anulado"],
      ["cancelacion", "pendiente"],
    ]);
    const aviso = await Notificacion.findOne({ where: { turno_id: turno.id, tipo: "cancelacion" } });
    expect(aviso!.mensaje).toContain("Motivo: El vecino no puede asistir");

    await expect(cancelarTurno(turno.id, { motivo: "Otra vez" })).rejects.toThrow(
      "No se puede cancelar un turno cancelado",
    );
  });
});

describe("listado de turnos", () => {
  it("filtra por estado y operativo y busca por DNI del tutor", async () => {
    const { operativo, animal, datos } = await escenario();
    await solicitarTurno(datos);
    await crearTurnoPrueba((await crearAnimalPrueba()).id, operativo.id, "cancelado");
    const base = { pagina: 1, tamanio: 10, busqueda: "" };

    expect((await listarTurnos({ ...base, operativo_id: operativo.id })).total).toBe(2);
    expect((await listarTurnos({ ...base, estado: "pendiente" })).filas).toEqual([
      expect.objectContaining({ animal_id: animal.id, zona: "Centro" }),
    ]);
    const tutor = (await Vecino.findByPk(animal.vecino_id!))!;
    expect((await listarTurnos({ ...base, busqueda: tutor.dni })).total).toBe(1);
  });
});
