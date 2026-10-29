import { DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes, type NonAttribute } from "sequelize";
import { sequelize } from "@/lib/conexion";
import type { EstadoEnvio, TipoNotificacion } from "@/lib/constantes";
import type { Turno } from "./turno";
import type { Vecino } from "./vecino";

/** Notificación por correo al vecino sobre un turno (F12). */
export class Notificacion extends Model<InferAttributes<Notificacion>, InferCreationAttributes<Notificacion>> {
  declare id: CreationOptional<number>;
  declare tipo: TipoNotificacion;
  declare canal: CreationOptional<"email">;
  declare mensaje: string;
  declare estado_envio: CreationOptional<EstadoEnvio>;
  /** Momento a partir del cual el procesador puede enviarla (24 h antes en los recordatorios). */
  declare fecha_programada: Date;
  declare fecha_envio: CreationOptional<Date | null>;
  declare turno_id: number;
  declare vecino_id: number;

  declare turno?: NonAttribute<Turno>;
  declare vecino?: NonAttribute<Vecino>;
}

Notificacion.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    tipo: { type: DataTypes.STRING(20), allowNull: false },
    canal: { type: DataTypes.STRING(10), allowNull: false, defaultValue: "email" },
    mensaje: { type: DataTypes.TEXT, allowNull: false },
    estado_envio: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "pendiente" },
    fecha_programada: { type: DataTypes.DATE, allowNull: false },
    fecha_envio: { type: DataTypes.DATE, allowNull: true },
    turno_id: { type: DataTypes.INTEGER, allowNull: false },
    vecino_id: { type: DataTypes.INTEGER, allowNull: false },
  },
  // modelName explícito: el minificado de producción renombra las clases y haría colisionar los modelos.
  { sequelize, modelName: "Notificacion", tableName: "notificacion" },
);
