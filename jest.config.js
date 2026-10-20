module.exports = {
  testEnvironment: 'node',
  // tests/node/ usa node:test (HU-02): lo ejecuta "npm run test:node", no Jest
  testPathIgnorePatterns: ['/node_modules/', '/tests/node/', '/Frontend/'],
};
