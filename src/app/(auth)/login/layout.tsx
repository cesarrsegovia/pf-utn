import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Iniciar sesión" };

/** Layout de la pantalla de ingreso: solo aporta el título de la pestaña. */
export default function LayoutLogin({ children }: { children: ReactNode }) {
  return children;
}
