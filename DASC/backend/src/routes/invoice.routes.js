const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { controllers } = require('../container');

const { invoiceController } = controllers;

router.post('/scan-bill', authenticate, authorize('ADMIN'), upload.single('file'), invoiceController.scanBill);
router.post('/', authenticate, authorize('ADMIN'), invoiceController.createInvoice);
router.get('/admin', authenticate, authorize('ADMIN'), invoiceController.getAllInvoices);
router.get('/tenant', authenticate, authorize('TENANT'), invoiceController.getTenantInvoices);
router.put('/:id/pay', authenticate, invoiceController.payInvoice);

// Endpoint hệ thống-tới-hệ thống, bảo vệ bằng secret riêng thay vì JWT người dùng
router.post('/trigger-reminders', invoiceController.triggerReminders);
router.post('/bank-webhook', invoiceController.bankWebhook);

module.exports = router;
