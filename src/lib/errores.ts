/**
 * Errores de aplicación con su código HTTP asociado.
 * Los servicios lanzan estos errores y `manejarApi()` los convierte en respuestas JSON.
 */
export class ErrorAplicacion extends Error {
  constructor(
    mensaje: string,
    /** Código de estado HTTP con el que se responde. */
    public readonly estado: number,
    /** Errores asociados a campos del formulario (campo → mensaje). */
    public readonly campos?: Record<string, string>,
  ) {
    super(mensaje);
    this.name = new.target.name;
  }
}

/** 400: datos de entrada inválidos. */
export class ValidacionError extends ErrorAplicacion {
  constructor(mensaje: string, campos?: Record<string, string>) {
    super(mensaje, 400, campos);
  }
}

/** 401: no hay sesión válida o las credenciales son incorrectas. */
export class NoAutenticadoError extends ErrorAplicacion {
  constructor(mensaje = "Debe iniciar sesión para continuar") {
    super(mensaje, 401);
  }
}

/** 403: hay sesión, pero el rol no tiene permiso para la acción. */
export class ProhibidoError extends ErrorAplicacion {
  constructor(mensaje = "No tiene permisos para realizar esta acción") {
    super(mensaje, 403);
  }
}

/** 404: el recurso solicitado no existe. */
export class NoEncontradoError extends ErrorAplicacion {
  constructor(mensaje = "El registro solicitado no existe") {
    super(mensaje, 404);
  }
}

/** 409: la operación viola una regla de negocio. */
export class ReglaNegocioError extends ErrorAplicacion {
  constructor(mensaje: string) {
    super(mensaje, 409);
  }
}
