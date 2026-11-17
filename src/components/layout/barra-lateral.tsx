"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, PawPrint, X } from "lucide-react";
import type { DatosSesion } from "@/lib/auth";
import { llamarApi } from "@/lib/cliente-api";
import { ETIQUETAS_ROL } from "@/lib/etiquetas";
import { NAVEGACION } from "@/lib/navegacion";
import { tienePermiso } from "@/lib/permisos";
import { cn } from "@/lib/utils";

/** Iniciales del nombre (máximo dos) para el avatar del usuario en sesión. */
function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]!.toUpperCase())
    .join("");
}

/** Clases de foco visibles sobre el fondo oscuro del menú. */
const FOCO_MENU = "focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none";

/** Marca del sistema: símbolo, nombre y localidad. */
function Marca() {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-9 place-items-center rounded-md bg-sidebar-accent text-calafate-claro" aria-hidden="true">
        <PawPrint className="size-5" />
      </span>
      <div className="leading-tight">
        <p className="font-heading text-xl font-bold tracking-wide text-sidebar-primary">SIGCAN</p>
        <p className="text-xs text-sidebar-muted">Río Grande, Tierra del Fuego</p>
      </div>
    </div>
  );
}

/**
 * Menú lateral del panel: muestra solo los módulos permitidos para el rol de la sesión,
 * agrupados por tarea. En pantallas angostas se convierte en un panel desplegable.
 */
export function BarraLateral({ sesion }: { sesion: DatosSesion }) {
  const rutaActual = usePathname();
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);

  // Grupos filtrados por permiso; se descartan los que quedan vacíos para el rol.
  const grupos = NAVEGACION.map((grupo) => ({
    ...grupo,
    items: grupo.items.filter((item) => tienePermiso(sesion.rol, item.accion)),
  })).filter((grupo) => grupo.items.length > 0);

  // Con el panel móvil abierto, la tecla Escape lo cierra.
  useEffect(() => {
    if (!abierto) return;
    const alPresionar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setAbierto(false);
    };
    window.addEventListener("keydown", alPresionar);
    return () => window.removeEventListener("keydown", alPresionar);
  }, [abierto]);

  async function salir() {
    await llamarApi("/api/auth/logout", { metodo: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      {/* Barra superior para pantallas angostas: marca y botón del menú. */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-sidebar px-4 py-3 md:hidden">
        <Marca />
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className={cn("grid size-10 place-items-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent", FOCO_MENU)}
          aria-label="Abrir menú"
          aria-expanded={abierto}
          aria-controls="menu-panel"
        >
          <Menu className="size-5" />
        </button>
      </header>

      {/* Fondo oscurecido detrás del panel móvil; un clic lo cierra. */}
      {abierto && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setAbierto(false)} aria-hidden="true" />
      )}

      <aside
        id="menu-panel"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-sidebar text-sidebar-foreground transition-transform duration-200 motion-reduce:transition-none",
          "md:sticky md:top-0 md:z-auto md:h-screen md:w-64 md:shrink-0 md:translate-x-0",
          // Cerrado en móvil: fuera de pantalla e invisible, para que no reciba foco con Tab.
          abierto ? "translate-x-0" : "-translate-x-full max-md:invisible",
        )}
      >
        <div className="flex items-center justify-between px-5 pt-6 pb-5">
          <Marca />
          <button
            type="button"
            onClick={() => setAbierto(false)}
            className={cn("grid size-9 place-items-center rounded-md hover:bg-sidebar-accent md:hidden", FOCO_MENU)}
            aria-label="Cerrar menú"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Menú principal">
          {grupos.map((grupo) => (
            <div key={grupo.titulo || "inicio"} className="mb-4">
              {grupo.titulo && <p className="mb-1 px-3 text-xs font-medium text-sidebar-muted">{grupo.titulo}</p>}
              <ul className="grid gap-0.5">
                {grupo.items.map((item) => {
                  const activo = rutaActual === item.href || rutaActual.startsWith(`${item.href}/`);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setAbierto(false)}
                        aria-current={activo ? "page" : undefined}
                        className={cn(
                          "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                          "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                          FOCO_MENU,
                          // Sección activa: fondo resaltado y barra "calafate" a la izquierda.
                          activo &&
                            "bg-sidebar-accent font-medium text-sidebar-accent-foreground before:absolute before:inset-y-1.5 before:left-0 before:w-1 before:rounded-full before:bg-calafate-claro",
                        )}
                      >
                        <item.icono className={cn("size-4 shrink-0", activo ? "text-calafate-claro" : "text-sidebar-muted")} />
                        {item.titulo}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Usuario en sesión y salida. */}
        <div className="flex items-center gap-3 border-t border-sidebar-border px-5 py-4">
          <span
            className="grid size-9 shrink-0 place-items-center rounded-full bg-sidebar-accent text-sm font-semibold text-sidebar-primary"
            aria-hidden="true"
          >
            {iniciales(sesion.nombre)}
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-medium text-sidebar-primary">{sesion.nombre}</p>
            <p className="text-xs text-sidebar-muted">{ETIQUETAS_ROL[sesion.rol]}</p>
          </div>
          <button
            type="button"
            onClick={salir}
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-md text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              FOCO_MENU,
            )}
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </aside>
    </>
  );
}
