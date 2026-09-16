const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { controllers } = require('../container');

const { ticketController } = controllers;

router.post('/analyze-image', authenticate, upload.single('file'), ticketController.analyzeImage);
router.post('/', authenticate, authorize('TENANT'), ticketController.createTicket);
router.get('/', authenticate, authorize('ADMIN'), ticketController.getTickets);
router.put('/:id', authenticate, authorize('ADMIN'), ticketController.updateTicketStatus);

module.exports = router;
