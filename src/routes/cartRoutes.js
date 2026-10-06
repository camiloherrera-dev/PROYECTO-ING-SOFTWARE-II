const express = require('express');
const { authJwt } = require('../middlewares/authJwt');
const cartService = require('../services/cartService');

const router = express.Router();

router.use(authJwt);

// TODO: Conectar con cartService.getCart (Jeisson/Santiago)
router.get('/', (req, res) => {
  res.status(501).json({ codigo: 'NO_IMPLEMENTADO', mensaje: 'Endpoint en construcción' });
});

router.put('/items/:productId', async (req, res, next) => {
  try {
    const cart = await cartService.updateQuantity(req.userId, req.params.productId, (req.body || {}).cantidad);
    res.status(200).json(cart);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
