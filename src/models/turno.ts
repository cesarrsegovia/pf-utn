import { DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes, type NonAttribute } from "sequelize";
import { sequelize } from "@/lib/conexion";
import type { EstadoTurno, TipoProcedimiento } from "@/lib/constantes";
import type { Animal } from "./animal";
import type { Notificacion } from "./notificacion";
import type { Operativo } from "./operativo";
import type { Procedimiento } from "./procedimiento";

/** Turno de un animal dentro de un operativo (F3). */
export class Turno extends Model<InferAttributes<Turno>, InferCreationAttributes<Turno>> {
  declare id: CreationOptional<number>;
  declare fecha_solicitud: CreationOptional<Date>;
  /** Hora local del turno (HH:MM o HH:MM:SS); la fecha la aporta el operativo. */
  declare horario: string;
  declare tipo_solicitado: TipoProcedimiento;
  declare estado: CreationOptional<EstadoTurno>;
  declare motivo_cancelacion: CreationOptional<string | null>;
  declare animal_id: number;
  declare operativo_id: number;

  declare animal?: NonAttribute<Animal>;
  declare operativo?: NonAttribute<Operativo>;
  declare procedimiento?: NonAttribute<Procedimiento | null>;
  declare notificaciones?: NonAttribute<Notificacion[]>;
}

Turno.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    fecha_solicitud: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    horario: { type: DataTypes.TIME, allowNull: false },
    tipo_solicitado: { type: DataTypes.STRING(20), allowNull: false },
    estado: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "pendiente" },
    motivo_cancelacion: { type: DataTypes.STRING(255), allowNull: true },
    animal_id: { type: DataTypes.INTEGER, allowNull: false },
    operativo_id: { type: DataTypes.INTEGER, allowNull: false },
  },
  // modelName explícito: el minificado de producción renombra las clases y haría colisionar los modelos.
  { sequelize, modelName: "Turno", tableName: "turno" },
);
