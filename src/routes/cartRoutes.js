const express = require('express');
const { authJwt } = require('../middlewares/authJwt');
const ctrl = require('../controllers/cartController');

// Las rutas ya no tienen lógica: solo asocian método y ruta con el controlador.
const router = express.Router();

router.use(authJwt); // RT-01: antes de cualquier ruta

router.get('/', ctrl.getCart); // HU-02
router.post('/items', ctrl.addItem); // HU-01
router.put('/items/:productId', ctrl.updateItem); // HU-03
router.delete('/items/:productId', ctrl.removeItem); // HU-04 (Santiago)
router.delete('/', ctrl.clearCart); // HU-05 (Santiago)

module.exports = router;
