const BaseController = require('./BaseController');

class InvoiceController extends BaseController {
  constructor(invoiceService, reminderEngine, cronSecret, bankWebhookSecret) {
    super();
    this.invoiceService = invoiceService;
    this.reminderEngine = reminderEngine;
    this.cronSecret = cronSecret;
    this.bankWebhookSecret = bankWebhookSecret;
  }

  scanBill = async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: 'Vui lòng đính kèm file ảnh hoặc PDF hóa đơn.' });
      const result = await this.invoiceService.scanBill(req.file.buffer, req.file.mimetype);
      return res.json(result);
    } catch (err) {
      return this.handleError(res, err, 'Lỗi khi quét hóa đơn.');
    }
  };

  createInvoice = async (req, res) => {
    try {
      const result = await this.invoiceService.createInvoice(req.body);
      return res.status(201).json({ ...result, message: 'Tạo hóa đơn thành công, đã sinh mã QR thanh toán.' });
    } catch (err) {
      return this.handleError(res, err, 'Lỗi máy chủ khi tạo hóa đơn.');
    }
  };

  getAllInvoices = async (req, res) => {
    try {
      const rows = await this.invoiceService.listAll(req.query);
      return res.json(rows);
    } catch (err) {
      return this.handleError(res, err);
    }
  };

  getTenantInvoices = async (req, res) => {
    try {
      const rows = await this.invoiceService.listForTenant(req.user.id);
      return res.json(rows);
    } catch (err) {
      return this.handleError(res, err);
    }
  };

  payInvoice = async (req, res) => {
    try {
      await this.invoiceService.markPaid(req.params.id);
      return res.json({ message: 'Đã cập nhật hóa đơn sang trạng thái Đã thanh toán.' });
    } catch (err) {
      return this.handleError(res, err);
    }
  };

  triggerReminders = async (req, res) => {
    try {
      const secret = req.headers['x-cron-secret'];
      if (this.cronSecret && secret !== this.cronSecret) {
        return res.status(401).json({ message: 'Thiếu hoặc sai x-cron-secret.' });
      }
      const summary = await this.reminderEngine.runOnce();
      return res.json({ message: 'Đã chạy tiến trình nhắc nợ.', ...summary });
    } catch (err) {
      return this.handleError(res, err, 'Lỗi máy chủ khi chạy tiến trình nhắc nợ.');
    }
  };

  bankWebhook = async (req, res) => {
    try {
      const secret = req.headers['x-webhook-secret'];
      if (this.bankWebhookSecret && secret !== this.bankWebhookSecret) {
        return res.status(401).json({ message: 'Sai chữ ký webhook.' });
      }
      const matched = await this.invoiceService.handleBankWebhook(req.body);
      return res.json({ message: 'Gạch nợ tự động thành công.', invoice_id: matched.id });
    } catch (err) {
      return this.handleError(res, err, 'Lỗi máy chủ khi xử lý webhook ngân hàng.');
    }
  };
}

module.exports = InvoiceController;
