// Base mínima para HU-02. Unificar con la configuración del equipo al integrar.
module.exports = {
  catalogBaseUrl: process.env.CATALOG_BASE_URL || 'http://localhost:4000',
  catalogTimeoutMs: Number(process.env.CATALOG_TIMEOUT_MS) || 3000,
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
};
