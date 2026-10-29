"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DatosSesion } from "@/lib/auth";
import { llamarApi } from "@/lib/cliente-api";
import { ETIQUETAS_ROL } from "@/lib/etiquetas";
import { NAVEGACION } from "@/lib/navegacion";
import { tienePermiso } from "@/lib/permisos";
import { cn } from "@/lib/utils";

/** Menú lateral del panel: muestra solo los módulos permitidos para el rol de la sesión. */
export function BarraLateral({ sesion }: { sesion: DatosSesion }) {
  const rutaActual = usePathname();
  const router = useRouter();
  const items = NAVEGACION.filter((item) => tienePermiso(sesion.rol, item.accion));

  async function salir() {
    await llamarApi("/api/auth/logout", { metodo: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r bg-sidebar p-4">
      <div className="mb-6 px-2">
        <p className="text-lg font-semibold">SIGCAN</p>
        <p className="text-xs text-muted-foreground">Castración y Chipeo — Río Grande</p>
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {items.map((item) => {
          const activo = rutaActual === item.href || rutaActual.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted",
                activo && "bg-muted font-medium",
              )}
            >
              <item.icono className="size-4" />
              {item.titulo}
            </Link>
          );
        })}
      </nav>
      <div className="border-t pt-4">
        <p className="truncate px-2 text-sm font-medium">{sesion.nombre}</p>
        <p className="px-2 text-xs text-muted-foreground">{ETIQUETAS_ROL[sesion.rol]}</p>
        <Button variant="ghost" size="sm" className="mt-2 w-full justify-start" onClick={salir}>
          <LogOut /> Cerrar sesión
        </Button>
      </div>
    </aside>
  );
}
