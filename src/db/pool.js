// STUB temporal Sprint 4: el pool real lo instala Juan David (feature/infra-postgres-base).
// Mientras no esté, /ready informa "degraded" y el carrito funciona sin PostgreSQL.
const pool = {
  query: async () => { throw new Error('PostgreSQL no disponible (stub)'); },
  connect: async () => { throw new Error('PostgreSQL no disponible (stub)'); },
  end: async () => {},
};

async function connectDb() {
  console.warn('PostgreSQL no disponible (stub temporal de healthRoutes)');
}

module.exports = { pool, connectDb };