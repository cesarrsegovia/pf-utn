import bcrypt from "bcryptjs";
import { Op, type Transaction } from "sequelize";
import { condicionBusqueda } from "@/lib/busqueda";
import type { DatosSesion } from "@/lib/auth";
import type { NombreRol } from "@/lib/constantes";
import { MovimientoInsumo, Operativo, ReporteAvistamiento, Rol, sequelize, Usuario, Veterinario } from "@/lib/db";
import { ReglaNegocioError, ValidacionError } from "@/lib/errores";
import type { ParametrosListado, ResultadoPaginado } from "@/schemas/comun";
import type { DatosUsuario } from "@/schemas/usuarios";
import { buscarPorId, exigirValorUnico, paginacion, type ResultadoBaja } from "./comun";

/** Costo de bcrypt: 10 rondas es el equilibrio habitual entre seguridad y tiempo de respuesta. */
const RONDAS_BCRYPT = 10;

/** Representación pública de un usuario (nunca incluye el hash de la contraseña). */
export interface UsuarioDto {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  activo: boolean;
  rol: NombreRol;
}

/** Convierte el modelo (con su rol incluido) al DTO público. */
function aDto(usuario: Usuario): UsuarioDto {
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    email: usuario.email,
    activo: usuario.activo,
    rol: usuario.rol!.nombre,
  };
}

/** Busca un usuario con su rol o lanza 404. */
function buscarUsuario(id: number, transaction?: Transaction): Promise<Usuario> {
  return buscarPorId(Usuario, id, "El usuario no existe", { include: ["rol"], transaction });
}

/** Obtiene el id del rol por su nombre. */
async function idDeRol(nombre: NombreRol, transaction?: Transaction): Promise<number> {
  const rol = await Rol.findOne({ where: { nombre }, transaction });
  if (!rol) throw new ValidacionError("El rol indicado no existe", { rol: "Rol inexistente" });
  return rol.id;
}

/** Verifica que el email no esté usado por otro usuario (se guarda siempre en minúsculas). */
function verificarEmailDisponible(email: string, excluirId?: number, transaction?: Transaction) {
  return exigirValorUnico(Usuario, "email", email, "Ya existe un usuario con ese email", { excluirId, transaction });
}

/**
 * Si el usuario es un administrador activo que dejaría de serlo (cambio de rol, baja o
 * eliminación), exige que quede al menos otro administrador activo.
 */
async function verificarQuedaAdministrador(usuario: Usuario, transaction: Transaction) {
  if (usuario.rol!.nombre !== "administrador" || !usuario.activo) return;
  const otrosAdministradores = await Usuario.count({
    where: { activo: true, id: { [Op.ne]: usuario.id } },
    include: [{ association: "rol", where: { nombre: "administrador" } }],
    transaction,
  });
  if (otrosAdministradores === 0) {
    throw new ReglaNegocioError("Debe quedar al menos un administrador activo en el sistema");
  }
}

/** Listado paginado con búsqueda por nombre, apellido o email (sin distinguir mayúsculas ni acentos). */
export async function listarUsuarios(parametros: ParametrosListado): Promise<ResultadoPaginado<UsuarioDto>> {
  const { rows, count } = await Usuario.findAndCountAll({
    where: condicionBusqueda(["Usuario.nombre", "Usuario.apellido", "Usuario.email"], parametros.busqueda),
    include: ["rol"],
    order: [["apellido", "ASC"], ["nombre", "ASC"]],
    ...paginacion(parametros),
  });
  return { filas: rows.map(aDto), total: count, pagina: parametros.pagina, tamanio: parametros.tamanio };
}

/** Obtiene un usuario por id. */
export async function obtenerUsuario(id: number): Promise<UsuarioDto> {
  return aDto(await buscarUsuario(id));
}

/** Alta de usuario (solo administrador; el permiso se controla en la API). */
export async function crearUsuario(datos: DatosUsuario): Promise<UsuarioDto> {
  const email = datos.email.trim().toLowerCase();
  return sequelize.transaction(async (transaction) => {
    await verificarEmailDisponible(email, undefined, transaction);
    const usuario = await Usuario.create(
      {
        nombre: datos.nombre,
        apellido: datos.apellido,
        email,
        password_hash: await bcrypt.hash(datos.password, RONDAS_BCRYPT),
        activo: datos.activo,
        rol_id: await idDeRol(datos.rol, transaction),
      },
      { transaction },
    );
    return aDto(await buscarUsuario(usuario.id, transaction));
  });
}

/**
 * Modificación de usuario. Contraseña vacía = se conserva la actual.
 * Reglas: nadie cambia su propio rol ni se desactiva; siempre queda un administrador activo;
 * un usuario vinculado a personal veterinario conserva el rol veterinario.
 */
export async function actualizarUsuario(id: number, datos: DatosUsuario, actor: DatosSesion): Promise<UsuarioDto> {
  const email = datos.email.trim().toLowerCase();
  return sequelize.transaction(async (transaction) => {
    const usuario = await buscarUsuario(id, transaction);
    const cambiaRol = usuario.rol!.nombre !== datos.rol;
    const seDesactiva = usuario.activo && !datos.activo;

    if (usuario.id === actor.usuarioId && (cambiaRol || seDesactiva)) {
      throw new ReglaNegocioError("No puede cambiar el rol ni desactivar su propio usuario");
    }
    if (cambiaRol || seDesactiva) {
      await verificarQuedaAdministrador(usuario, transaction);
    }
    if (cambiaRol && usuario.rol!.nombre === "veterinario") {
      const vinculado = await Veterinario.count({ where: { usuario_id: usuario.id }, transaction });
      if (vinculado > 0) {
        throw new ReglaNegocioError(
          "El usuario está vinculado al personal veterinario; desvincúlelo antes de cambiar su rol",
        );
      }
    }
    await verificarEmailDisponible(email, usuario.id, transaction);

    await usuario.update(
      {
        nombre: datos.nombre,
        apellido: datos.apellido,
        email,
        activo: datos.activo,
        rol_id: await idDeRol(datos.rol, transaction),
        ...(datos.password ? { password_hash: await bcrypt.hash(datos.password, RONDAS_BCRYPT) } : {}),
      },
      { transaction },
    );
    return aDto(await buscarUsuario(id, transaction));
  });
}

/**
 * Baja de usuario. Si tiene registros asociados se desactiva (baja lógica) para preservar
 * la trazabilidad; si no, se elimina físicamente.
 */
export async function eliminarUsuario(id: number, actor: DatosSesion): Promise<ResultadoBaja> {
  return sequelize.transaction(async (transaction) => {
    const usuario = await buscarUsuario(id, transaction);
    if (usuario.id === actor.usuarioId) {
      throw new ReglaNegocioError("No puede eliminar su propio usuario");
    }
    await verificarQuedaAdministrador(usuario, transaction);

    const conteos = await Promise.all([
      MovimientoInsumo.count({ where: { usuario_id: id }, transaction }),
      ReporteAvistamiento.count({ where: { usuario_id: id }, transaction }),
      Operativo.count({ where: { usuario_cancelacion_id: id }, transaction }),
      Veterinario.count({ where: { usuario_id: id }, transaction }),
    ]);
    if (conteos.some((cantidad) => cantidad > 0)) {
      await usuario.update({ activo: false }, { transaction });
      return { resultado: "desactivado" };
    }

    await usuario.destroy({ transaction });
    return { resultado: "eliminado" };
  });
}
