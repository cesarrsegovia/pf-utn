import { redirect } from "next/navigation";

/** La raíz del sitio lleva al inicio del panel. */
export default function Inicio() {
  redirect("/dashboard");
}
