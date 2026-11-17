/** Estado de carga de las páginas del panel mientras el servidor prepara la respuesta. */
export default function CargandoPanel() {
  return (
    <div role="status" aria-live="polite" className="grid gap-4">
      {/* Esqueleto con la misma forma que una página: título, descripción y tabla. */}
      <div className="h-9 w-64 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
      <div className="h-4 w-96 max-w-full animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
      <div className="mt-2 h-72 animate-pulse rounded-lg border bg-card motion-reduce:animate-none" />
      <span className="sr-only">Cargando…</span>
    </div>
  );
}
