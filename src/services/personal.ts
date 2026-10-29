import { Op, type Transaction } from "sequelize";
import type { TipoPersonal } from "@/lib/constantes";
import { condicionBusqueda } from "@/lib/busqueda";
import { Operativo, OperativoVeterinario, Procedimiento, sequelize, Usuario, Veterinario } from "@/lib/db";
import { ReglaNegocioError, ValidacionError } from "@/lib/errores";
import { ETIQUETAS_TIPO_PERSONAL } from "@/lib/etiquetas";
import { hoyLocal } from "@/lib/fechas";
import type { Opcion, ResultadoPaginado } from "@/schemas/comun";
import type { DatosPersonal, ParametrosListadoPersonal } from "@/schemas/personal";
import { buscarPorId, condicionEstado, exigirValorUnico, nuloSiVacio, paginacion, type ResultadoBaja } from "./comun";

/** Representación pública de un integrante del personal actuante (F5). */
export interface PersonalDto {
  id: number;
  tipo: TipoPersonal;
  nombre: string;
  apellido: string;
  matricula: string | null;
  especialidad: string | null;
  telefono: string | null;
  activo: boolean;
  usuario_id: number | null;
  /** Email de la cuenta de acceso vinculada, si la hay. */
  usuario: string | null;
}

/** Inclusión de la cuenta vinculada (solo los datos que muestra el listado). */
const INCLUIR_USUARIO = { association: "usuario", attributes: ["id", "email"] };

/** Convierte el modelo (con su usuario incluido) al DTO público. */
function aDto(personal: Veterinario): PersonalDto {
  return {
    id: personal.id,
    tipo: personal.tipo,
    nombre: personal.nombre,
    apellido: personal.apellido,
    matricula: personal.matricula,
    especialidad: personal.especialidad,
    telefono: personal.telefono,
    activo: personal.activo,
    usuario_id: personal.usuario_id,
    usuario: personal.usuario?.email ?? null,
  };
}

/** Busca un integrante con su cuenta vinculada o lanza 404. */
function buscarPersonal(id: number, transaction?: Transaction): Promise<Veterinario> {
  return buscarPorId(Veterinario, id, "El integrante del personal no existe", { include: [INCLUIR_USUARIO], transaction });
}

/** Listado paginado con búsqueda por nombre, apellido o matrícula y filtros de tipo y estado. */
export async function listarPersonal(parametros: ParametrosListadoPersonal): Promise<ResultadoPaginado<PersonalDto>> {
  const { rows, count } = await Veterinario.findAndCountAll({
    where: {
      [Op.and]: [
        condicionBusqueda(["Veterinario.nombre", "Veterinario.apellido", "Veterinario.matricula"], parametros.busqueda),
        condicionEstado(parametros.estado),
        parametros.tipo ? { tipo: parametros.tipo } : {},
      ],
    },
    include: [INCLUIR_USUARIO],
    order: [["apellido", "ASC"], ["nombre", "ASC"]],
    ...paginacion(parametros),
  });
  return { filas: rows.map(aDto), total: count, pagina: parametros.pagina, tamanio: parametros.tamanio };
}

/**
 * Usuarios que se pueden vincular: activos, con rol veterinario y sin otro integrante
 * del personal asociado. `personalId` (registro en edición) conserva su propio vínculo.
 */
export async function opcionesUsuariosVinculables(personalId?: number): Promise<Opcion[]> {
  const vinculados = await Veterinario.findAll({
    attributes: ["usuario_id"],
    where: { usuario_id: { [Op.ne]: null }, ...(personalId ? { id: { [Op.ne]: personalId } } : {}) },
  });
  const usuarios = await Usuario.findAll({
    where: { activo: true, id: { [Op.notIn]: vinculados.map((personal) => personal.usuario_id!) } },
    include: [{ association: "rol", where: { nombre: "veterinario" }, attributes: [] }],
    order: [["apellido", "ASC"], ["nombre", "ASC"]],
  });
  return usuarios.map((usuario) => ({
    id: usuario.id,
    etiqueta: `${usuario.apellido}, ${usuario.nombre} (${usuario.email})`,
  }));
}

/** Personal activo, para asignar a operativos (F4). */
export async function opcionesPersonal(): Promise<Opcion[]> {
  const personal = await Veterinario.findAll({
    attributes: ["id", "nombre", "apellido", "tipo", "matricula"],
    where: { activo: true },
    order: [["apellido", "ASC"], ["nombre", "ASC"]],
  });
  return personal.map((persona) => ({
    id: persona.id,
    etiqueta: `${persona.apellido}, ${persona.nombre} (${ETIQUETAS_TIPO_PERSONAL[persona.tipo]}${
      persona.matricula ? ` · Mat. ${persona.matricula}` : ""
    })`,
  }));
}

/** Obtiene un integrante del personal por id (404 si no existe). */
export async function obtenerPersonal(id: number): Promise<PersonalDto> {
  return aDto(await buscarPersonal(id));
}

/** Valida matrícula única y usuario vinculable (rol veterinario, activo y libre). */
async function validarPersonal(datos: DatosPersonal, transaction: Transaction, excluirId?: number) {
  const matricula = nuloSiVacio(datos.matricula);
  if (matricula) {
    await exigirValorUnico(Veterinario, "matricula", matricula, "Ya existe personal con esa matrícula", {
      excluirId,
      sinMayusculas: true,
      transaction,
    });
  }
  if (datos.usuario_id !== null) {
    const usuario = await Usuario.findByPk(datos.usuario_id, { include: ["rol"], transaction });
    if (!usuario || !usuario.activo || usuario.rol?.nombre !== "veterinario") {
      throw new ValidacionError("Revise los datos ingresados", {
        usuario_id: "Seleccione un usuario activo con rol veterinario",
      });
    }
    await exigirValorUnico(
      Veterinario, "usuario_id", datos.usuario_id, "Ese usuario ya está vinculado a otro integrante del personal",
      { excluirId, transaction },
    );
  }
}

/** Convierte los datos del formulario en los atributos del modelo. */
function aAtributos(datos: DatosPersonal) {
  return {
    tipo: datos.tipo,
    nombre: datos.nombre,
    apellido: datos.apellido,
    matricula: nuloSiVacio(datos.matricula),
    especialidad: nuloSiVacio(datos.especialidad),
    telefono: nuloSiVacio(datos.telefono),
    activo: datos.activo,
    usuario_id: datos.usuario_id,
  };
}

/**
 * Impide dar de baja a quien está asignado a un operativo programado o en curso
 * con fecha de hoy en adelante (el operativo se quedaría sin el personal previsto).
 */
async function verificarSinOperativosVigentes(id: number, transaction: Transaction) {
  const vigentes = await Operativo.count({
    where: { estado: { [Op.in]: ["programado", "en_curso"] }, fecha: { [Op.gte]: hoyLocal() } },
    include: [{ association: "personal", where: { id }, attributes: [] }],
    transaction,
  });
  if (vigentes > 0) {
    throw new ReglaNegocioError(
      "No se puede dar de baja: el integrante está asignado a un operativo programado o en curso",
    );
  }
}

/** Alta de personal actuante. */
export async function crearPersonal(datos: DatosPersonal): Promise<PersonalDto> {
  return sequelize.transaction(async (transaction) => {
    await validarPersonal(datos, transaction);
    const personal = await Veterinario.create(aAtributos(datos), { transaction });
    return aDto(await buscarPersonal(personal.id, transaction));
  });
}

/** Modificación de personal. Desactivarlo exige que no tenga operativos vigentes. */
export async function actualizarPersonal(id: number, datos: DatosPersonal): Promise<PersonalDto> {
  return sequelize.transaction(async (transaction) => {
    const personal = await buscarPersonal(id, transaction);
    if (personal.activo && !datos.activo) {
      await verificarSinOperativosVigentes(id, transaction);
    }
    await validarPersonal(datos, transaction, id);
    await personal.update(aAtributos(datos), { transaction });
    return aDto(await buscarPersonal(id, transaction));
  });
}

/**
 * Baja de personal. Si participó de algún operativo o tiene procedimientos se desactiva
 * (la tabla `operativo_veterinario` y el historial lo referencian); si no, se elimina.
 */
export async function eliminarPersonal(id: number): Promise<ResultadoBaja> {
  return sequelize.transaction(async (transaction) => {
    const personal = await buscarPersonal(id, transaction);
    await verificarSinOperativosVigentes(id, transaction);

    const [asignaciones, procedimientos] = await Promise.all([
      OperativoVeterinario.count({ where: { veterinario_id: id }, transaction }),
      Procedimiento.count({ where: { veterinario_id: id }, transaction }),
    ]);
    if (asignaciones + procedimientos > 0) {
      await personal.update({ activo: false }, { transaction });
      return { resultado: "desactivado" };
    }
    await personal.destroy({ transaction });
    return { resultado: "eliminado" };
  });
}
