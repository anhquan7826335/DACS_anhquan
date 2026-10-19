const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { controllers } = require('../container');

const { supportController } = controllers;

router.use(authenticate);
router.get('/', supportController.getHistory);
router.post('/', supportController.ask);

module.exports = router;