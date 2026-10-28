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
  // confirmCheckout: Camilo (HU-10)
};