const availabilityService = require('../services/availabilityService');
const checkoutService = require('../services/checkoutService');

// RNF-02: el userId SIEMPRE sale de req.userId (authJwt, claim sub).
const handle = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (e) {
    next(e);
  }
};

module.exports = {
  checkAvailability: handle(async (req, res) => { // HU-09 (Jose David)
    res.status(200).json(await availabilityService.checkAvailability(req.userId));
  }),
  createCheckout: handle(async (req, res) => { // HU-08 (Santiago)
    res.status(201).json(await checkoutService.createCheckout(req.userId));
  }),
  confirmCheckout: handle(async (req, res) => { // HU-10 (Camilo)
    const { pedido, creado } = await checkoutService.confirmCheckout(req.userId, req.params.checkoutId);
    res.status(creado ? 201 : 200).json(pedido); // 201 = pedido nuevo, 200 = ya estaba confirmado
  }),
};