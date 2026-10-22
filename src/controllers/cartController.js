const cartService = require('../services/cartService');

// RNF-02: el userId SIEMPRE viene de req.userId (lo pone authJwt desde el token).
// Nunca se lee de req.body, req.query ni req.params.
const handle = (fn) => async (req, res, next) => {
  try { await fn(req, res); } catch (e) { next(e); }
};

module.exports = {
  getCart: handle(async (req, res) => { // HU-02 (Camilo)
    res.status(200).json(await cartService.getCart(req.userId));
  }),

  updateItem: handle(async (req, res) => { // HU-03 (movido desde la ruta)
    const { cantidad } = req.body || {};
    res.status(200).json(await cartService.updateQuantity(req.userId, req.params.productId, cantidad));
  }),

  // addItem: Jeisson · removeItem y clearCart: Santiago
};
