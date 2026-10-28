import { DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes, type NonAttribute } from "sequelize";
import { sequelize } from "@/lib/conexion";
import type { TipoMovimiento } from "@/lib/constantes";
import type { Insumo } from "./insumo";
import type { Procedimiento } from "./procedimiento";
import type { Usuario } from "./usuario";

/** Ingreso o egreso de stock de un insumo, con el usuario que lo registró (F6). */
export class MovimientoInsumo extends Model<InferAttributes<MovimientoInsumo>, InferCreationAttributes<MovimientoInsumo>> {
  declare id: CreationOptional<number>;
  declare tipo: TipoMovimiento;
  declare cantidad: string;
  declare fecha: CreationOptional<Date>;
  declare motivo: CreationOptional<string | null>;
  declare insumo_id: number;
  declare usuario_id: number;
  /** Presente solo en los egresos generados al registrar un procedimiento (F7). */
  declare procedimiento_id: CreationOptional<number | null>;

  declare insumo?: NonAttribute<Insumo>;
  declare usuario?: NonAttribute<Usuario>;
  declare procedimiento?: NonAttribute<Procedimiento | null>;
}

MovimientoInsumo.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    tipo: { type: DataTypes.STRING(10), allowNull: false },
    cantidad: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    fecha: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    motivo: { type: DataTypes.STRING(255), allowNull: true },
    insumo_id: { type: DataTypes.INTEGER, allowNull: false },
    usuario_id: { type: DataTypes.INTEGER, allowNull: false },
    procedimiento_id: { type: DataTypes.INTEGER, allowNull: true },
  },
  { sequelize, tableName: "movimiento_insumo" },
);
