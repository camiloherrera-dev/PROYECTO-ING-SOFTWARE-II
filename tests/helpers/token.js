const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../../src/config/env');

function makeToken(userId = 'usr_test') {
  return jwt.sign(
    { sub: userId },
    jwtSecret,
    { expiresIn: '8h' }
  );
}

module.exports = { makeToken };
