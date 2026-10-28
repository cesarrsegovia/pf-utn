import { afterAll, describe, expect, it } from "vitest";
import { Rol, sequelize, Usuario, Zona } from "@/lib/db";

afterAll(() => sequelize.close());

// La base de test se reinicia con `db:reset:test`, que ejecuta el seed inicial.
describe("seed inicial", () => {
  it("carga los tres roles", async () => {
    const roles = await Rol.findAll({ order: [["nombre", "ASC"]] });
    expect(roles.map((rol) => rol.nombre)).toEqual(["administrador", "operador", "veterinario"]);
  });

  it("crea el administrador inicial con la contraseña hasheada", async () => {
    const admin = await Usuario.scope("conPassword").findOne({
      where: { email: process.env.SEED_ADMIN_EMAIL },
      include: ["rol"],
    });
    expect(admin?.rol?.nombre).toBe("administrador");
    expect(admin?.password_hash).toMatch(/^\$2[aby]\$/);
  });

  it("carga las zonas de Río Grande", async () => {
    expect(await Zona.count()).toBeGreaterThanOrEqual(10);
  });
});
