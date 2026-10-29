import { DataTypes, Model, type InferAttributes, type InferCreationAttributes, type NonAttribute } from "sequelize";
import { sequelize } from "@/lib/conexion";
import type { Insumo } from "./insumo";

/** Tabla intermedia N:M: insumos y cantidades usadas en cada procedimiento (F6/F7). */
export class ProcedimientoInsumo extends Model<
  InferAttributes<ProcedimientoInsumo>,
  InferCreationAttributes<ProcedimientoInsumo>
> {
  declare procedimiento_id: number;
  declare insumo_id: number;
  declare cantidad_usada: string;

  declare insumo?: NonAttribute<Insumo>;
}

ProcedimientoInsumo.init(
  {
    procedimiento_id: { type: DataTypes.INTEGER, primaryKey: true },
    insumo_id: { type: DataTypes.INTEGER, primaryKey: true },
    cantidad_usada: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  },
  // modelName explícito: el minificado de producción renombra las clases y haría colisionar los modelos.
  { sequelize, modelName: "ProcedimientoInsumo", tableName: "procedimiento_insumo" },
);
