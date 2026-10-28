const express = require('express');
const { authJwt } = require('../middlewares/authJwt');
const ctrl = require('../controllers/cartController');
const checkoutCtrl = require('../controllers/checkoutController');

// Las rutas no tienen lógica: solo asocian método y ruta con el controlador.
const router = express.Router();
router.use(authJwt); // RT-01: antes de cualquier ruta

router.get('/', ctrl.getCart); // HU-02 (Camilo)
router.delete('/', ctrl.clearCart); // HU-05 (Santiago)
router.post('/items', ctrl.addItem); // HU-01 (Jeisson)
router.put('/items/:productId', ctrl.updateItem); // HU-03
router.delete('/items/:productId', ctrl.removeItem); // HU-04 (Santiago)

router.get('/disponibilidad', checkoutCtrl.checkAvailability); // HU-09 (Jose David)
router.post('/checkout', checkoutCtrl.createCheckout); // HU-08 (Santiago)

module.exports = router;