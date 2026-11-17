const app = require('./app');
const { port, autoMigrate, shutdownTimeoutMs } = require('./config/env');
const { connectRedis, disconnectRedis } = require('./redis/redisClient');
const { connectDb, pool } = require('./db/pool');
const { runMigrations } = require('./db/migrate');
const { registrarEnEureka } = require('./clients/registroEureka');
const { getActiveRules } = require('./discounts/discountRules');

async function start() {
  await connectRedis(); // obligatorio: sin Redis no hay carrito

  try {
    await connectDb();
    if (autoMigrate) await runMigrations(pool);
  } catch (e) {
    // PostgreSQL es opcional: el carrito arranca sin histórico y /ready informa "degraded"
    console.error('PostgreSQL no disponible al arrancar (modo degradado):', e.message);
  }
  // Precarga las reglas de descuento: la primera petición no espera a PostgreSQL (DISCOUNT_TIMEOUT_MS es corto)
  await getActiveRules().catch(() => {});

  const server = app.listen(port, () => console.log(`Carrito escuchando en :${port}`));

  // Se anuncia en Eureka (solo si EUREKA_URL está definida). El estado sale de /ready: DOWN si se cae Redis.
  const registro = registrarEnEureka({
    app: 'carrito',
    puerto: port,
    rutaSalud: '/ready',
    comprobarSalud: () => fetch(`http://localhost:${port}/ready`).then((r) => r.ok, () => false),
  });

  // Cierre ordenado: deja de aceptar peticiones, termina las que están en curso y cierra Redis y PostgreSQL
  let cerrando = false;
  function shutdown(senal) {
    if (cerrando) return;
    cerrando = true;
    console.log(`${senal} recibido: cerrando el servicio...`);
    const forzar = setTimeout(() => {
      console.error('Cierre forzado por tiempo');
      process.exit(1);
    }, shutdownTimeoutMs);
    forzar.unref();
    // Se despide de Eureka primero, para que nadie más lo busque mientras termina.
    const despedida = registro ? registro.detener() : Promise.resolve();
    server.close(async () => {
      await Promise.allSettled([despedida, disconnectRedis(), pool.end()]);
      clearTimeout(forzar);
      process.exit(0);
    });
  }
  ['SIGTERM', 'SIGINT'].forEach((s) => process.on(s, () => shutdown(s)));
}

start().catch((e) => {
  console.error('No se pudo iniciar el servicio:', e.message);
  process.exit(1);
});
