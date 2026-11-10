module.exports = {
  testEnvironment: 'node',
  // tests/node/ usa node:test (lo corre "npm run test:node");
  // tests/integration/ necesita Redis y PostgreSQL reales (lo corre "npm run test:integration")
  testPathIgnorePatterns: ['/node_modules/', '/tests/node/', '/tests/integration/', '/Frontend/'],
};
