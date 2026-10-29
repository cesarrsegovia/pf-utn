import { describe, expect, it } from "vitest";
import { tienePermiso } from "@/lib/permisos";

describe("matriz de permisos (spec §4)", () => {
  it("solo el administrador gestiona usuarios", () => {
    expect(tienePermiso("administrador", "usuarios:gestionar")).toBe(true);
    expect(tienePermiso("operador", "usuarios:gestionar")).toBe(false);
    expect(tienePermiso("veterinario", "usuarios:gestionar")).toBe(false);
  });

  it("solo el administrador cancela operativos", () => {
    expect(tienePermiso("administrador", "operativos:cancelar")).toBe(true);
    expect(tienePermiso("operador", "operativos:cancelar")).toBe(false);
  });

  it("solo el veterinario registra procedimientos", () => {
    expect(tienePermiso("veterinario", "procedimientos:registrar")).toBe(true);
    expect(tienePermiso("administrador", "procedimientos:registrar")).toBe(false);
    expect(tienePermiso("operador", "procedimientos:registrar")).toBe(false);
  });

  it("el veterinario solo consulta vecinos y no accede a reportes", () => {
    expect(tienePermiso("veterinario", "vecinos:ver")).toBe(true);
    expect(tienePermiso("veterinario", "vecinos:gestionar")).toBe(false);
    expect(tienePermiso("veterinario", "reportes:ver")).toBe(false);
  });

  it("el operador ve zonas pero no las gestiona", () => {
    expect(tienePermiso("operador", "zonas:ver")).toBe(true);
    expect(tienePermiso("operador", "zonas:gestionar")).toBe(false);
  });
});
