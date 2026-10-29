import { describe, expect, it } from "vitest";
import { tipoIncluido } from "@/lib/constantes";

describe("tipo realizado incluido en el solicitado (F7)", () => {
  it("acepta lo pedido o una parte de lo pedido, nunca algo no pedido", () => {
    expect(tipoIncluido("castracion", "castracion_y_chipeo")).toBe(true);
    expect(tipoIncluido("chipeo", "castracion_y_chipeo")).toBe(true);
    expect(tipoIncluido("castracion_y_chipeo", "castracion_y_chipeo")).toBe(true);
    expect(tipoIncluido("castracion", "castracion")).toBe(true);
    expect(tipoIncluido("chipeo", "castracion")).toBe(false);
    expect(tipoIncluido("castracion_y_chipeo", "chipeo")).toBe(false);
  });
});
