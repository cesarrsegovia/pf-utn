import { DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes, type NonAttribute } from "sequelize";
import { sequelize } from "@/lib/conexion";
import type { Animal } from "./animal";
import type { Zona } from "./zona";

/** Vecino solicitante y tutor de animales; admite baja lógica (F1). */
export class Vecino extends Model<InferAttributes<Vecino>, InferCreationAttributes<Vecino>> {
  declare id: CreationOptional<number>;
  declare nombre: string;
  declare apellido: string;
  declare dni: string;
  declare telefono: string;
  declare email: CreationOptional<string | null>;
  declare direccion: string;
  declare activo: CreationOptional<boolean>;
  /** Fecha de la baja lógica (formato YYYY-MM-DD); nula mientras el vecino está activo. */
  declare fecha_baja: CreationOptional<string | null>;
  declare zona_id: number;

  declare zona?: NonAttribute<Zona>;
  declare animales?: NonAttribute<Animal[]>;
}

Vecino.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nombre: { type: DataTypes.STRING(60), allowNull: false },
    apellido: { type: DataTypes.STRING(60), allowNull: false },
    dni: { type: DataTypes.STRING(10), allowNull: false, unique: true },
    telefono: { type: DataTypes.STRING(20), allowNull: false },
    email: { type: DataTypes.STRING(120), allowNull: true },
    direccion: { type: DataTypes.STRING(150), allowNull: false },
    activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    fecha_baja: { type: DataTypes.DATEONLY, allowNull: true },
    zona_id: { type: DataTypes.INTEGER, allowNull: false },
  },
  // modelName explícito: el minificado de producción renombra las clases y haría colisionar los modelos.
  { sequelize, modelName: "Vecino", tableName: "vecino" },
);
