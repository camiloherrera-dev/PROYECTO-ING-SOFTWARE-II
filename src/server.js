const app = require('./app');
const { port } = require('./config/env');
const { connectRedis } = require('./redis/redisClient');

(async () => {
  await connectRedis();
  app.listen(port, () => console.log(`Carrito escuchando en :${port}`));
})().catch((e) => {
  console.error('No se pudo iniciar el servicio:', e.message);
  process.exit(1);
});
