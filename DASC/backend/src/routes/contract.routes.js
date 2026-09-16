const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { controllers } = require('../container');

const { contractController } = controllers;

router.post('/', authenticate, authorize('ADMIN'), contractController.createContract);
router.get('/my', authenticate, authorize('TENANT'), contractController.getMyActiveContract);
router.get('/room/:roomId', authenticate, contractController.getActiveContractByRoom);
router.put('/:id/terminate', authenticate, authorize('ADMIN'), contractController.terminateContract);

module.exports = router;
