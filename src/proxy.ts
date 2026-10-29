import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESION, verificarSesion } from "@/lib/auth";

/** Páginas accesibles sin sesión. */
const RUTAS_PUBLICAS = ["/login"];

/**
 * Chequeo optimista de sesión antes de renderizar páginas (Next.js 16: proxy.ts,
 * runtime Node.js). Solo verifica la firma del JWT para redirigir rápido; la
 * autorización real se hace en cada página (`exigirPermisoPagina`) y Route Handler
 * (`requerirSesion`), que además revalidan al usuario contra la base.
 * Las rutas /api quedan excluidas: responden 401/403 en JSON por sí mismas.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sesion = await verificarSesion(request.cookies.get(COOKIE_SESION)?.value);
  const esPublica = RUTAS_PUBLICAS.includes(pathname);

  if (!sesion && !esPublica) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (sesion && esPublica) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Todo excepto API, archivos internos de Next y recursos estáticos (con extensión).
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
