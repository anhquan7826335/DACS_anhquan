const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  createContract, getActiveContractByRoom, terminateContract, getMyActiveContract,
} = require('../controllers/contract.controller');

router.post('/', authenticate, authorize('ADMIN'), createContract);
router.get('/my', authenticate, authorize('TENANT'), getMyActiveContract);
router.get('/room/:roomId', authenticate, getActiveContractByRoom);
router.put('/:id/terminate', authenticate, authorize('ADMIN'), terminateContract);

module.exports = router;
