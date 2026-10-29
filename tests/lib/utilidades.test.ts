import { describe, expect, it } from "vitest";
import { aCentesimos, deCentesimos, formatearCantidad } from "@/lib/cantidades";
import { formatearFecha, sumarDias } from "@/lib/fechas";
import { escaparLike, normalizarTexto } from "@/lib/texto";

describe("texto", () => {
  it("normaliza a minúsculas sin tildes", () => {
    expect(normalizarTexto("Pérez ÁLVAREZ Güemes")).toBe("perez alvarez guemes");
  });

  it("escapa los comodines de LIKE", () => {
    expect(escaparLike("50%_a\\b")).toBe("50\\%\\_a\\\\b");
  });
});

describe("fechas", () => {
  it("suma días cruzando meses y años", () => {
    expect(sumarDias("2026-12-30", 3)).toBe("2027-01-02");
    expect(sumarDias("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("formatea una fecha YYYY-MM-DD como DD/MM/AAAA", () => {
    expect(formatearFecha("2026-11-05")).toBe("05/11/2026");
  });
});

describe("cantidades", () => {
  it("opera en centésimos sin errores de coma flotante", () => {
    expect(aCentesimos("0.10") + aCentesimos(0.2)).toBe(30);
    expect(deCentesimos(aCentesimos("12.25") - aCentesimos(0.75))).toBe("11.50");
  });

  it("formatea con coma decimal y unidad", () => {
    expect(formatearCantidad("2", "ml")).toBe("2,00 ml");
    expect(formatearCantidad(1234.5)).toBe("1.234,50");
  });
});
