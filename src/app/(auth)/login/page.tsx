"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CampoFormulario } from "@/components/comunes/campo-formulario";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ErrorApi, llamarApi } from "@/lib/cliente-api";
import { esquemaLogin, type DatosLogin } from "@/schemas/auth";

/** Pantalla de inicio de sesión del personal municipal. */
export default function PaginaLogin() {
  const router = useRouter();
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<DatosLogin>({
    resolver: zodResolver(esquemaLogin),
    defaultValues: { email: "", password: "" },
  });

  async function ingresar(datos: DatosLogin) {
    setErrorGeneral(null);
    try {
      await llamarApi("/api/auth/login", { metodo: "POST", cuerpo: datos });
      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      setErrorGeneral(error instanceof ErrorApi ? error.message : "No se pudo iniciar sesión");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>SIGCAN</CardTitle>
          <CardDescription>Ingrese con su cuenta del personal municipal</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(ingresar)} className="grid gap-4" noValidate>
            <CampoFormulario id="email" etiqueta="Email" error={formState.errors.email?.message}>
              <Input id="email" type="email" autoComplete="username" {...register("email")} />
            </CampoFormulario>
            <CampoFormulario id="password" etiqueta="Contraseña" error={formState.errors.password?.message}>
              <Input id="password" type="password" autoComplete="current-password" {...register("password")} />
            </CampoFormulario>
            {errorGeneral && <p className="text-sm text-destructive" role="alert">{errorGeneral}</p>}
            <Button type="submit" disabled={formState.isSubmitting}>
              {formState.isSubmitting ? "Ingresando…" : "Ingresar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
