const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { controllers } = require('../container');

const { authController } = controllers;

router.post('/login', authController.login);
router.post('/register', authController.register);
router.get('/tenant-lookup', authenticate, authorize('ADMIN'), authController.lookupTenant);

module.exports = router;
