import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

/** Página 404 de todo el sitio: rutas inexistentes y `notFound()` de las páginas de detalle. */
export default function NoEncontrado() {
  return (
    <main className="mx-auto mt-24 grid max-w-md gap-4 p-6 text-center">
      <p className="text-sm font-medium text-muted-foreground">Error 404</p>
      <h1 className="text-2xl font-semibold tracking-tight">Página no encontrada</h1>
      <p className="text-sm text-muted-foreground">La dirección no existe o el registro fue eliminado.</p>
      <div>
        <Link href="/dashboard" className={buttonVariants()}>
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
