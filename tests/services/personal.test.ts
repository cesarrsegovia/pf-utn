import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { OperativoVeterinario, sequelize, Veterinario } from "@/lib/db";
import type { DatosPersonal } from "@/schemas/personal";
import {
  actualizarPersonal, crearPersonal, eliminarPersonal, listarPersonal, opcionesUsuariosVinculables,
} from "@/services/personal";
import { reiniciarDatos } from "../helpers/bd";
import { crearOperativoPrueba, crearUsuarioPrueba } from "../helpers/fabricas";

beforeEach(reiniciarDatos);
afterAll(() => sequelize.close());

const veterinaria: DatosPersonal = {
  tipo: "veterinario", nombre: "Laura", apellido: "Díaz", matricula: "MV-1234",
  especialidad: "", telefono: "", activo: true, usuario_id: null,
};
const auxiliar: DatosPersonal = { ...veterinaria, tipo: "auxiliar", nombre: "Pablo", apellido: "Ruiz", matricula: "" };

/** Asigna al integrante del personal a un operativo nuevo creado con las opciones indicadas. */
async function asignarAOperativo(veterinarioId: number, opciones: Parameters<typeof crearOperativoPrueba>[0]) {
  const operativo = await crearOperativoPrueba(opciones);
  await OperativoVeterinario.create({ operativo_id: operativo.id, veterinario_id: veterinarioId });
}

describe("crear personal", () => {
  it("guarda los opcionales vacíos como nulos y rechaza una matrícula repetida", async () => {
    const creado = await crearPersonal(veterinaria);
    expect(creado).toMatchObject({ matricula: "MV-1234", especialidad: null, telefono: null, usuario: null });
    await expect(crearPersonal({ ...veterinaria, nombre: "Otra", matricula: "mv-1234" })).rejects.toMatchObject({
      estado: 400,
      campos: { matricula: "Ya existe personal con esa matrícula" },
    });
  });

  it("vincula solo usuarios activos con rol veterinario y no vinculados a otro integrante", async () => {
    const operador = await crearUsuarioPrueba({ rol: "operador" });
    await expect(crearPersonal({ ...veterinaria, usuario_id: operador.id })).rejects.toMatchObject({
      campos: { usuario_id: "Seleccione un usuario activo con rol veterinario" },
    });

    const usuarioVet = await crearUsuarioPrueba({ rol: "veterinario" });
    const creado = await crearPersonal({ ...veterinaria, usuario_id: usuarioVet.id });
    expect(creado.usuario).toBe(usuarioVet.email);
    await expect(crearPersonal({ ...auxiliar, usuario_id: usuarioVet.id })).rejects.toMatchObject({
      campos: { usuario_id: "Ese usuario ya está vinculado a otro integrante del personal" },
    });
  });
});

describe("opciones y listado", () => {
  it("ofrece los usuarios veterinarios libres más el vinculado al registro en edición", async () => {
    const libre = await crearUsuarioPrueba({ rol: "veterinario" });
    const vinculado = await crearUsuarioPrueba({ rol: "veterinario" });
    const personal = await crearPersonal({ ...veterinaria, usuario_id: vinculado.id });

    const paraAlta = await opcionesUsuariosVinculables();
    expect(paraAlta.map((opcion) => opcion.id)).toEqual([libre.id]);

    const paraEdicion = await opcionesUsuariosVinculables(personal.id);
    expect(paraEdicion.map((opcion) => opcion.id).sort()).toEqual([libre.id, vinculado.id].sort());
  });

  it("filtra por tipo y por estado", async () => {
    await crearPersonal(veterinaria);
    await crearPersonal({ ...auxiliar, activo: false });

    const activos = await listarPersonal({ pagina: 1, tamanio: 10, busqueda: "", estado: "activos" });
    expect(activos.filas.map((p) => p.apellido)).toEqual(["Díaz"]);

    const auxiliares = await listarPersonal({ pagina: 1, tamanio: 10, busqueda: "", estado: "todos", tipo: "auxiliar" });
    expect(auxiliares.filas.map((p) => p.apellido)).toEqual(["Ruiz"]);
  });
});

describe("baja de personal", () => {
  it("elimina físicamente a quien no tiene historial", async () => {
    const creado = await crearPersonal(auxiliar);
    expect(await eliminarPersonal(creado.id)).toEqual({ resultado: "eliminado" });
    expect(await Veterinario.findByPk(creado.id)).toBeNull();
  });

  it("desactiva en lugar de eliminar a quien participó de un operativo pasado", async () => {
    const creado = await crearPersonal(veterinaria);
    await asignarAOperativo(creado.id, { diasDesdeHoy: -10, estado: "realizado" });
    expect(await eliminarPersonal(creado.id)).toEqual({ resultado: "desactivado" });
    expect((await Veterinario.findByPk(creado.id))!.activo).toBe(false);
  });

  it("no elimina ni desactiva a quien está asignado a un operativo programado", async () => {
    const creado = await crearPersonal(veterinaria);
    await asignarAOperativo(creado.id, { diasDesdeHoy: 5 });
    await expect(eliminarPersonal(creado.id)).rejects.toThrow("operativo programado o en curso");
    await expect(actualizarPersonal(creado.id, { ...veterinaria, activo: false })).rejects.toThrow(
      "operativo programado o en curso",
    );
  });
});
