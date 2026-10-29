import { describe, expect, it } from "vitest";
import {
  formatearMes, instanteLocal, limitesDelRango, mesesDelRango, partesLocales, rangoUltimosMeses,
} from "@/lib/fechas";
import { porcentaje, promedioDeTexto } from "@/lib/indicadores";

describe("fechas de la Fase 5", () => {
  it("obtiene la fecha y la hora locales de un instante (UTC−3)", () => {
    expect(partesLocales(instanteLocal("2026-05-10", "23:30"))).toEqual({ fecha: "2026-05-10", hora: "23:30" });
    // 01:15 UTC del 11/05 todavía es 10/05 en Río Grande.
    expect(partesLocales("2026-05-11T01:15:00Z")).toEqual({ fecha: "2026-05-10", hora: "22:15" });
  });

  it("calcula los límites de un rango de días locales completos", () => {
    const { inicio, fin } = limitesDelRango("2026-10-01", "2026-10-31");
    expect(inicio.toISOString()).toBe("2026-10-01T03:00:00.000Z");
    expect(fin.toISOString()).toBe("2026-11-01T03:00:00.000Z");
  });

  it("arma el rango de los últimos meses y la lista de meses, cruzando el año", () => {
    expect(rangoUltimosMeses(12, "2026-10-29")).toEqual({ desde: "2025-11-01", hasta: "2026-10-29" });
    expect(rangoUltimosMeses(1, "2026-03-15")).toEqual({ desde: "2026-03-01", hasta: "2026-03-15" });
    expect(mesesDelRango("2025-11-20", "2026-02-03")).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    expect(mesesDelRango("2026-05-01", "2026-05-31")).toEqual(["2026-05"]);
    expect(formatearMes("2026-01")).toBe("Ene 2026");
  });
});

describe("indicadores", () => {
  it("calcula porcentajes con un decimal y null sin denominador", () => {
    expect(porcentaje(2, 3)).toBe(66.7);
    expect(porcentaje(3, 4)).toBe(75);
    expect(porcentaje(0, 5)).toBe(0);
    expect(porcentaje(0, 0)).toBeNull();
  });

  it("redondea los promedios que devuelve PostgreSQL como texto", () => {
    expect(promedioDeTexto("2.9999999")).toBe(3);
    expect(promedioDeTexto("1.25")).toBe(1.3);
    expect(promedioDeTexto(null)).toBeNull();
  });
});
