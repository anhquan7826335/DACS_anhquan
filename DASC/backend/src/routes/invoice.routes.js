const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { controllers } = require('../container');

const { invoiceController, reportController } = controllers;

router.post('/scan-bill', authenticate, authorize('ADMIN'), upload.single('file'), invoiceController.scanBill);
router.post('/', authenticate, authorize('ADMIN'), invoiceController.createInvoice);
router.get('/admin', authenticate, authorize('ADMIN'), invoiceController.getAllInvoices);
router.get('/tenant/export', authenticate, authorize('TENANT'), reportController.exportTenantInvoices);
router.get('/tenant', authenticate, authorize('TENANT'), invoiceController.getTenantInvoices);
router.put('/:id', authenticate, authorize('ADMIN'), invoiceController.updateInvoice);
router.delete('/:id', authenticate, authorize('ADMIN'), invoiceController.deleteInvoice);
router.put('/:id/pay', authenticate, authorize('ADMIN'), invoiceController.payInvoice);

// Endpoint hệ thống-tới-hệ thống, bảo vệ bằng secret riêng thay vì JWT người dùng
router.post('/trigger-reminders', invoiceController.triggerReminders);
router.post('/bank-webhook', invoiceController.bankWebhook);

module.exports = router;
