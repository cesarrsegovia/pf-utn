"use client";

import { Plus } from "lucide-react";
import { toast } from "sonner";
import { AccionesFila } from "@/components/comunes/acciones-fila";
import { BadgeEstado } from "@/components/comunes/badge-estado";
import { ConfirmarDialogo } from "@/components/comunes/confirmar-dialogo";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { ListadoPaginado } from "@/components/comunes/listado-paginado";
import type { Columna } from "@/components/comunes/tabla-datos";
import { Button } from "@/components/ui/button";
import { useEdicion } from "@/hooks/use-edicion";
import { useListado } from "@/hooks/use-listado";
import { llamarApi } from "@/lib/cliente-api";
import { ETIQUETAS_ROL } from "@/lib/etiquetas";
import { mensajeDeError } from "@/lib/formularios";
import type { ResultadoBaja } from "@/services/comun";
import type { UsuarioDto } from "@/services/usuarios";
import { FormularioUsuario } from "./formulario-usuario";

/** Pantalla de F11: listado con búsqueda y paginación, alta, edición y baja de usuarios. */
export function GestionUsuarios() {
  const listado = useListado<UsuarioDto>("/api/usuarios");
  const edicion = useEdicion<UsuarioDto>();

  async function eliminar() {
    if (!edicion.aEliminar) return;
    try {
      const { resultado } = await llamarApi<ResultadoBaja>(`/api/usuarios/${edicion.aEliminar.id}`, { metodo: "DELETE" });
      toast.success(
        resultado === "eliminado" ? "Usuario eliminado" : "El usuario tiene registros asociados: se desactivó en lugar de eliminarse",
      );
      edicion.cerrarEliminar();
      await listado.recargar();
    } catch (error) {
      toast.error(mensajeDeError(error, "No se pudo eliminar el usuario"));
    }
  }

  const columnas: Columna<UsuarioDto>[] = [
    { titulo: "Apellido y nombre", celda: (u) => `${u.apellido}, ${u.nombre}` },
    { titulo: "Email", celda: (u) => u.email },
    { titulo: "Rol", celda: (u) => ETIQUETAS_ROL[u.rol] },
    { titulo: "Estado", celda: (u) => <BadgeEstado texto={u.activo ? "Activo" : "Inactivo"} tono={u.activo ? "exito" : "neutro"} /> },
    {
      titulo: "Acciones",
      className: "w-28 text-right",
      celda: (u) => <AccionesFila onEditar={() => edicion.abrirEdicion(u)} onEliminar={() => edicion.pedirEliminar(u)} />,
    },
  ];

  return (
    <>
      <EncabezadoPagina
        titulo="Usuarios"
        descripcion="Cuentas de acceso del personal municipal y sus roles."
        acciones={<Button onClick={edicion.abrirAlta}><Plus /> Nuevo usuario</Button>}
      />
      <ListadoPaginado
        listado={listado}
        columnas={columnas}
        claveFila={(u) => u.id}
        placeholderBusqueda="Buscar por nombre, apellido o email"
      />

      {edicion.formulario && (
        <FormularioUsuario
          usuario={edicion.formulario.registro}
          onCerrar={edicion.cerrarFormulario}
          onGuardado={async () => {
            edicion.cerrarFormulario();
            await listado.recargar();
          }}
        />
      )}
      <ConfirmarDialogo
        abierto={edicion.aEliminar !== null}
        titulo="Eliminar usuario"
        descripcion={`¿Eliminar a ${edicion.aEliminar?.nombre} ${edicion.aEliminar?.apellido}? Si tiene registros asociados se desactivará en lugar de eliminarse.`}
        textoConfirmar="Eliminar"
        onConfirmar={eliminar}
        onCerrar={edicion.cerrarEliminar}
      />
    </>
  );
}
