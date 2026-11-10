const express = require('express');
const cartRoutes = require('./routes/cartRoutes');
const { createHealthRouter } = require('./routes/healthRoutes');
const { securityHeaders } = require('./middlewares/security');
const { notFound, errorHandler } = require('./middlewares/errorHandler');

const app = express();
app.disable('x-powered-by');
app.use(securityHeaders);
app.use(express.json({ limit: '100kb' }));
app.use(createHealthRouter());
app.use('/api/carrito', cartRoutes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;