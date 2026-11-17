import {
  Binoculars, CalendarClock, CalendarDays, ChartColumn, ClipboardList, LayoutDashboard, Mail, MapPin, Package,
  PawPrint, Stethoscope, Syringe, UserCog, Users, type LucideIcon,
} from "lucide-react";
import type { Accion } from "./permisos";

/** Ítem del menú lateral: se muestra solo si el rol tiene la acción indicada. */
export interface ItemNavegacion {
  titulo: string;
  href: string;
  icono: LucideIcon;
  accion: Accion;
}

/** Grupo del menú: reúne los módulos por tarea. Un título vacío indica que el grupo no lleva encabezado. */
export interface GrupoNavegacion {
  titulo: string;
  items: ItemNavegacion[];
}

/** Menú del panel agrupado por tarea. Los grupos sin ítems permitidos para el rol no se muestran. */
export const NAVEGACION: GrupoNavegacion[] = [
  {
    titulo: "",
    items: [{ titulo: "Inicio", href: "/dashboard", icono: LayoutDashboard, accion: "dashboard:ver" }],
  },
  {
    titulo: "Atención",
    items: [
      { titulo: "Turnos", href: "/turnos", icono: CalendarClock, accion: "turnos:ver" },
      { titulo: "Procedimientos", href: "/procedimientos", icono: Syringe, accion: "procedimientos:registrar" },
      { titulo: "Notificaciones", href: "/notificaciones", icono: Mail, accion: "notificaciones:ver" },
    ],
  },
  {
    titulo: "Registros",
    items: [
      { titulo: "Vecinos", href: "/vecinos", icono: Users, accion: "vecinos:ver" },
      { titulo: "Animales", href: "/animales", icono: PawPrint, accion: "animales:ver" },
      { titulo: "Historial clínico", href: "/historial", icono: ClipboardList, accion: "historial:ver" },
      { titulo: "Avistamientos", href: "/avistamientos", icono: Binoculars, accion: "avistamientos:ver" },
    ],
  },
  {
    titulo: "Programa",
    items: [
      { titulo: "Operativos", href: "/operativos", icono: CalendarDays, accion: "operativos:ver" },
      { titulo: "Insumos", href: "/insumos", icono: Package, accion: "insumos:ver" },
      { titulo: "Personal", href: "/personal", icono: Stethoscope, accion: "personal:ver" },
      { titulo: "Zonas", href: "/zonas", icono: MapPin, accion: "zonas:ver" },
      { titulo: "Reportes", href: "/reportes", icono: ChartColumn, accion: "reportes:ver" },
    ],
  },
  {
    titulo: "Administración",
    items: [{ titulo: "Usuarios", href: "/usuarios", icono: UserCog, accion: "usuarios:gestionar" }],
  },
];
