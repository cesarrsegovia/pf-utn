import { DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes, type NonAttribute } from "sequelize";
import { sequelize } from "@/lib/conexion";
import type { EstadoAvistamiento } from "@/lib/constantes";
import type { Operativo } from "./operativo";
import type { Usuario } from "./usuario";
import type { Vecino } from "./vecino";
import type { Zona } from "./zona";

/** Aviso de animales sueltos por zona, cargado por el personal y sin GPS (F9). */
export class ReporteAvistamiento extends Model<
  InferAttributes<ReporteAvistamiento>,
  InferCreationAttributes<ReporteAvistamiento>
> {
  declare id: CreationOptional<number>;
  declare fecha: Date;
  declare descripcion: string;
  declare cantidad_animales: number;
  declare direccion_referencia: CreationOptional<string | null>;
  declare estado: CreationOptional<EstadoAvistamiento>;
  declare fecha_atencion: CreationOptional<Date | null>;
  declare zona_id: number;
  declare vecino_id: CreationOptional<number | null>;
  declare usuario_id: number;
  declare operativo_id: CreationOptional<number | null>;

  declare zona?: NonAttribute<Zona>;
  declare vecino?: NonAttribute<Vecino | null>;
  declare usuario?: NonAttribute<Usuario>;
  declare operativo?: NonAttribute<Operativo | null>;
}

ReporteAvistamiento.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    fecha: { type: DataTypes.DATE, allowNull: false },
    descripcion: { type: DataTypes.TEXT, allowNull: false },
    cantidad_animales: { type: DataTypes.INTEGER, allowNull: false },
    direccion_referencia: { type: DataTypes.STRING(150), allowNull: true },
    estado: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "pendiente" },
    fecha_atencion: { type: DataTypes.DATE, allowNull: true },
    zona_id: { type: DataTypes.INTEGER, allowNull: false },
    vecino_id: { type: DataTypes.INTEGER, allowNull: true },
    usuario_id: { type: DataTypes.INTEGER, allowNull: false },
    operativo_id: { type: DataTypes.INTEGER, allowNull: true },
  },
  { sequelize, tableName: "reporte_avistamiento" },
);
