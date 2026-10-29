import { afterAll, beforeEach, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { Insumo, MovimientoInsumo, sequelize, Usuario, Veterinario } from "@/lib/db";
import { actualizarUsuario, crearUsuario, eliminarUsuario, listarUsuarios } from "@/services/usuarios";
import type { DatosUsuario } from "@/schemas/usuarios";
import { reiniciarDatos } from "../helpers/bd";
import { adminSemilla, crearUsuarioPrueba, sesionDe } from "../helpers/fabricas";

beforeEach(reiniciarDatos);
afterAll(() => sequelize.close());

const datosValidos: DatosUsuario = {
  nombre: "María", apellido: "López", email: "Maria.Lopez@Prueba.local",
  password: "Segura123", rol: "operador", activo: true,
};

describe("crear usuario", () => {
  it("guarda el email en minúsculas y la contraseña hasheada", async () => {
    const creado = await crearUsuario(datosValidos);
    const guardado = await Usuario.scope("conPassword").findByPk(creado.id);
    expect(creado).toMatchObject({ email: "maria.lopez@prueba.local", rol: "operador", activo: true });
    expect(await bcrypt.compare("Segura123", guardado!.password_hash)).toBe(true);
    expect(creado).not.toHaveProperty("password_hash");
  });

  it("rechaza un email repetido indicando el campo", async () => {
    await crearUsuario(datosValidos);
    await expect(crearUsuario({ ...datosValidos, email: "maria.lopez@prueba.local" })).rejects.toMatchObject({
      estado: 400,
      campos: { email: "Ya existe un usuario con ese email" },
    });
  });
});

describe("listar usuarios", () => {
  it("busca por apellido o email y pagina el resultado", async () => {
    await crearUsuario(datosValidos);
    await crearUsuario({ ...datosValidos, apellido: "Gómez", email: "gomez@prueba.local" });

    const porApellido = await listarUsuarios({ pagina: 1, tamanio: 10, busqueda: "lóp" });
    expect(porApellido.filas.map((u) => u.apellido)).toEqual(["López"]);

    const pagina = await listarUsuarios({ pagina: 1, tamanio: 2, busqueda: "" });
    expect(pagina.total).toBe(3); // admin semilla + 2 creados
    expect(pagina.filas).toHaveLength(2);
  });
});

describe("actualizar usuario", () => {
  it("conserva la contraseña si se envía vacía", async () => {
    const creado = await crearUsuario(datosValidos);
    const admin = await adminSemilla();
    await actualizarUsuario(creado.id, { ...datosValidos, nombre: "María José", password: "" }, sesionDe(admin, "administrador"));
    const guardado = await Usuario.scope("conPassword").findByPk(creado.id);
    expect(guardado!.nombre).toBe("María José");
    expect(await bcrypt.compare("Segura123", guardado!.password_hash)).toBe(true);
  });

  it("impide que un usuario se desactive o cambie su propio rol", async () => {
    const admin = await adminSemilla();
    const propios = { nombre: admin.nombre, apellido: admin.apellido, email: admin.email, password: "" };
    await expect(
      actualizarUsuario(admin.id, { ...propios, rol: "administrador", activo: false }, sesionDe(admin, "administrador")),
    ).rejects.toThrow("su propio usuario");
    await expect(
      actualizarUsuario(admin.id, { ...propios, rol: "operador", activo: true }, sesionDe(admin, "administrador")),
    ).rejects.toThrow("su propio usuario");
  });

  it("impide dejar el sistema sin administradores activos", async () => {
    const admin = await adminSemilla();
    const otro = await crearUsuarioPrueba({ rol: "operador" });
    await expect(
      actualizarUsuario(
        admin.id,
        { nombre: admin.nombre, apellido: admin.apellido, email: admin.email, password: "", rol: "operador", activo: true },
        sesionDe(otro, "operador"),
      ),
    ).rejects.toThrow("al menos un administrador activo");
  });

  it("impide quitar el rol veterinario a un usuario vinculado a personal", async () => {
    const admin = await adminSemilla();
    const vet = await crearUsuarioPrueba({ rol: "veterinario" });
    await Veterinario.create({ tipo: "veterinario", nombre: "Luis", apellido: "Gómez", matricula: "MV-100", usuario_id: vet.id });
    await expect(
      actualizarUsuario(
        vet.id,
        { nombre: vet.nombre, apellido: vet.apellido, email: vet.email, password: "", rol: "operador", activo: true },
        sesionDe(admin, "administrador"),
      ),
    ).rejects.toThrow("vinculado al personal");
  });
});

describe("eliminar usuario", () => {
  it("borra físicamente a un usuario sin registros asociados", async () => {
    const admin = await adminSemilla();
    const usuario = await crearUsuarioPrueba();
    expect(await eliminarUsuario(usuario.id, sesionDe(admin, "administrador"))).toEqual({ resultado: "eliminado" });
    expect(await Usuario.findByPk(usuario.id)).toBeNull();
  });

  it("desactiva (no borra) a un usuario con movimientos de stock", async () => {
    const admin = await adminSemilla();
    const usuario = await crearUsuarioPrueba();
    const insumo = await Insumo.create({ nombre: "Ketamina", unidad: "ml", stock_actual: "10" });
    await MovimientoInsumo.create({ tipo: "ingreso", cantidad: "10", insumo_id: insumo.id, usuario_id: usuario.id });

    expect(await eliminarUsuario(usuario.id, sesionDe(admin, "administrador"))).toEqual({ resultado: "desactivado" });
    expect((await Usuario.findByPk(usuario.id))!.activo).toBe(false);
  });

  it("impide que un usuario se elimine a sí mismo", async () => {
    const admin = await adminSemilla();
    await expect(eliminarUsuario(admin.id, sesionDe(admin, "administrador"))).rejects.toThrow("su propio usuario");
  });

  it("informa 404 si el usuario no existe", async () => {
    const admin = await adminSemilla();
    await expect(eliminarUsuario(9999, sesionDe(admin, "administrador"))).rejects.toMatchObject({ estado: 404 });
  });
});
