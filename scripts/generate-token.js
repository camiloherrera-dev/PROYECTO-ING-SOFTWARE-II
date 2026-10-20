#!/usr/bin/env node
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../src/config/env');

const userId = process.argv[2];

if (!userId) {
  console.error('Uso: npm run token -- <userId>');
  process.exit(1);
}

const token = jwt.sign(
  { sub: userId },
  jwtSecret,
  { expiresIn: '8h', algorithm: 'HS256' }
);

console.log(token);
