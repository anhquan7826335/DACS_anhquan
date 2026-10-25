const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const uploadRoomImage = require('../middleware/uploadRoomImage');
const { controllers } = require('../container');

const { roomController } = controllers;

router.get('/', authenticate, roomController.getRooms);
router.get('/:id', authenticate, roomController.getRoomById);
router.post('/', authenticate, authorize('ADMIN'), roomController.createRoom);
router.put('/:id', authenticate, authorize('ADMIN'), roomController.updateRoom);
router.delete('/:id', authenticate, authorize('ADMIN'), roomController.deleteRoom);
router.post('/:id/image', authenticate, authorize('ADMIN'), uploadRoomImage.single('image'), roomController.uploadImage);

module.exports = router;
