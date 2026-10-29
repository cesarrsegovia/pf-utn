import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { firmarSesion, verificarSesion } from "@/lib/auth";
import { sequelize } from "@/lib/db";
import { autenticar } from "@/services/auth";
import { reiniciarDatos } from "../helpers/bd";
import { crearUsuarioPrueba, PASSWORD_PRUEBA } from "../helpers/fabricas";

beforeEach(reiniciarDatos);
afterAll(() => sequelize.close());

describe("autenticación", () => {
  it("autentica con email (sin distinguir mayúsculas) y contraseña correctos", async () => {
    const usuario = await crearUsuarioPrueba({ rol: "veterinario", email: "vet@prueba.local" });
    const sesion = await autenticar("VET@prueba.local", PASSWORD_PRUEBA);
    expect(sesion).toEqual({ usuarioId: usuario.id, nombre: `Usuario ${usuario.apellido}`, rol: "veterinario" });
  });

  it("rechaza una contraseña incorrecta con mensaje genérico", async () => {
    await crearUsuarioPrueba({ email: "op@prueba.local" });
    await expect(autenticar("op@prueba.local", "otra-clave")).rejects.toThrow("Email o contraseña incorrectos");
  });

  it("rechaza un email inexistente con el mismo mensaje genérico", async () => {
    await expect(autenticar("nadie@prueba.local", PASSWORD_PRUEBA)).rejects.toThrow("Email o contraseña incorrectos");
  });

  it("rechaza a un usuario inactivo", async () => {
    await crearUsuarioPrueba({ email: "inactivo@prueba.local", activo: false });
    await expect(autenticar("inactivo@prueba.local", PASSWORD_PRUEBA)).rejects.toThrow("inactivo");
  });

  it("el token firmado se verifica y uno alterado se rechaza", async () => {
    const token = await firmarSesion({ usuarioId: 7, nombre: "Ana Pérez", rol: "operador" });
    expect(await verificarSesion(token)).toEqual({ usuarioId: 7, nombre: "Ana Pérez", rol: "operador" });
    expect(await verificarSesion(`${token}x`)).toBeNull();
    expect(await verificarSesion(undefined)).toBeNull();
  });
});
