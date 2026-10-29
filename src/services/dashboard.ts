import { Op } from "sequelize";
import type { DatosSesion } from "@/lib/auth";
import { Animal, Vecino, Veterinario } from "@/lib/db";
import type { ResultadoPaginado } from "@/schemas/comun";
import { listarAvistamientos, type AvistamientoDto } from "./avistamientos";
import { listarInsumos, type InsumoDto } from "./insumos";
import { proximosOperativosConCupo, type OperativoDto } from "./operativos";
import { listarTurnosDelDia, type TurnoDto } from "./turnos";

/** Cantidad de elementos de cada lista del dashboard. */
const LIMITE_LISTAS = 5;

/** Totales generales del programa. */
export interface TotalesDashboard {
  vecinos_activos: number;
  animales: number;
  castrados: number;
  chipeados: number;
}

/**
 * Contenido del inicio según el rol. Administrador y operador ven el panorama completo;
 * el veterinario ve solo sus turnos del día (spec §4).
 */
export type ResumenDashboard =
  | {
      tipo: "general";
      totales: TotalesDashboard;
      proximos_operativos: OperativoDto[];
      turnos_hoy: TurnoDto[];
      /** Primeros insumos con stock en o por debajo del mínimo; `total` indica cuántos hay. */
      insumos_bajo_minimo: ResultadoPaginado<InsumoDto>;
      /** Avistamientos pendientes más recientes; `total` indica cuántos hay. */
      avistamientos_pendientes: ResultadoPaginado<AvistamientoDto>;
    }
  | {
      tipo: "veterinario";
      turnos_hoy: TurnoDto[];
      /** Motivo por el que no se pueden mostrar turnos (usuario sin vínculo con el personal). */
      motivo: string | null;
    };

/** Totales de vecinos activos y de animales (castrados y chipeados). */
async function totales(): Promise<TotalesDashboard> {
  const [vecinosActivos, animales, castrados, chipeados] = await Promise.all([
    Vecino.count({ where: { activo: true } }),
    Animal.count(),
    Animal.count({ where: { castrado: true } }),
    Animal.count({ where: { numero_chip: { [Op.ne]: null } } }),
  ]);
  return { vecinos_activos: vecinosActivos, animales, castrados, chipeados };
}

/** Turnos del día del veterinario en sesión (los de los operativos a los que está asignado). */
async function resumenVeterinario(usuarioId: number): Promise<ResumenDashboard> {
  const personal = await Veterinario.findOne({ where: { usuario_id: usuarioId } });
  if (!personal) {
    return {
      tipo: "veterinario",
      turnos_hoy: [],
      motivo: "Su usuario no está vinculado a ningún integrante del personal: pida al administrador que lo vincule",
    };
  }
  return { tipo: "veterinario", turnos_hoy: await listarTurnosDelDia(personal.id), motivo: null };
}

/** Arma el contenido del inicio para el usuario en sesión, reutilizando los servicios de cada módulo. */
export async function resumenDashboard(sesion: DatosSesion): Promise<ResumenDashboard> {
  if (sesion.rol === "veterinario") {
    return resumenVeterinario(sesion.usuarioId);
  }
  const primeros = { pagina: 1, tamanio: LIMITE_LISTAS, busqueda: "" };
  const [totalesGenerales, proximos, turnosHoy, insumos, avistamientos] = await Promise.all([
    totales(),
    proximosOperativosConCupo(LIMITE_LISTAS),
    listarTurnosDelDia(),
    listarInsumos({ ...primeros, stock: "bajo_minimo" }),
    listarAvistamientos({ ...primeros, estado: "pendiente" }),
  ]);
  return {
    tipo: "general",
    totales: totalesGenerales,
    proximos_operativos: proximos,
    turnos_hoy: turnosHoy,
    insumos_bajo_minimo: insumos,
    avistamientos_pendientes: avistamientos,
  };
}
