const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { controllers } = require('../container');

const c = controllers.contractController;
const admin = [authenticate, authorize('ADMIN')];
const tenant = [authenticate, authorize('TENANT')];

router.post('/', ...admin, c.createContract);
router.get('/', ...admin, c.listContracts);
router.post('/request', ...tenant, c.requestRental);
router.get('/my', ...tenant, c.getMyActiveContract);
router.get('/mine', ...tenant, c.listMine);
router.get('/room/:roomId', ...admin, c.getActiveContractByRoom);
router.put('/:id/cancel', ...tenant, c.cancelRequest);
router.put('/:id/approve', ...admin, c.approve);
router.put('/:id/reject', ...admin, c.reject);
router.put('/:id/terminate', ...admin, c.terminateContract);
router.put('/:id', ...admin, c.updateContract);
router.delete('/:id', ...admin, c.deleteContract);

module.exports = router;
