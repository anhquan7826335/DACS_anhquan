const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const uploadAvatar = require('../middleware/uploadAvatar');
const { controllers } = require('../container');

const { authController } = controllers;

router.post('/login', authController.login);
router.post('/register', authController.register);
router.post('/logout', authController.logout);
router.post('/change-password', authenticate, authController.changePassword);
router.put('/avatar', authenticate, uploadAvatar.single('avatar'), authController.uploadAvatar);
router.get('/tenant-lookup', authenticate, authorize('ADMIN'), authController.lookupTenant);

module.exports = router;
