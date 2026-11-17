const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { jwtSecret, keycloakLlaves, keycloakEmisor } = require('../config/env');
const AppError = require('../errors/AppError');

// Acepta dos clases de token:
//  - El de Keycloak (RS256), que llega del login del Host App. Se comprueba con la llave pública del
//    realm "tienda", que se descarga una vez y se guarda en memoria.
//  - El de pruebas (HS256, firmado con JWT_SECRET), como antes. Así las pruebas y VITE_DEV_TOKEN siguen
//    funcionando igual.
// En los dos casos el usuario sale del claim "sub" (RNF-02).

let llaves = null; // kid → llave pública

async function llaveDeKeycloak(kid) {
  if (!llaves || !llaves.has(kid)) {
    const respuesta = await fetch(keycloakLlaves);
    if (!respuesta.ok) throw new Error(`Keycloak respondió ${respuesta.status} al pedir las llaves`);
    const { keys } = await respuesta.json();
    llaves = new Map(
      keys
        .filter((k) => k.kty === 'RSA' && k.use === 'sig')
        .map((k) => [k.kid, crypto.createPublicKey({ key: k, format: 'jwk' })])
    );
  }
  return llaves.get(kid);
}

async function verificar(token) {
  const cabecera = jwt.decode(token, { complete: true })?.header;
  if (cabecera?.alg === 'RS256' && keycloakLlaves) {
    const llave = await llaveDeKeycloak(cabecera.kid);
    if (!llave) throw new Error('Llave de Keycloak desconocida');
    return jwt.verify(token, llave, { algorithms: ['RS256'], issuer: keycloakEmisor });
  }
  return jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
}

async function authJwt(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return next(new AppError(401, 'NO_AUTORIZADO', 'Token no proporcionado'));
  }

  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new AppError(401, 'NO_AUTORIZADO', 'Formato de token inválido'));
  }

  let payload;
  try {
    payload = await verificar(token);
  } catch (err) {
    return next(new AppError(401, 'NO_AUTORIZADO', 'Token inválido o expirado'));
  }

  if (typeof payload.sub !== 'string' || !payload.sub.trim()) {
    return next(new AppError(401, 'NO_AUTORIZADO', 'El token no identifica al usuario (sub)'));
  }

  req.userId = payload.sub;
  next();
}

module.exports = { authJwt };
