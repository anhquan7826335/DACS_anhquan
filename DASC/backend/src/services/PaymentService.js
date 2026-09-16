/**
 * PaymentService — Service tích hợp thanh toán:
 *  1. Sinh mã QR VietQR tự động cho từng hóa đơn.
 *  2. Xử lý Webhook ngân hàng để tự động đối soát & chuyển hóa đơn sang PAID (Auto-Matching).
 */
class PaymentService {
  constructor({ bankCode, accountNo, accountName, template = 'compact2' }, invoiceRepository) {
    this.bankCode = bankCode;
    this.accountNo = accountNo;
    this.accountName = accountName;
    this.template = template;
    this.invoiceRepository = invoiceRepository;
  }

  buildTransferContent(roomNumber, invoiceId) {
    return `SEV${roomNumber}${invoiceId}`.replace(/\s+/g, '').toUpperCase();
  }

  generateQRCode({ amount, roomNumber, invoiceId }) {
    const addInfo = this.buildTransferContent(roomNumber, invoiceId);
    const params = new URLSearchParams({
      amount: String(Math.round(amount)),
      addInfo,
      accountName: this.accountName || '',
    });
    const url = `https://img.vietqr.io/image/${this.bankCode}-${this.accountNo}-${this.template}.png?${params.toString()}`;
    return { qrUrl: url, transferContent: addInfo };
  }

  /**
   * Xử lý payload webhook ngân hàng: tìm hóa đơn UNPAID có nội dung chuyển khoản khớp,
   * đối chiếu số tiền, rồi tự động đánh dấu PAID (Auto-Matching / gạch nợ tự động).
   * Trả về hóa đơn đã khớp, hoặc throw lỗi nếu không tìm thấy / số tiền không đủ.
   */
  async processBankWebhook({ content, amount }) {
    if (!content) throw new Error('Thiếu nội dung chuyển khoản.');

    const unpaidInvoices = await this.invoiceRepository.findAllUnpaid();
    const normalizedContent = content.replace(/\s+/g, '').toUpperCase();

    const matched = unpaidInvoices.find((inv) => {
      const expected = this.buildTransferContent(inv.room_number, inv.id);
      return normalizedContent.includes(expected);
    });

    if (!matched) {
      const err = new Error('Không khớp được hóa đơn nào với nội dung chuyển khoản.');
      err.status = 404;
      throw err;
    }
    if (amount != null && Number(amount) < Number(matched.total_amount)) {
      const err = new Error('Số tiền chuyển khoản nhỏ hơn số tiền hóa đơn, cần đối soát thủ công.');
      err.status = 409;
      throw err;
    }

    await this.invoiceRepository.markPaid(matched.id);
    return matched;
  }
}

module.exports = PaymentService;
