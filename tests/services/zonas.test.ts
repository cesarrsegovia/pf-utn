import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sequelize, Zona } from "@/lib/db";
import { actualizarZona, crearZona, eliminarZona, listarZonas, opcionesZonas } from "@/services/zonas";
import { reiniciarDatos } from "../helpers/bd";
import { crearOperativoPrueba, crearVecinoPrueba } from "../helpers/fabricas";

beforeEach(reiniciarDatos);
afterAll(() => sequelize.close());

describe("crear y editar zonas", () => {
  it("guarda la descripción vacía como nula", async () => {
    const zona = await crearZona({ nombre: "Chacra XIV", descripcion: "" });
    expect(zona).toMatchObject({ nombre: "Chacra XIV", descripcion: null });
  });

  it("rechaza un nombre repetido sin distinguir mayúsculas, indicando el campo", async () => {
    await expect(crearZona({ nombre: "centro", descripcion: "" })).rejects.toMatchObject({
      estado: 400,
      campos: { nombre: "Ya existe una zona con ese nombre" },
    });
  });

  it("permite editar una zona conservando su propio nombre", async () => {
    const zona = await crearZona({ nombre: "Chacra XIV", descripcion: "" });
    const editada = await actualizarZona(zona.id, { nombre: "Chacra XIV", descripcion: "Nueva urbanización" });
    expect(editada.descripcion).toBe("Nueva urbanización");
  });
});

describe("listar zonas", () => {
  it("busca sin distinguir mayúsculas ni tildes y pagina", async () => {
    await crearZona({ nombre: "Barrio Güemes", descripcion: "" });
    const porTilde = await listarZonas({ pagina: 1, tamanio: 10, busqueda: "GUEMES" });
    expect(porTilde.filas.map((zona) => zona.nombre)).toEqual(["Barrio Güemes"]);

    const chacras = await listarZonas({ pagina: 2, tamanio: 3, busqueda: "chacra" });
    expect(chacras.total).toBe(4); // Chacra II, IV, XI y XIII del seed
    expect(chacras.filas).toHaveLength(1);
  });

  it("devuelve todas las zonas como opciones ordenadas por nombre", async () => {
    const opciones = await opcionesZonas();
    expect(opciones).toHaveLength(12);
    expect(opciones[0].etiqueta).toBe("Aeropuerto");
  });
});

describe("eliminar zonas", () => {
  it("no elimina una zona con vecinos u operativos e informa cuántos tiene", async () => {
    const zona = await crearZona({ nombre: "Chacra XIV", descripcion: "" });
    await crearVecinoPrueba({ zonaId: zona.id });
    await crearOperativoPrueba({ zonaId: zona.id });
    await expect(eliminarZona(zona.id)).rejects.toThrow("1 vecino y 1 operativo");
  });

  it("elimina una zona sin registros asociados", async () => {
    const zona = await crearZona({ nombre: "Chacra XIV", descripcion: "" });
    await eliminarZona(zona.id);
    expect(await Zona.findByPk(zona.id)).toBeNull();
  });
});
