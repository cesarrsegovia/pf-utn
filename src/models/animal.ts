import { DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes, type NonAttribute } from "sequelize";
import { sequelize } from "@/lib/conexion";
import type { CondicionAnimal, SexoAnimal } from "@/lib/constantes";
import type { Turno } from "./turno";
import type { Vecino } from "./vecino";

/** Animal canino; `vecino_id` nulo identifica a un callejero o asilvestrado (F2). */
export class Animal extends Model<InferAttributes<Animal>, InferCreationAttributes<Animal>> {
  declare id: CreationOptional<number>;
  declare nombre: CreationOptional<string | null>;
  declare especie: CreationOptional<string>;
  declare raza: CreationOptional<string | null>;
  declare sexo: SexoAnimal;
  declare edad_estimada: CreationOptional<number | null>;
  declare condicion: CondicionAnimal;
  declare castrado: CreationOptional<boolean>;
  declare numero_chip: CreationOptional<string | null>;
  declare vecino_id: CreationOptional<number | null>;

  declare vecino?: NonAttribute<Vecino | null>;
  declare turnos?: NonAttribute<Turno[]>;
}

Animal.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nombre: { type: DataTypes.STRING(60), allowNull: true },
    especie: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "canino" },
    raza: { type: DataTypes.STRING(60), allowNull: true },
    sexo: { type: DataTypes.CHAR(1), allowNull: false },
    edad_estimada: { type: DataTypes.INTEGER, allowNull: true },
    condicion: { type: DataTypes.STRING(20), allowNull: false },
    castrado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    numero_chip: { type: DataTypes.STRING(20), allowNull: true, unique: true },
    vecino_id: { type: DataTypes.INTEGER, allowNull: true },
  },
  { sequelize, tableName: "animal" },
);
