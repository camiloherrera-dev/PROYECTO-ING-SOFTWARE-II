const cartService = require('../services/cartService');
const availabilityService = require('../services/availabilityService');

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

  addItem: handle(async (req, res) => { // HU-01 (Jeisson)
    const { productId, cantidad } = req.body || {};
    const { created, cart } = await cartService.addItem(req.userId, productId, cantidad);
    res.status(created ? 201 : 200).json(cart); // 201 = primera vez, 200 = ya existía
  }),

  // HU-09 (Jose David): verificar disponibilidad
  checkAvailability: handle(async (req, res) => {
    res.status(200).json(await availabilityService.checkAvailability(req.userId));
  }),

  // removeItem y clearCart: Santiago
};
