import { DataTypes, Model, type InferAttributes, type InferCreationAttributes } from "sequelize";
import { sequelize } from "@/lib/conexion";

/** Tabla intermedia N:M: personal asignado a cada operativo (F4/F5). */
export class OperativoVeterinario extends Model<
  InferAttributes<OperativoVeterinario>,
  InferCreationAttributes<OperativoVeterinario>
> {
  declare operativo_id: number;
  declare veterinario_id: number;
}

OperativoVeterinario.init(
  {
    operativo_id: { type: DataTypes.INTEGER, primaryKey: true },
    veterinario_id: { type: DataTypes.INTEGER, primaryKey: true },
  },
  // modelName explícito: el minificado de producción renombra las clases y haría colisionar los modelos.
  { sequelize, modelName: "OperativoVeterinario", tableName: "operativo_veterinario" },
);
