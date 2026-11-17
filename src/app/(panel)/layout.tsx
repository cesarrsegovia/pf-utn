import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { BarraLateral } from "@/components/layout/barra-lateral";
import { obtenerSesion } from "@/lib/sesion";

/** Layout de las páginas autenticadas: revalida la sesión y muestra el menú por rol. */
export default async function LayoutPanel({ children }: { children: ReactNode }) {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");

  return (
    <div className="min-h-screen md:flex">
      <BarraLateral sesion={sesion} />
      {/* Contenido con ancho máximo para que las tablas no se estiren en monitores anchos. */}
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 md:px-8 md:py-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
