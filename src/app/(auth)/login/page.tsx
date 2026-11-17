"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { PawPrint } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { CampoFormulario } from "@/components/comunes/campo-formulario";
import { Button } from "@/components/ui/button";
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
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
      {/* Panel de marca: identidad del programa sobre el color "mar austral". */}
      <section className="relative flex flex-col justify-between overflow-hidden bg-sidebar px-6 py-8 text-sidebar-foreground sm:px-10 lg:px-14 lg:py-14">
        <div className="relative z-10 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-md bg-sidebar-accent text-calafate-claro" aria-hidden="true">
            <PawPrint className="size-5" />
          </span>
          <p className="text-sm text-sidebar-muted">Municipio de Río Grande</p>
        </div>

        <div className="animar-entrada-marca relative z-10 mt-10 max-w-lg lg:mt-0">
          <h1 className="text-6xl leading-none font-bold tracking-wide text-sidebar-primary sm:text-7xl lg:text-8xl">SIGCAN</h1>
          <p className="mt-4 text-lg leading-relaxed text-sidebar-foreground sm:text-xl">
            Gestión de castración y chipeo de perros en Río Grande, Tierra del Fuego.
          </p>
        </div>

        <p className="relative z-10 mt-10 hidden text-sm text-sidebar-muted lg:block">
          Uso exclusivo del personal municipal.
        </p>

        {/* Líneas de viento y mar: trazo decorativo del paisaje fueguino. */}
        <svg
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 w-full text-sidebar-border"
          viewBox="0 0 800 400"
          preserveAspectRatio="none"
          fill="none"
          aria-hidden="true"
        >
          <path d="M0 120 C 160 80, 320 160, 480 110 S 720 60, 800 100" stroke="currentColor" strokeWidth="1.5" />
          <path d="M0 180 C 180 140, 340 220, 500 170 S 720 120, 800 160" stroke="currentColor" strokeWidth="1.5" />
          <path d="M0 240 C 200 200, 360 280, 520 230 S 730 180, 800 220" stroke="currentColor" strokeWidth="1.5" />
          <path d="M0 300 C 220 260, 380 340, 540 290 S 740 240, 800 280" className="text-calafate-claro" stroke="currentColor" strokeOpacity="0.45" strokeWidth="2" />
          <path d="M0 360 C 240 320, 400 400, 560 350 S 750 300, 800 340" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </section>

      {/* Formulario de ingreso. */}
      <section className="flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          <h2 className="text-3xl font-semibold">Ingresar</h2>
          <p className="mt-1 text-sm text-muted-foreground">Ingrese con su cuenta del personal municipal.</p>
          <form onSubmit={handleSubmit(ingresar)} className="mt-8 grid gap-5" noValidate>
            <CampoFormulario id="email" etiqueta="Email" error={formState.errors.email?.message}>
              <Input id="email" type="email" autoComplete="username" className="h-10" {...register("email")} />
            </CampoFormulario>
            <CampoFormulario id="password" etiqueta="Contraseña" error={formState.errors.password?.message}>
              <Input id="password" type="password" autoComplete="current-password" className="h-10" {...register("password")} />
            </CampoFormulario>
            {errorGeneral && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{errorGeneral}</p>
            )}
            <Button type="submit" size="lg" className="mt-1" disabled={formState.isSubmitting}>
              {formState.isSubmitting ? "Ingresando…" : "Ingresar"}
            </Button>
          </form>
        </div>
      </section>
    </main>
  );
}
