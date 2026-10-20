class AppError extends Error {
  constructor(status, codigo, mensaje) {
    super(mensaje);
    this.name = 'AppError';
    this.status = status;
    this.codigo = codigo;
  }
}

module.exports = AppError;
