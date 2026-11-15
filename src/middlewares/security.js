const AppError = require('../errors/AppError');
const { rateLimitMax, rateLimitWindowMs } = require('../config/env');

// Las respuestas del carrito son privadas: no se guardan en cachés
function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  next();
}

function createRateLimit({ max = rateLimitMax, windowMs = rateLimitWindowMs, now = () => Date.now() } = {}) {
  const golpes = new Map(); // clave (userId o IP) → { cuenta, reinicioEn }
  const limpieza = setInterval(() => {
    const t = now();
    golpes.forEach((v, k) => { if (v.reinicioEn <= t) golpes.delete(k); });
  }, windowMs);
  limpieza.unref(); // no mantiene vivo el proceso ni cuelga las pruebas

  return function rateLimit(req, res, next) {
    const clave = req.userId || req.ip;
    const t = now();
    let entrada = golpes.get(clave);
    if (!entrada || entrada.reinicioEn <= t) {
      entrada = { cuenta: 0, reinicioEn: t + windowMs };
      golpes.set(clave, entrada);
    }
    entrada.cuenta += 1;
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - entrada.cuenta)));
    if (entrada.cuenta > max) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((entrada.reinicioEn - t) / 1000))));
      return next(new AppError(429, 'DEMASIADAS_PETICIONES', 'Demasiadas peticiones; intenta de nuevo en unos segundos'));
    }
    return next();
  };
}

module.exports = { securityHeaders, createRateLimit, rateLimit: createRateLimit() };