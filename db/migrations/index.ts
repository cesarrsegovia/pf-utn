import type { Sequelize } from "sequelize";
import { esquemaInicial } from "./0001-esquema-inicial";

/** Contrato que cumple cada archivo de migración. */
export interface Migracion {
  nombre: string;
  up: (sequelize: Sequelize) => Promise<void>;
  down: (sequelize: Sequelize) => Promise<void>;
}

/**
 * Migraciones en orden de aplicación. Se listan explícitamente (en lugar de buscar
 * archivos por patrón) para que funcionen igual con tsx, Vitest y Next.js.
 */
export const migraciones: Migracion[] = [esquemaInicial];
