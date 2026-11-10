// Pruebas de integración: se corren con `npm run test:integration` y necesitan Redis y PostgreSQL levantados.
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/integration/**/*.int.test.js'],
  testTimeout: 20000,
};
