const cron = require('node-cron');

/**
 * ReminderEngine — Cronjob class, đóng gói toàn bộ logic Auto-Reminder:
 * quét hóa đơn UNPAID mỗi ngày và gửi thông báo theo đúng mốc thời gian.
 *
 *  Trước hạn: còn 7 ngày -> nhắc lần 1 | còn 5 ngày -> nhắc lần 2
 *  Sau hạn:  quá 3 ngày -> báo lần 1 | quá 5 ngày -> báo lần 2 | quá >=6 ngày -> nhắc mỗi ngày
 */
class ReminderEngine {
  constructor(invoiceRepository) {
    this.invoiceRepository = invoiceRepository;
  }

  /** @private */
  _daysBetween(dueDateStr, todayStr) {
    const due = new Date(dueDateStr + 'T00:00:00');
    const today = new Date(todayStr + 'T00:00:00');
    return Math.round((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  }

  /** @private */
  _todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  /** @private */
  _resolveStage(diffDays) {
    if (diffDays === 7) return { stage: 'PRE_DUE_1', message: 'Nhắc hạn lần 1: còn 7 ngày tới hạn thanh toán.' };
    if (diffDays === 5) return { stage: 'PRE_DUE_2', message: 'Nhắc hạn lần 2: còn 5 ngày tới hạn thanh toán.' };
    if (diffDays === -3) return { stage: 'OVERDUE_1', message: 'Báo quá hạn lần 1: hóa đơn đã quá hạn 3 ngày.' };
    if (diffDays === -5) return { stage: 'OVERDUE_2', message: 'Báo quá hạn lần 2: hóa đơn đã quá hạn 5 ngày.' };
    if (diffDays <= -6) return { stage: 'OVERDUE_DAILY', message: `Nhắc nợ hàng ngày: đã quá hạn ${-diffDays} ngày.` };
    return null;
  }

  /**
   * Gửi thông báo thực tế (email/SMS/Zalo ZNS/push) — hiện log ra console,
   * thay bằng lệnh gọi dịch vụ gửi tin thật khi triển khai production.
   * @private
   */
  async _sendNotification(invoice, stageInfo) {
    console.log(`[REMINDER] -> Phòng ${invoice.room_number} (${invoice.tenant_name}) | Hóa đơn #${invoice.id} | ${stageInfo.message}`);
  }

  /**
   * Chạy 1 lượt quét toàn bộ hóa đơn UNPAID. Gọi bởi lịch cron hoặc API thủ công.
   */
  async runOnce() {
    const today = this._todayISO();
    const invoices = await this.invoiceRepository.findAllUnpaid();

    let sentCount = 0;
    const details = [];

    for (const invoice of invoices) {
      const diffDays = this._daysBetween(invoice.due_date, today);
      const stageInfo = this._resolveStage(diffDays);
      if (!stageInfo) continue;

      await this._sendNotification(invoice, stageInfo);
      await this.invoiceRepository.incrementReminder(invoice.id);

      sentCount += 1;
      details.push({ invoice_id: invoice.id, room_number: invoice.room_number, stage: stageInfo.stage });
    }

    return { checked: invoices.length, sent: sentCount, details };
  }

  /**
   * Đăng ký lịch chạy tự động (mặc định 08:00 hằng ngày).
   */
  schedule(cronTime = '0 8 * * *') {
    cron.schedule(cronTime, async () => {
      console.log('⏰ [CRON] Bắt đầu quét nhắc nợ lúc', new Date().toISOString());
      try {
        const summary = await this.runOnce();
        console.log('✅ [CRON] Hoàn tất:', summary.checked, 'hóa đơn kiểm tra,', summary.sent, 'thông báo đã gửi.');
      } catch (err) {
        console.error('❌ [CRON] Lỗi khi chạy tiến trình nhắc nợ:', err.message);
      }
    });
    console.log(`⏱️  Đã đăng ký ReminderEngine: "${cronTime}"`);
  }
}

module.exports = ReminderEngine;
