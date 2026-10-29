import { DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes, type NonAttribute } from "sequelize";
import { sequelize } from "@/lib/conexion";
import type { Rol } from "./rol";
import type { Veterinario } from "./veterinario";

/** Cuenta de acceso del personal municipal; cada usuario tiene un único rol (F11). */
export class Usuario extends Model<InferAttributes<Usuario>, InferCreationAttributes<Usuario>> {
  declare id: CreationOptional<number>;
  declare nombre: string;
  declare apellido: string;
  declare email: string;
  declare password_hash: string;
  declare activo: CreationOptional<boolean>;
  declare rol_id: number;

  declare rol?: NonAttribute<Rol>;
  declare personal?: NonAttribute<Veterinario | null>;
}

Usuario.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nombre: { type: DataTypes.STRING(60), allowNull: false },
    apellido: { type: DataTypes.STRING(60), allowNull: false },
    email: { type: DataTypes.STRING(120), allowNull: false, unique: true },
    password_hash: { type: DataTypes.STRING(255), allowNull: false },
    activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    rol_id: { type: DataTypes.INTEGER, allowNull: false },
  },
  {
    // modelName explícito: el minificado de producción renombra las clases y haría colisionar los modelos.
    sequelize,
    modelName: "Usuario",
    tableName: "usuario",
    // El hash nunca sale del servidor salvo que se pida explícitamente (login).
    defaultScope: { attributes: { exclude: ["password_hash"] } },
    scopes: { conPassword: { attributes: { include: ["password_hash"] } } },
  },
);
