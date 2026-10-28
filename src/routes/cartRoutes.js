const express = require('express');
const { authJwt } = require('../middlewares/authJwt');
const ctrl = require('../controllers/cartController');
const cartService = require('../services/cartService');

// Las rutas ya no tienen lógica: solo asocian método y ruta con el controlador.
const router = express.Router();

router.use(authJwt); // RT-01: antes de cualquier ruta

router.get('/', ctrl.getCart); // HU-02 (Camilo)
router.post('/items', ctrl.addItem); // HU-01 (Jeisson)
router.put('/items/:productId', ctrl.updateItem); // HU-03

// HU-04 Eliminar producto (Santiago)
router.delete('/items/:productId', async (req, res, next) => {
  try {
    const cart = await cartService.removeItem(req.userId, req.params.productId);
    res.status(200).json(cart);
  } catch (err) {
    next(err);
  }
});

// HU-05 Vaciar carrito (Santiago)
router.delete('/', async (req, res, next) => {
  try {
    const cart = await cartService.clearCart(req.userId);
    res.status(200).json(cart);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
