const AppError = require('../errors/AppError');

function notFound(req, res, next) {
  next(new AppError(404, 'RUTA_NO_ENCONTRADA', 'Ruta no encontrada'));
}

function errorHandler(err, req, res, next) {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ codigo: 'VALIDACION_FALLIDA', mensaje: 'El cuerpo no es un JSON válido' });
  }

  const status = err instanceof AppError ? err.status : 500;
  if (status >= 500) console.error(err);

  const codigo = err instanceof AppError ? err.codigo : 'ERROR_INTERNO';
  const mensaje = err instanceof AppError ? err.message : 'Error interno del servidor';
  res.status(status).json({ codigo, mensaje });
}

module.exports = { notFound, errorHandler };
