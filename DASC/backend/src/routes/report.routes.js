const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { controllers } = require('../container');

const { reportController } = controllers;

router.get('/revenue', authenticate, authorize('ADMIN'), reportController.revenue);
router.get('/revenue/export', authenticate, authorize('ADMIN'), reportController.exportRevenue);

module.exports = router;
