import type { Transaction } from "sequelize";
import { sequelize } from "@/lib/db";

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
