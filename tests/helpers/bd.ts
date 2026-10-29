import { QueryTypes, type Transaction } from "sequelize";
import { sequelize } from "@/lib/db";
import { sembrarDatosIniciales } from "../../db/seeders/inicial";

/**
 * Ejecuta el bloque dentro de una transacción que siempre se revierte,
 * de modo que cada test deja la base exactamente como la encontró.
 */
export async function enTransaccionRevertida(bloque: (transaccion: Transaction) => Promise<void>): Promise<void> {
  const transaccion = await sequelize.transaction();
  try {
    await bloque(transaccion);
  } finally {
    await transaccion.rollback();
  }
}

/**
 * Espera que la operación sea rechazada por la base de datos y devuelve el nombre
 * de la restricción violada (CHECK, UNIQUE o FOREIGN KEY) informado por PostgreSQL.
 */
export async function restriccionViolada(operacion: Promise<unknown>): Promise<string | undefined> {
  try {
    await operacion;
  } catch (error) {
    return (error as { parent?: { constraint?: string } }).parent?.constraint;
  }
  throw new Error("Se esperaba que la base de datos rechazara la operación");
}

/**
 * Vacía todas las tablas (reiniciando los identificadores) y vuelve a cargar los datos
 * iniciales. Se usa en `beforeEach` de los tests de servicios, que abren sus propias
 * transacciones y por eso no pueden aislarse con `enTransaccionRevertida`.
 */
export async function reiniciarDatos(): Promise<void> {
  const tablas = await sequelize.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables
     WHERE schemaname = 'public' AND tablename <> 'migraciones_aplicadas'`,
    { type: QueryTypes.SELECT },
  );
  const lista = tablas.map((tabla) => `"${tabla.tablename}"`).join(", ");
  await sequelize.query(`TRUNCATE ${lista} RESTART IDENTITY CASCADE`);
  await sembrarDatosIniciales();
}
