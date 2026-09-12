const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  scanBill, createInvoice, getAllInvoices, getTenantInvoices, payInvoice, triggerReminders, bankWebhook,
} = require('../controllers/invoice.controller');

router.post('/scan-bill', authenticate, authorize('ADMIN'), upload.single('file'), scanBill);
router.post('/', authenticate, authorize('ADMIN'), createInvoice);
router.get('/admin', authenticate, authorize('ADMIN'), getAllInvoices);
router.get('/tenant', authenticate, authorize('TENANT'), getTenantInvoices);
router.put('/:id/pay', authenticate, payInvoice);
// Endpoint dùng cho Cronjob gọi hàng ngày — bảo vệ bằng CRON_SECRET thay vì JWT người dùng
// vì đây là lời gọi hệ thống-tới-hệ thống (server-to-server), không gắn với 1 phiên đăng nhập.
router.post('/trigger-reminders', triggerReminders);

// Webhook ngân hàng cho Gạch nợ tự động (Auto-Matching) — bảo vệ bằng x-webhook-secret
router.post('/bank-webhook', bankWebhook);

module.exports = router;
