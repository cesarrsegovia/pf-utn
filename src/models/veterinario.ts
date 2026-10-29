import { DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes, type NonAttribute } from "sequelize";
import { sequelize } from "@/lib/conexion";
import type { TipoPersonal } from "@/lib/constantes";
import type { Operativo } from "./operativo";
import type { Usuario } from "./usuario";

/** Personal actuante: veterinarios (con matrícula) y auxiliares (F5). */
export class Veterinario extends Model<InferAttributes<Veterinario>, InferCreationAttributes<Veterinario>> {
  declare id: CreationOptional<number>;
  declare tipo: TipoPersonal;
  declare nombre: string;
  declare apellido: string;
  declare matricula: CreationOptional<string | null>;
  declare especialidad: CreationOptional<string | null>;
  declare telefono: CreationOptional<string | null>;
  declare activo: CreationOptional<boolean>;
  /** Cuenta de acceso vinculada (opcional); necesaria para registrar procedimientos. */
  declare usuario_id: CreationOptional<number | null>;

  declare usuario?: NonAttribute<Usuario | null>;
  declare operativos?: NonAttribute<Operativo[]>;
}

Veterinario.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    tipo: { type: DataTypes.STRING(20), allowNull: false },
    nombre: { type: DataTypes.STRING(60), allowNull: false },
    apellido: { type: DataTypes.STRING(60), allowNull: false },
    matricula: { type: DataTypes.STRING(20), allowNull: true, unique: true },
    especialidad: { type: DataTypes.STRING(60), allowNull: true },
    telefono: { type: DataTypes.STRING(20), allowNull: true },
    activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    usuario_id: { type: DataTypes.INTEGER, allowNull: true, unique: true },
  },
  // modelName explícito: el minificado de producción renombra las clases y haría colisionar los modelos.
  { sequelize, modelName: "Veterinario", tableName: "veterinario" },
);
