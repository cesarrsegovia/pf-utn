"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { CampoFormulario } from "@/components/comunes/campo-formulario";
import { FormularioDialogo } from "@/components/comunes/formulario-dialogo";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { llamarApi } from "@/lib/cliente-api";
import { ROLES } from "@/lib/constantes";
import { ETIQUETAS_ROL } from "@/lib/etiquetas";
import { mostrarErrorFormulario } from "@/lib/formularios";
import { esquemaCrearUsuario, esquemaEditarUsuario, type DatosUsuario } from "@/schemas/usuarios";
import type { UsuarioDto } from "@/services/usuarios";

/** Valores del formulario: vacíos para alta, los del usuario para edición. */
function valoresIniciales(usuario: UsuarioDto | null): DatosUsuario {
  return usuario
    ? { nombre: usuario.nombre, apellido: usuario.apellido, email: usuario.email, rol: usuario.rol, activo: usuario.activo, password: "" }
    : { nombre: "", apellido: "", email: "", rol: "operador", activo: true, password: "" };
}

/**
 * Diálogo de alta/edición de usuario. Valida en el cliente con el mismo esquema que usa la API.
 * Se monta solo mientras está abierto, así cada apertura empieza con valores limpios.
 */
export function FormularioUsuario({ usuario, onCerrar, onGuardado }: {
  usuario: UsuarioDto | null;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const { register, control, handleSubmit, setError, formState } = useForm<DatosUsuario>({
    resolver: zodResolver(usuario ? esquemaEditarUsuario : esquemaCrearUsuario),
    defaultValues: valoresIniciales(usuario),
  });

  async function guardar(datos: DatosUsuario) {
    try {
      await llamarApi(usuario ? `/api/usuarios/${usuario.id}` : "/api/usuarios", {
        metodo: usuario ? "PUT" : "POST",
        cuerpo: datos,
      });
      toast.success(usuario ? "Usuario actualizado" : "Usuario creado");
      onGuardado();
    } catch (error) {
      mostrarErrorFormulario(error, setError, "No se pudo guardar el usuario");
    }
  }

  const errores = formState.errors;
  return (
    <FormularioDialogo
      titulo={usuario ? "Editar usuario" : "Nuevo usuario"}
      descripcion={usuario ? "Deje la contraseña vacía para conservar la actual." : "Todos los campos son obligatorios."}
      idFormulario="formulario-usuario"
      enviando={formState.isSubmitting}
      onCerrar={onCerrar}
    >
      <form id="formulario-usuario" onSubmit={handleSubmit(guardar)} className="grid gap-4" noValidate>
        <div className="grid grid-cols-2 gap-4">
          <CampoFormulario id="nombre" etiqueta="Nombre" error={errores.nombre?.message}>
            <Input id="nombre" {...register("nombre")} />
          </CampoFormulario>
          <CampoFormulario id="apellido" etiqueta="Apellido" error={errores.apellido?.message}>
            <Input id="apellido" {...register("apellido")} />
          </CampoFormulario>
        </div>
        <CampoFormulario id="email" etiqueta="Email" error={errores.email?.message}>
          <Input id="email" type="email" {...register("email")} />
        </CampoFormulario>
        <CampoFormulario id="password" etiqueta="Contraseña" error={errores.password?.message}>
          <Input id="password" type="password" autoComplete="new-password" {...register("password")} />
        </CampoFormulario>
        <CampoFormulario id="rol" etiqueta="Rol" error={errores.rol?.message}>
          <NativeSelect id="rol" className="w-full" {...register("rol")}>
            {ROLES.map((rol) => (
              <NativeSelectOption key={rol} value={rol}>{ETIQUETAS_ROL[rol]}</NativeSelectOption>
            ))}
          </NativeSelect>
        </CampoFormulario>
        <Controller
          control={control}
          name="activo"
          render={({ field }) => (
            <div className="flex items-center gap-2">
              <Checkbox id="activo" checked={field.value} onCheckedChange={(marcado) => field.onChange(marcado === true)} />
              <Label htmlFor="activo">Usuario activo</Label>
            </div>
          )}
        />
      </form>
    </FormularioDialogo>
  );
}
