const express = require('express');
const router = express.Router();
const { login, register, lookupTenant } = require('../controllers/auth.controller');
const { authenticate, authorize } = require('../middleware/auth');

router.post('/login', login);
router.post('/register', register);
router.get('/tenant-lookup', authenticate, authorize('ADMIN'), lookupTenant);

module.exports = router;
