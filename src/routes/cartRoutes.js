const express = require('express');
const { authJwt } = require('../middlewares/authJwt');

const router = express.Router();

router.use(authJwt);

// TODO: Conectar con cartService.getCart (Jeisson/Santiago)
router.get('/', (req, res) => {
  res.status(501).json({ codigo: 'NO_IMPLEMENTADO', mensaje: 'Endpoint en construcción' });
});

module.exports = router;
