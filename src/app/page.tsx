import { Button } from "@/components/ui/button";

/** Página provisoria de la Fase 0: confirma que el frontend y los estilos funcionan. */
export default function Inicio() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-3xl font-semibold">SIGCAN</h1>
      <p className="text-muted-foreground">Sistema de Gestión de Castración y Chipeo Animal — Río Grande</p>
      <Button render={<a href="/api/salud" />}>Verificar conexión con la base de datos</Button>
    </main>
  );
}
