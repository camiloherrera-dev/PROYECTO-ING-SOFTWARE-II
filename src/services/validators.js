const AppError = require('../errors/AppError');

function validateQuantity(cantidad) {
  if (!Number.isInteger(cantidad) || cantidad <= 0) {
    throw new AppError(400, 'VALIDACION_FALLIDA', 'La cantidad debe ser un entero mayor a 0');
  }
}

function validateProductId(productId) {
  if (typeof productId !== 'string' || !productId.trim()) {
    throw new AppError(400, 'VALIDACION_FALLIDA', 'productId es obligatorio');
  }
}

module.exports = { validateQuantity, validateProductId };
