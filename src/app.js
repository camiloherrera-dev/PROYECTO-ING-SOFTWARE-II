const express = require('express');
const cartRoutes = require('./routes/cartRoutes');
const { createHealthRouter } = require('./routes/healthRoutes');
const { notFound, errorHandler } = require('./middlewares/errorHandler');

const app = express();

app.use(express.json());

app.use(createHealthRouter()); // /health y /ready
app.use('/api/carrito', cartRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
