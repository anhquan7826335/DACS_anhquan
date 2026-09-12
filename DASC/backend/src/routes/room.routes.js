const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { getRooms, getRoomById, createRoom, updateRoom } = require('../controllers/room.controller');

router.get('/', authenticate, getRooms);
router.get('/:id', authenticate, getRoomById);
router.post('/', authenticate, authorize('ADMIN'), createRoom);
router.put('/:id', authenticate, authorize('ADMIN'), updateRoom);

module.exports = router;
