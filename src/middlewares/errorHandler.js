const AppError = require('../errors/AppError');

function notFound(req, res, next) {
  const error = new AppError(404, 'RUTA_NO_ENCONTRADA', 'Ruta no encontrada');
  next(error);
}

function errorHandler(err, req, res, next) {
  console.error(err);

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ codigo: 'VALIDACION_FALLIDA', mensaje: err.message || 'JSON inválido' });
  }

  const status = err.status || 500;
  const codigo = err.codigo || 'ERROR_INTERNO';
  const mensaje = err.message || 'Error interno del servidor';
  res.status(status).json({ codigo, mensaje });
}

module.exports = { notFound, errorHandler };
