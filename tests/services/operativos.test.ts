import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { MOTIVOS_CANCELACION } from "@/lib/constantes";
import { Notificacion, sequelize, Turno } from "@/lib/db";
import { hoyLocal, sumarDias } from "@/lib/fechas";
import type { DatosOperativo } from "@/schemas/operativos";
import { opcionesAnimales } from "@/services/animales";
import {
  actualizarOperativo, asignarPersonal, cambiarEstadoOperativo, cancelarOperativo, crearOperativo,
  listarOperativos, opcionesOperativos, quitarPersonal,
} from "@/services/operativos";
import { opcionesPersonal } from "@/services/personal";
import { confirmarTurno } from "@/services/turnos";
import { reiniciarDatos } from "../helpers/bd";
import {
  adminSemilla, crearAnimalPrueba, crearOperativoPrueba, crearPersonalPrueba, crearTurnoPrueba,
  crearVecinoPrueba, zonaSemilla,
} from "../helpers/fabricas";

beforeEach(reiniciarDatos);
afterAll(() => sequelize.close());

/** Datos válidos de un operativo a 7 días en la zona Centro. */
async function datosOperativo(cambios: Partial<DatosOperativo> = {}): Promise<DatosOperativo> {
  return {
    fecha: sumarDias(hoyLocal(), 7),
    hora_inicio: "09:00",
    hora_fin: "13:00",
    lugar: "SUM municipal",
    cupo_maximo: 10,
    zona_id: (await zonaSemilla()).id,
    ...cambios,
  };
}

/** Crea un turno de un animal nuevo con tutor en el operativo indicado. */
async function turnoEn(operativoId: number, estado: Parameters<typeof crearTurnoPrueba>[2] = "pendiente") {
  return crearTurnoPrueba((await crearAnimalPrueba()).id, operativoId, estado);
}

describe("alta, listado y edición (F4)", () => {
  it("crea un operativo programado con su cupo disponible", async () => {
    const operativo = await crearOperativo(await datosOperativo());
    expect(operativo).toMatchObject({
      estado: "programado", hora_inicio: "09:00", hora_fin: "13:00", cupo_maximo: 10,
      ocupados: 0, disponibles: 10, zona: "Centro", personal: [],
    });
  });

  it("rechaza fechas pasadas", async () => {
    await expect(crearOperativo(await datosOperativo({ fecha: sumarDias(hoyLocal(), -1) }))).rejects.toMatchObject({
      campos: { fecha: "La fecha y hora de inicio deben ser futuras" },
    });
  });

  it("calcula el cupo ocupado sin contar los turnos cancelados", async () => {
    const operativo = await crearOperativoPrueba();
    await turnoEn(operativo.id, "pendiente");
    await turnoEn(operativo.id, "cancelado");
    const { filas } = await listarOperativos({ pagina: 1, tamanio: 10, busqueda: "", periodo: "proximos" });
    expect(filas).toEqual([expect.objectContaining({ id: operativo.id, ocupados: 1, disponibles: 19 })]);
    expect(await opcionesOperativos()).toEqual([expect.objectContaining({ id: operativo.id })]);
  });

  it("no deja el cupo por debajo de los turnos ocupados", async () => {
    const operativo = await crearOperativoPrueba();
    await turnoEn(operativo.id);
    await turnoEn(operativo.id);
    await expect(
      actualizarOperativo(operativo.id, await datosOperativo({ fecha: operativo.fecha, cupo_maximo: 1 })),
    ).rejects.toMatchObject({ campos: { cupo_maximo: "No puede ser menor a los 2 turnos ya asignados" } });
  });

  it("si cambia la fecha avisa la reprogramación y recalcula los recordatorios", async () => {
    const operativo = await crearOperativoPrueba();
    const turno = await turnoEn(operativo.id);
    await confirmarTurno(turno.id);

    await actualizarOperativo(operativo.id, await datosOperativo({ fecha: sumarDias(hoyLocal(), 8), cupo_maximo: 20 }));
    const notificaciones = await Notificacion.findAll({ where: { turno_id: turno.id }, order: [["id", "ASC"]] });
    expect(notificaciones.map((n) => [n.tipo, n.estado_envio])).toEqual([
      ["confirmacion", "pendiente"],
      ["recordatorio", "anulado"],
      ["reprogramacion", "pendiente"],
      ["recordatorio", "pendiente"],
    ]);
  });

  it("rechaza un horario que deja turnos afuera y la edición de operativos realizados", async () => {
    const operativo = await crearOperativoPrueba();
    await turnoEn(operativo.id); // turno a las 09:30
    await expect(
      actualizarOperativo(operativo.id, await datosOperativo({ fecha: operativo.fecha, hora_inicio: "10:00", cupo_maximo: 20 })),
    ).rejects.toThrow("1 turno quedaría fuera del nuevo horario");

    await operativo.update({ estado: "realizado" });
    await expect(actualizarOperativo(operativo.id, await datosOperativo({ fecha: operativo.fecha }))).rejects.toThrow(
      "No se puede editar un operativo realizado",
    );
  });
});

describe("personal asignado", () => {
  it("asigna y quita personal activo, sin repetir", async () => {
    const operativo = await crearOperativoPrueba();
    const veterinario = await crearPersonalPrueba();

    const detalle = await asignarPersonal(operativo.id, { veterinario_id: veterinario.id });
    expect(detalle.personal).toEqual([expect.objectContaining({ id: veterinario.id, tipo: "veterinario" })]);
    await expect(asignarPersonal(operativo.id, { veterinario_id: veterinario.id })).rejects.toMatchObject({
      campos: { veterinario_id: "Ya está asignado a este operativo" },
    });
    expect((await quitarPersonal(operativo.id, { veterinario_id: veterinario.id })).personal).toEqual([]);
  });

  it("rechaza personal inactivo y lo excluye de las opciones", async () => {
    const operativo = await crearOperativoPrueba();
    const inactivo = await crearPersonalPrueba({ activo: false });
    await expect(asignarPersonal(operativo.id, { veterinario_id: inactivo.id })).rejects.toMatchObject({
      campos: { veterinario_id: "Solo se puede asignar personal activo" },
    });
    expect(await opcionesPersonal()).toEqual([]);
  });

  it("rechaza la superposición horaria el mismo día; las franjas contiguas se permiten", async () => {
    const veterinario = await crearPersonalPrueba();
    const manana = await crearOperativoPrueba(); // 09:00 a 13:00
    const superpuesto = await crearOperativoPrueba(); // misma franja y día
    await asignarPersonal(manana.id, { veterinario_id: veterinario.id });
    await expect(asignarPersonal(superpuesto.id, { veterinario_id: veterinario.id })).rejects.toThrow(
      "ya está asignado a otro operativo",
    );

    await superpuesto.update({ hora_inicio: "13:00", hora_fin: "15:00" });
    await expect(asignarPersonal(superpuesto.id, { veterinario_id: veterinario.id })).resolves.toBeDefined();
  });
});

describe("cancelación (F4)", () => {
  it("exige 48 h de anticipación salvo fuerza mayor", async () => {
    const admin = await adminSemilla();
    const operativo = await crearOperativoPrueba({ diasDesdeHoy: 1 });
    await expect(
      cancelarOperativo(operativo.id, { motivo: "Lluvia", fuerza_mayor: false }, admin.id),
    ).rejects.toThrow("Faltan menos de 48 h");
    await expect(
      cancelarOperativo(operativo.id, { motivo: "Temporal de nieve: rutas cortadas", fuerza_mayor: true }, admin.id),
    ).resolves.toEqual({ turnosCancelados: 0 });
  });

  it("con más de 48 h no requiere fuerza mayor", async () => {
    const admin = await adminSemilla();
    const operativo = await crearOperativoPrueba({ diasDesdeHoy: 3 });
    await expect(
      cancelarOperativo(operativo.id, { motivo: "Reasignación de personal", fuerza_mayor: false }, admin.id),
    ).resolves.toEqual({ turnosCancelados: 0 });
  });

  it("no cancela un operativo que ya comenzó ni uno en curso", async () => {
    const admin = await adminSemilla();
    const ayer = await crearOperativoPrueba({ diasDesdeHoy: -1 });
    await expect(cancelarOperativo(ayer.id, { motivo: "Tarde", fuerza_mayor: true }, admin.id)).rejects.toThrow(
      "El operativo ya comenzó",
    );
    const enCurso = await crearOperativoPrueba({ diasDesdeHoy: 0, estado: "en_curso" });
    await expect(cancelarOperativo(enCurso.id, { motivo: "Tarde", fuerza_mayor: true }, admin.id)).rejects.toThrow(
      "No se puede cancelar un operativo en curso",
    );
  });

  it("cancela en cascada los turnos activos, anula recordatorios y avisa a los vecinos con correo", async () => {
    const admin = await adminSemilla();
    const operativo = await crearOperativoPrueba({ diasDesdeHoy: 5 });
    const confirmado = await turnoEn(operativo.id);
    await confirmarTurno(confirmado.id);
    await turnoEn(operativo.id);
    await crearTurnoPrueba((await crearAnimalPrueba({ vecinoId: null })).id, operativo.id); // callejero: sin aviso

    const resultado = await cancelarOperativo(operativo.id, { motivo: "Falta de insumos", fuerza_mayor: false }, admin.id);
    expect(resultado).toEqual({ turnosCancelados: 3 });

    await operativo.reload();
    expect(operativo.estado).toBe("cancelado");
    expect(operativo.motivo_cancelacion).toBe("Falta de insumos");
    expect(operativo.usuario_cancelacion_id).toBe(admin.id);
    expect(operativo.fecha_cancelacion).not.toBeNull();

    const turnos = await Turno.findAll({ where: { operativo_id: operativo.id } });
    expect(turnos.map((t) => [t.estado, t.motivo_cancelacion])).toEqual(
      Array(3).fill(["cancelado", MOTIVOS_CANCELACION.operativoCancelado]),
    );
    expect(await Notificacion.count({ where: { tipo: "recordatorio", estado_envio: "pendiente" } })).toBe(0);
    expect(await Notificacion.count({ where: { tipo: "cancelacion" } })).toBe(2);
  });
});

describe("cambios de estado", () => {
  it("solo inicia el operativo el día programado", async () => {
    const futuro = await crearOperativoPrueba({ diasDesdeHoy: 7 });
    await expect(cambiarEstadoOperativo(futuro.id, { estado: "en_curso" })).rejects.toThrow(
      "solo se puede iniciar el día programado",
    );
    const deHoy = await crearOperativoPrueba({ diasDesdeHoy: 0 });
    await expect(cambiarEstadoOperativo(deHoy.id, { estado: "en_curso" })).resolves.toEqual({ turnosCancelados: 0 });
    await expect(cambiarEstadoOperativo(deHoy.id, { estado: "en_curso" })).rejects.toThrow(
      "Solo se puede iniciar un operativo programado",
    );
  });

  it("al finalizar cancela con 'No se presentó' los turnos que siguen activos, sin enviar avisos", async () => {
    const operativo = await crearOperativoPrueba({ diasDesdeHoy: 0, estado: "en_curso" });
    const ausente = await turnoEn(operativo.id, "confirmado");
    const atendido = await turnoEn(operativo.id, "completado");

    expect(await cambiarEstadoOperativo(operativo.id, { estado: "realizado" })).toEqual({ turnosCancelados: 1 });
    await ausente.reload();
    expect([ausente.estado, ausente.motivo_cancelacion]).toEqual(["cancelado", MOTIVOS_CANCELACION.noSePresento]);
    await atendido.reload();
    expect(atendido.estado).toBe("completado");
    expect(await Notificacion.count()).toBe(0);
  });
});

describe("opciones para el formulario de turnos", () => {
  it("ofrece animales sin tutor o con tutor activo", async () => {
    const callejero = await crearAnimalPrueba({ vecinoId: null });
    const conTutor = await crearAnimalPrueba();
    await crearAnimalPrueba({ vecinoId: (await crearVecinoPrueba({ activo: false })).id });
    const ids = (await opcionesAnimales()).map((opcion) => opcion.id).sort((a, b) => a - b);
    expect(ids).toEqual([callejero.id, conTutor.id].sort((a, b) => a - b));
  });
});
