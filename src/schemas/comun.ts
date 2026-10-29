import { z } from "zod";

// Mensajes de validación de Zod en español para todo el sistema.
// Todos los esquemas deben importar `z` desde este módulo para heredar la configuración.
z.config(z.locales.es());

export { z };

/** Texto obligatorio, sin espacios sobrantes y con longitud máxima. */
export const textoRequerido = (maximo: number) =>
  z.string().trim().min(1, "Este campo es obligatorio").max(maximo, `Máximo ${maximo} caracteres`);

/** Identificador numérico recibido en la URL. */
export const esquemaId = z.coerce.number().int().positive();

/** Parámetros comunes de los listados: página, tamaño de página y texto de búsqueda. */
export const esquemaListado = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  tamanio: z.coerce.number().int().min(1).max(100).default(10),
  busqueda: z.string().trim().max(100).default(""),
});
export type ParametrosListado = z.infer<typeof esquemaListado>;

/** Respuesta estándar de los listados paginados. */
export interface ResultadoPaginado<T> {
  filas: T[];
  total: number;
  pagina: number;
  tamanio: number;
}

/** Texto opcional: admite cadena vacía (el servicio la guarda como NULL). */
export const textoOpcional = (maximo: number) => z.string().trim().max(maximo, `Máximo ${maximo} caracteres`);

/** Verdadero si el número tiene como máximo dos decimales (columnas NUMERIC(10,2)). */
const conDosDecimales = (valor: number) => Math.abs(valor * 100 - Math.round(valor * 100)) < 1e-6;

/** Cantidad de stock mayor a cero, con hasta dos decimales. */
export const cantidadPositiva = z
  .number("Ingrese un número")
  .positive("Debe ser mayor a 0")
  .max(99_999_999.99, "Cantidad demasiado grande")
  .refine(conDosDecimales, "Máximo 2 decimales");

/** Cantidad de stock mayor o igual a cero, con hasta dos decimales. */
export const cantidadNoNegativa = z
  .number("Ingrese un número")
  .min(0, "No puede ser negativo")
  .max(99_999_999.99, "Cantidad demasiado grande")
  .refine(conDosDecimales, "Máximo 2 decimales");

/** Opción de una lista desplegable (zonas, vecinos, usuarios vinculables…). */
export interface Opcion {
  id: number;
  etiqueta: string;
}

/** Filtro de estado de los listados con baja lógica (personal y vecinos). */
export const filtroEstado = z.enum(["activos", "inactivos", "todos"]).default("activos");
export type FiltroEstado = z.infer<typeof filtroEstado>;

/** Fecha YYYY-MM-DD (inputs type="date"). */
export const fechaValida = z.iso.date("Ingrese una fecha válida");

/** Hora HH:MM entre 00:00 y 23:59 (inputs type="time"). */
export const horaValida = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Ingrese una hora válida (HH:MM)");

/** Id elegido en una lista desplegable; el mensaje se muestra también si no se eligió nada (null). */
export const idSeleccionado = (mensaje: string) => z.number(mensaje).int(mensaje).positive(mensaje);
