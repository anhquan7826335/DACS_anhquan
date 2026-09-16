const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { controllers } = require('../container');

const { roomController } = controllers;

router.get('/', authenticate, roomController.getRooms);
router.get('/:id', authenticate, roomController.getRoomById);
router.post('/', authenticate, authorize('ADMIN'), roomController.createRoom);
router.put('/:id', authenticate, authorize('ADMIN'), roomController.updateRoom);

module.exports = router;
