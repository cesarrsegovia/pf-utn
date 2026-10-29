/** Estado de carga de las páginas del panel mientras el servidor prepara la respuesta. */
export default function CargandoPanel() {
  return (
    <div role="status" aria-live="polite" className="grid gap-4">
      <div className="h-8 w-64 animate-pulse rounded-md bg-muted" />
      <div className="h-4 w-96 max-w-full animate-pulse rounded-md bg-muted" />
      <div className="h-64 animate-pulse rounded-lg bg-muted" />
      <span className="sr-only">Cargando…</span>
    </div>
  );
}
