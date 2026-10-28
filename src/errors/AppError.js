class AppError extends Error {
  // detalles (opcional): campos extra que viajan en la respuesta, p. ej. { items: [...] }
  constructor(status, codigo, mensaje, detalles) {
    super(mensaje);
    this.name = 'AppError';
    this.status = status;
    this.codigo = codigo;
    this.detalles = detalles;
  }
}

module.exports = AppError;
