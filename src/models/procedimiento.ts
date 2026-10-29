import { DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes, type NonAttribute } from "sequelize";
import { sequelize } from "@/lib/conexion";
import type { TipoProcedimiento } from "@/lib/constantes";
import type { HistorialClinico } from "./historial-clinico";
import type { Insumo } from "./insumo";
import type { MovimientoInsumo } from "./movimiento-insumo";
import type { ProcedimientoInsumo } from "./procedimiento-insumo";
import type { Turno } from "./turno";
import type { Veterinario } from "./veterinario";

/** Procedimiento realizado sobre el animal de un turno; como máximo uno por turno (F7). */
export class Procedimiento extends Model<InferAttributes<Procedimiento>, InferCreationAttributes<Procedimiento>> {
  declare id: CreationOptional<number>;
  declare tipo: TipoProcedimiento;
  declare fecha: CreationOptional<Date>;
  declare observaciones: CreationOptional<string | null>;
  declare numero_chip_colocado: CreationOptional<string | null>;
  declare turno_id: number;
  declare veterinario_id: number;

  declare turno?: NonAttribute<Turno>;
  declare veterinario?: NonAttribute<Veterinario>;
  declare insumos?: NonAttribute<Insumo[]>;
  declare detalleInsumos?: NonAttribute<ProcedimientoInsumo[]>;
  declare movimientos?: NonAttribute<MovimientoInsumo[]>;
  declare historial?: NonAttribute<HistorialClinico | null>;
}

Procedimiento.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    tipo: { type: DataTypes.STRING(20), allowNull: false },
    fecha: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    observaciones: { type: DataTypes.TEXT, allowNull: true },
    numero_chip_colocado: { type: DataTypes.STRING(20), allowNull: true, unique: true },
    turno_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    veterinario_id: { type: DataTypes.INTEGER, allowNull: false },
  },
  // modelName explícito: el minificado de producción renombra las clases y haría colisionar los modelos.
  { sequelize, modelName: "Procedimiento", tableName: "procedimiento" },
);
