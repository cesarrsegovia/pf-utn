import { Operativo, ReporteAvistamiento, sequelize, Vecino, Zona } from "@/lib/db";
import { condicionBusqueda } from "@/lib/busqueda";
import { ReglaNegocioError } from "@/lib/errores";
import type { Opcion, ParametrosListado, ResultadoPaginado } from "@/schemas/comun";
import type { DatosZona } from "@/schemas/zonas";
import { buscarPorId, enumerarAsociados, exigirValorUnico, nuloSiVacio, paginacion } from "./comun";

/** Representación pública de una zona (F10). */
export interface ZonaDto {
  id: number;
  nombre: string;
  descripcion: string | null;
}

/** Convierte el modelo al DTO público. */
function aDto(zona: Zona): ZonaDto {
  return { id: zona.id, nombre: zona.nombre, descripcion: zona.descripcion };
}

/** Listado paginado con búsqueda por nombre o descripción. */
export async function listarZonas(parametros: ParametrosListado): Promise<ResultadoPaginado<ZonaDto>> {
  const { rows, count } = await Zona.findAndCountAll({
    where: condicionBusqueda(["Zona.nombre", "Zona.descripcion"], parametros.busqueda),
    order: [["nombre", "ASC"]],
    ...paginacion(parametros),
  });
  return { filas: rows.map(aDto), total: count, pagina: parametros.pagina, tamanio: parametros.tamanio };
}

/** Todas las zonas para las listas desplegables (vecinos, filtros). */
export async function opcionesZonas(): Promise<Opcion[]> {
  const zonas = await Zona.findAll({ attributes: ["id", "nombre"], order: [["nombre", "ASC"]] });
  return zonas.map((zona) => ({ id: zona.id, etiqueta: zona.nombre }));
}

/** Obtiene una zona por id (404 si no existe). */
export async function obtenerZona(id: number): Promise<ZonaDto> {
  return aDto(await buscarPorId(Zona, id, "La zona no existe"));
}

/** Alta de zona: el nombre es único sin distinguir mayúsculas. */
export async function crearZona(datos: DatosZona): Promise<ZonaDto> {
  return sequelize.transaction(async (transaction) => {
    await exigirValorUnico(Zona, "nombre", datos.nombre, "Ya existe una zona con ese nombre", {
      sinMayusculas: true,
      transaction,
    });
    const zona = await Zona.create(
      { nombre: datos.nombre, descripcion: nuloSiVacio(datos.descripcion) },
      { transaction },
    );
    return aDto(zona);
  });
}

/** Modificación de zona (el nombre sigue siendo único). */
export async function actualizarZona(id: number, datos: DatosZona): Promise<ZonaDto> {
  return sequelize.transaction(async (transaction) => {
    const zona = await buscarPorId(Zona, id, "La zona no existe", { transaction });
    await exigirValorUnico(Zona, "nombre", datos.nombre, "Ya existe una zona con ese nombre", {
      excluirId: id,
      sinMayusculas: true,
      transaction,
    });
    await zona.update({ nombre: datos.nombre, descripcion: nuloSiVacio(datos.descripcion) }, { transaction });
    return aDto(zona);
  });
}

/** Baja física de zona: solo si no tiene vecinos, operativos ni reportes de avistamiento. */
export async function eliminarZona(id: number): Promise<void> {
  await sequelize.transaction(async (transaction) => {
    const zona = await buscarPorId(Zona, id, "La zona no existe", { transaction });
    const [vecinos, operativos, reportes] = await Promise.all([
      Vecino.count({ where: { zona_id: id }, transaction }),
      Operativo.count({ where: { zona_id: id }, transaction }),
      ReporteAvistamiento.count({ where: { zona_id: id }, transaction }),
    ]);
    if (vecinos + operativos + reportes > 0) {
      const asociados = enumerarAsociados([
        [vecinos, "vecino", "vecinos"],
        [operativos, "operativo", "operativos"],
        [reportes, "reporte de avistamiento", "reportes de avistamiento"],
      ]);
      throw new ReglaNegocioError(`No se puede eliminar la zona porque tiene registros asociados: ${asociados}`);
    }
    await zona.destroy({ transaction });
  });
}
