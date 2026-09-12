const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  analyzeImage, createTicket, getTickets, updateTicketStatus,
} = require('../controllers/ticket.controller');

router.post('/analyze-image', authenticate, upload.single('file'), analyzeImage);
router.post('/', authenticate, authorize('TENANT'), createTicket);
router.get('/', authenticate, authorize('ADMIN'), getTickets);
router.put('/:id', authenticate, authorize('ADMIN'), updateTicketStatus);

module.exports = router;
