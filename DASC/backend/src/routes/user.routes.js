const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { controllers } = require('../container');

const { userController } = controllers;

router.get('/me', authenticate, userController.me);
router.put('/me', authenticate, userController.updateMe);
router.get('/', authenticate, authorize('ADMIN'), userController.list);
router.put('/:id/active', authenticate, authorize('ADMIN'), userController.setActive);
router.put('/:id', authenticate, authorize('ADMIN'), userController.update);
router.delete('/:id', authenticate, authorize('ADMIN'), userController.remove);

module.exports = router;
