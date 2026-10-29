import { DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes, type NonAttribute } from "sequelize";
import { sequelize } from "@/lib/conexion";
import type { Procedimiento } from "./procedimiento";

/**
 * Entrada del historial clínico; se crea solo desde F7 (una por procedimiento).
 * El animal y la fecha se obtienen del procedimiento y su turno (F8).
 */
export class HistorialClinico extends Model<InferAttributes<HistorialClinico>, InferCreationAttributes<HistorialClinico>> {
  declare id: CreationOptional<number>;
  declare descripcion: string;
  declare procedimiento_id: number;

  declare procedimiento?: NonAttribute<Procedimiento>;
}

HistorialClinico.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    descripcion: { type: DataTypes.TEXT, allowNull: false },
    procedimiento_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  },
  // modelName explícito: el minificado de producción renombra las clases y haría colisionar los modelos.
  { sequelize, modelName: "HistorialClinico", tableName: "historial_clinico" },
);
