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

/** Menú del panel. Cada fase agrega aquí los módulos que implementa. */
export const NAVEGACION: ItemNavegacion[] = [
  { titulo: "Inicio", href: "/dashboard", icono: LayoutDashboard, accion: "dashboard:ver" },
  { titulo: "Vecinos", href: "/vecinos", icono: Users, accion: "vecinos:ver" },
  { titulo: "Animales", href: "/animales", icono: PawPrint, accion: "animales:ver" },
  { titulo: "Operativos", href: "/operativos", icono: CalendarDays, accion: "operativos:ver" },
  { titulo: "Turnos", href: "/turnos", icono: CalendarClock, accion: "turnos:ver" },
  { titulo: "Procedimientos", href: "/procedimientos", icono: Syringe, accion: "procedimientos:registrar" },
  { titulo: "Historial clínico", href: "/historial", icono: ClipboardList, accion: "historial:ver" },
  { titulo: "Avistamientos", href: "/avistamientos", icono: Binoculars, accion: "avistamientos:ver" },
  { titulo: "Personal", href: "/personal", icono: Stethoscope, accion: "personal:ver" },
  { titulo: "Insumos", href: "/insumos", icono: Package, accion: "insumos:ver" },
  { titulo: "Reportes", href: "/reportes", icono: ChartColumn, accion: "reportes:ver" },
  { titulo: "Notificaciones", href: "/notificaciones", icono: Mail, accion: "notificaciones:ver" },
  { titulo: "Zonas", href: "/zonas", icono: MapPin, accion: "zonas:ver" },
  { titulo: "Usuarios", href: "/usuarios", icono: UserCog, accion: "usuarios:gestionar" },
];
