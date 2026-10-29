import { describe, expect, it } from "vitest";
import { esTurnoActivo, incluyeCastracion, incluyeChipeo } from "@/lib/constantes";
import { nombreAnimal } from "@/lib/etiquetas";
import { horaCorta, instanteLocal } from "@/lib/fechas";
import { horaValida } from "@/schemas/comun";

describe("fechas y horas locales", () => {
  it("recorta los segundos que devuelve PostgreSQL en las columnas TIME", () => {
    expect(horaCorta("09:30:00")).toBe("09:30");
    expect(horaCorta("09:30")).toBe("09:30");
  });

  it("interpreta fecha y hora en Río Grande (UTC-3) sin depender del servidor", () => {
    expect(instanteLocal("2026-11-05", "09:30:00").toISOString()).toBe("2026-11-05T12:30:00.000Z");
    expect(instanteLocal("2026-12-31", "22:00").toISOString()).toBe("2027-01-01T01:00:00.000Z");
  });

  it("valida horas HH:MM", () => {
    expect(horaValida.safeParse("09:05").success).toBe(true);
    expect(horaValida.safeParse("24:00").success).toBe(false);
    expect(horaValida.safeParse("9:05").success).toBe(false);
  });
});

describe("reglas de dominio", () => {
  it("desglosa el tipo de procedimiento", () => {
    expect([incluyeCastracion("castracion"), incluyeChipeo("castracion")]).toEqual([true, false]);
    expect([incluyeCastracion("chipeo"), incluyeChipeo("chipeo")]).toEqual([false, true]);
    expect([incluyeCastracion("castracion_y_chipeo"), incluyeChipeo("castracion_y_chipeo")]).toEqual([true, true]);
  });

  it("considera activos solo los turnos pendientes o confirmados", () => {
    expect(["pendiente", "confirmado", "completado", "cancelado"].map((e) => esTurnoActivo(e as never))).toEqual([
      true, true, false, false,
    ]);
  });

  it("nombra a los animales sin nombre por su número", () => {
    expect(nombreAnimal({ id: 7, nombre: "Toby" })).toBe("Toby");
    expect(nombreAnimal({ id: 7, nombre: null })).toBe("Animal #7");
  });
});
