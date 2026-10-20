const express = require('express');
const { authJwt } = require('../middlewares/authJwt');
const ctrl = require('../controllers/cartController');

// Las rutas ya no tienen lógica: solo asocian método y ruta con el controlador.
const router = express.Router();

router.use(authJwt); // RT-01: antes de cualquier ruta

router.get('/', ctrl.getCart); // HU-02
router.put('/items/:productId', ctrl.updateItem); // HU-03
// POST /items (Jeisson) · DELETE / y DELETE /items/:productId (Santiago)

module.exports = router;
