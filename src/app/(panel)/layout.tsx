import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { BarraLateral } from "@/components/layout/barra-lateral";
import { obtenerSesion } from "@/lib/sesion";

/** Layout de las páginas autenticadas: revalida la sesión y muestra el menú por rol. */
export default async function LayoutPanel({ children }: { children: ReactNode }) {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <BarraLateral sesion={sesion} />
      <main className="flex-1 overflow-x-auto p-6">{children}</main>
    </div>
  );
}
