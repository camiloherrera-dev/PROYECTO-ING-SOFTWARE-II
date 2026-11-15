const historyService = require('../services/historyService');

// RNF-02: el userId SIEMPRE sale de req.userId (authJwt, claim sub).
const handle = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (e) {
    next(e);
  }
};

module.exports = {
  listOrders: handle(async (req, res) => {
    res.status(200).json(await historyService.listOrders(req.userId, req.query));
  }),
  getOrder: handle(async (req, res) => {
    res.status(200).json(await historyService.getOrder(req.userId, req.params.pedidoId));
  }),
};