import { DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes, type NonAttribute } from "sequelize";
import { sequelize } from "@/lib/conexion";
import type { EstadoOperativo } from "@/lib/constantes";
import type { Turno } from "./turno";
import type { Usuario } from "./usuario";
import type { Veterinario } from "./veterinario";
import type { Zona } from "./zona";

/** Jornada de castración/chipeo en una zona, con cupo máximo de turnos (F4). */
export class Operativo extends Model<InferAttributes<Operativo>, InferCreationAttributes<Operativo>> {
  declare id: CreationOptional<number>;
  /** Fecha local del operativo (YYYY-MM-DD). */
  declare fecha: string;
  /** Horas locales (HH:MM o HH:MM:SS). */
  declare hora_inicio: string;
  declare hora_fin: string;
  declare lugar: string;
  declare cupo_maximo: number;
  declare estado: CreationOptional<EstadoOperativo>;
  declare motivo_cancelacion: CreationOptional<string | null>;
  declare fecha_cancelacion: CreationOptional<Date | null>;
  declare usuario_cancelacion_id: CreationOptional<number | null>;
  declare zona_id: number;

  declare zona?: NonAttribute<Zona>;
  declare turnos?: NonAttribute<Turno[]>;
  declare personal?: NonAttribute<Veterinario[]>;
  declare usuarioCancelacion?: NonAttribute<Usuario | null>;
}

Operativo.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    fecha: { type: DataTypes.DATEONLY, allowNull: false },
    hora_inicio: { type: DataTypes.TIME, allowNull: false },
    hora_fin: { type: DataTypes.TIME, allowNull: false },
    lugar: { type: DataTypes.STRING(150), allowNull: false },
    cupo_maximo: { type: DataTypes.INTEGER, allowNull: false },
    estado: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "programado" },
    motivo_cancelacion: { type: DataTypes.STRING(255), allowNull: true },
    fecha_cancelacion: { type: DataTypes.DATE, allowNull: true },
    usuario_cancelacion_id: { type: DataTypes.INTEGER, allowNull: true },
    zona_id: { type: DataTypes.INTEGER, allowNull: false },
  },
  // modelName explícito: el minificado de producción renombra las clases y haría colisionar los modelos.
  { sequelize, modelName: "Operativo", tableName: "operativo" },
);
