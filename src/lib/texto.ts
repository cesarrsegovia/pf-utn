/** Utilidades de texto compartidas por servidor y cliente. */

/** Minúsculas y sin tildes, para comparar textos ingresados por el usuario. */
export function normalizarTexto(texto: string): string {
  // NFD separa cada letra de su tilde (U+0300 a U+036F), que luego se elimina.
  return texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Escapa los comodines de LIKE (`%`, `_` y `\`) para buscar el texto en forma literal. */
export function escaparLike(texto: string): string {
  return texto.replace(/[\\%_]/g, "\\$&");
}
