const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/env');
const AppError = require('../errors/AppError');

function authJwt(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    throw new AppError(401, 'NO_AUTORIZADO', 'Token no proporcionado');
  }

  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw new AppError(401, 'NO_AUTORIZADO', 'Formato de token inválido');
  }

  try {
    const payload = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
    req.userId = String(payload.sub);
    next();
  } catch (err) {
    throw new AppError(401, 'NO_AUTORIZADO', 'Token inválido o expirado');
  }
}

module.exports = { authJwt };
