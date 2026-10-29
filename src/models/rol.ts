import { DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes, type NonAttribute } from "sequelize";
import { sequelize } from "@/lib/conexion";
import type { NombreRol } from "@/lib/constantes";
import type { Usuario } from "./usuario";

/** Rol del sistema: administrador, operador o veterinario (F11). */
export class Rol extends Model<InferAttributes<Rol>, InferCreationAttributes<Rol>> {
  declare id: CreationOptional<number>;
  declare nombre: NombreRol;

  declare usuarios?: NonAttribute<Usuario[]>;
}

Rol.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nombre: { type: DataTypes.STRING(30), allowNull: false, unique: true },
  },
  // modelName explícito: el minificado de producción renombra las clases y haría colisionar los modelos.
  { sequelize, modelName: "Rol", tableName: "rol" },
);
