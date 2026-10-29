import { DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes } from "sequelize";
import { sequelize } from "@/lib/conexion";

/** Zona o barrio administrativo que organiza vecinos, operativos y avistamientos (F10). */
export class Zona extends Model<InferAttributes<Zona>, InferCreationAttributes<Zona>> {
  declare id: CreationOptional<number>;
  declare nombre: string;
  declare descripcion: CreationOptional<string | null>;
}

Zona.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nombre: { type: DataTypes.STRING(80), allowNull: false, unique: true },
    descripcion: { type: DataTypes.STRING(255), allowNull: true },
  },
  // modelName explícito: el minificado de producción renombra las clases y haría colisionar los modelos.
  { sequelize, modelName: "Zona", tableName: "zona" },
);
