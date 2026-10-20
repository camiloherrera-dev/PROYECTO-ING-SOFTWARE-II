const express = require('express');
const cartRoutes = require('./routes/cartRoutes');
const { notFound, errorHandler } = require('./middlewares/errorHandler');

const app = express();

app.use(express.json());

app.use('/api/carrito', cartRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
