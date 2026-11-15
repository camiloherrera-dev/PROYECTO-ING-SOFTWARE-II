const AppError = require('../errors/AppError');

const CODIGOS_DE_RED = ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EPIPE'];
const esErrorDeInfraestructura = (err) => Boolean(err)
  && (err.name === 'MaxRetriesPerRequestError' || CODIGOS_DE_RED.includes(err.code));

function notFound(req, res, next) {
  next(new AppError(404, 'RUTA_NO_ENCONTRADA', 'Ruta no encontrada'));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ codigo: 'VALIDACION_FALLIDA', mensaje: 'El cuerpo no es un JSON válido' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(400).json({ codigo: 'VALIDACION_FALLIDA', mensaje: 'El cuerpo es demasiado grande' });
  }
  if (esErrorDeInfraestructura(err)) {
    console.error(err);
    return res.status(503).json({ codigo: 'SERVICIO_NO_DISPONIBLE', mensaje: 'El servicio no está disponible temporalmente' });
  }
  const status = err instanceof AppError ? err.status : 500;
  if (status >= 500) console.error(err);
  const codigo = err instanceof AppError ? err.codigo : 'ERROR_INTERNO';
  const mensaje = err instanceof AppError ? err.message : 'Error interno del servidor';
  // detalles va PRIMERO: así nunca puede pisar codigo ni mensaje
  const detalles = err instanceof AppError && err.detalles ? err.detalles : {};
  res.status(status).json({ ...detalles, codigo, mensaje });
}

module.exports = { notFound, errorHandler };