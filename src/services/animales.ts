import { Op, type Transaction } from "sequelize";
import type { CondicionAnimal, SexoAnimal } from "@/lib/constantes";
import { condicionBusqueda } from "@/lib/busqueda";
import { Animal, sequelize, Turno, Vecino } from "@/lib/db";
import { ReglaNegocioError, ValidacionError } from "@/lib/errores";
import { ETIQUETAS_CONDICION, nombreAnimal } from "@/lib/etiquetas";
import type { Opcion, ResultadoPaginado } from "@/schemas/comun";
import type { DatosAnimal, ParametrosListadoAnimales } from "@/schemas/animales";
import { buscarPorId, enumerarAsociados, exigirReferencia, exigirValorUnico, nuloSiVacio, paginacion } from "./comun";

/** Representación pública de un animal (F2). */
export interface AnimalDto {
  id: number;
  nombre: string | null;
  raza: string | null;
  sexo: SexoAnimal;
  edad_estimada: number | null;
  condicion: CondicionAnimal;
  castrado: boolean;
  numero_chip: string | null;
  vecino_id: number | null;
  /** "Apellido, Nombre" del tutor, o null si es callejero o asilvestrado. */
  tutor: string | null;
}

/** Inclusión del tutor (opcional: los callejeros no tienen). */
const INCLUIR_TUTOR = { association: "vecino", attributes: ["id", "nombre", "apellido", "dni"], required: false };

/** Convierte el modelo (con su tutor incluido) al DTO público. */
function aDto(animal: Animal): AnimalDto {
  return {
    id: animal.id,
    nombre: animal.nombre,
    raza: animal.raza,
    sexo: animal.sexo,
    edad_estimada: animal.edad_estimada,
    condicion: animal.condicion,
    castrado: animal.castrado,
    numero_chip: animal.numero_chip,
    vecino_id: animal.vecino_id,
    tutor: animal.vecino ? `${animal.vecino.apellido}, ${animal.vecino.nombre}` : null,
  };
}

/** Busca un animal con su tutor o lanza 404. */
function buscarAnimal(id: number, transaction?: Transaction): Promise<Animal> {
  return buscarPorId(Animal, id, "El animal no existe", { include: [INCLUIR_TUTOR], transaction });
}

/** Listado paginado con búsqueda por nombre, raza, chip o apellido/DNI del tutor, y filtro de condición. */
export async function listarAnimales(parametros: ParametrosListadoAnimales): Promise<ResultadoPaginado<AnimalDto>> {
  const { rows, count } = await Animal.findAndCountAll({
    where: {
      [Op.and]: [
        condicionBusqueda(
          ["Animal.nombre", "Animal.raza", "Animal.numero_chip", "vecino.apellido", "vecino.dni"],
          parametros.busqueda,
        ),
        parametros.condicion ? { condicion: parametros.condicion } : {},
      ],
    },
    include: [INCLUIR_TUTOR],
    order: [["id", "DESC"]],
    ...paginacion(parametros),
  });
  return { filas: rows.map(aDto), total: count, pagina: parametros.pagina, tamanio: parametros.tamanio };
}

/**
 * Animales que pueden pedir turno (F3): callejeros/asilvestrados y los que tienen tutor
 * activo. La etiqueta muestra el tutor para distinguir animales con el mismo nombre.
 */
export async function opcionesAnimales(): Promise<Opcion[]> {
  const animales = await Animal.findAll({
    attributes: ["id", "nombre", "condicion"],
    include: [{ association: "vecino", attributes: ["id", "nombre", "apellido", "activo"], required: false }],
    where: { [Op.or]: [{ vecino_id: null }, { "$vecino.activo$": true }] },
    order: [["nombre", "ASC"], ["id", "ASC"]],
  });
  return animales.map((animal) => ({
    id: animal.id,
    etiqueta: `${nombreAnimal(animal)} (#${animal.id}) · ${
      animal.vecino ? `Tutor: ${animal.vecino.apellido}, ${animal.vecino.nombre}` : ETIQUETAS_CONDICION[animal.condicion]
    }`,
  }));
}

/** Obtiene un animal por id (404 si no existe). */
export async function obtenerAnimal(id: number): Promise<AnimalDto> {
  return aDto(await buscarAnimal(id));
}

/**
 * Valida el chip único y el tutor. Solo un animal con tutor guarda `vecino_id`; el tutor
 * debe existir y, si se asigna o cambia, estar activo (un animal conserva a su tutor
 * aunque este sea dado de baja después). Devuelve el `vecino_id` que se debe guardar.
 */
async function validarAnimal(
  datos: DatosAnimal,
  transaction: Transaction,
  actual?: Animal,
): Promise<number | null> {
  const chip = nuloSiVacio(datos.numero_chip);
  if (chip) {
    await exigirValorUnico(Animal, "numero_chip", chip, "Ya existe un animal con ese número de chip", {
      excluirId: actual?.id,
      transaction,
    });
  }
  if (datos.condicion !== "con_tutor" || datos.vecino_id === null) return null;

  const tutor = await exigirReferencia(Vecino, datos.vecino_id, "vecino_id", "El vecino seleccionado no existe", transaction);
  const cambiaTutor = actual?.vecino_id !== tutor.id;
  if (cambiaTutor && !tutor.activo) {
    throw new ValidacionError("Revise los datos ingresados", { vecino_id: "El vecino seleccionado está dado de baja" });
  }
  return tutor.id;
}

/** Convierte los datos del formulario en los atributos del modelo. */
function aAtributos(datos: DatosAnimal, vecinoId: number | null) {
  return {
    nombre: nuloSiVacio(datos.nombre),
    raza: nuloSiVacio(datos.raza),
    sexo: datos.sexo,
    edad_estimada: datos.edad_estimada,
    condicion: datos.condicion,
    castrado: datos.castrado,
    numero_chip: nuloSiVacio(datos.numero_chip),
    vecino_id: vecinoId,
  };
}

/** Alta de animal. */
export async function crearAnimal(datos: DatosAnimal): Promise<AnimalDto> {
  return sequelize.transaction(async (transaction) => {
    const vecinoId = await validarAnimal(datos, transaction);
    const animal = await Animal.create(aAtributos(datos, vecinoId), { transaction });
    return aDto(await buscarAnimal(animal.id, transaction));
  });
}

/** Modificación de animal. */
export async function actualizarAnimal(id: number, datos: DatosAnimal): Promise<AnimalDto> {
  return sequelize.transaction(async (transaction) => {
    const animal = await buscarAnimal(id, transaction);
    const vecinoId = await validarAnimal(datos, transaction, animal);
    await animal.update(aAtributos(datos, vecinoId), { transaction });
    return aDto(await buscarAnimal(id, transaction));
  });
}

/** Baja física de animal: no se elimina si tiene turnos (y por lo tanto, procedimientos). */
export async function eliminarAnimal(id: number): Promise<void> {
  await sequelize.transaction(async (transaction) => {
    const animal = await buscarPorId(Animal, id, "El animal no existe", { transaction });
    const turnos = await Turno.count({ where: { animal_id: id }, transaction });
    if (turnos > 0) {
      const asociados = enumerarAsociados([[turnos, "turno registrado", "turnos registrados"]]);
      throw new ReglaNegocioError(`No se puede eliminar el animal porque tiene ${asociados}`);
    }
    await animal.destroy({ transaction });
  });
}
