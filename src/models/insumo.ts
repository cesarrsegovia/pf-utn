import { DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes, type NonAttribute } from "sequelize";
import { sequelize } from "@/lib/conexion";
import type { MovimientoInsumo } from "./movimiento-insumo";

/**
 * Insumo veterinario con control de stock (F6).
 * Las cantidades NUMERIC llegan como string desde pg para no perder precisión;
 * los servicios las convierten a número al operar.
 */
export class Insumo extends Model<InferAttributes<Insumo>, InferCreationAttributes<Insumo>> {
  declare id: CreationOptional<number>;
  declare nombre: string;
  declare unidad: string;
  declare stock_actual: CreationOptional<string>;
  declare stock_minimo: CreationOptional<string>;

  declare movimientos?: NonAttribute<MovimientoInsumo[]>;
}

Insumo.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nombre: { type: DataTypes.STRING(80), allowNull: false, unique: true },
    unidad: { type: DataTypes.STRING(20), allowNull: false },
    stock_actual: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: "0" },
    stock_minimo: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: "0" },
  },
  { sequelize, tableName: "insumo" },
);
