const cron = require('node-cron');
const { pool } = require('../config/db');
require('dotenv').config();

/**
 * Cơ chế Nhắc nợ & Nhắc hạn tự động (Auto-Reminder Engine).
 * Quét các hóa đơn payment_status = 'UNPAID' và so sánh due_date với ngày hiện tại:
 *
 *  Trước hạn:
 *    - Trước 7 ngày -> nhắc hạn lần 1
 *    - Trước 5 ngày -> nhắc hạn lần 2
 *  Sau hạn:
 *    - Quá hạn 3 ngày -> báo quá hạn lần 1
 *    - Quá hạn 5 ngày -> báo quá hạn lần 2
 *    - Sau 5 ngày quá hạn (ngày 6 trở đi) -> nhắc nợ mỗi ngày 1 lần cho đến khi PAID
 *
 * diffDays = (due_date - hôm_nay) tính theo ngày:
 *    diffDays > 0  => còn X ngày tới hạn
 *    diffDays = 0  => đúng hạn
 *    diffDays < 0  => đã quá hạn |diffDays| ngày
 */

function daysBetween(dueDateStr, todayStr) {
  const due = new Date(dueDateStr + 'T00:00:00');
  const today = new Date(todayStr + 'T00:00:00');
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((due.getTime() - today.getTime()) / msPerDay);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Xác định loại thông báo cần gửi cho 1 hóa đơn dựa trên diffDays.
 * Trả về null nếu ngày hôm nay không rơi vào mốc cần gửi nào.
 */
function resolveReminderStage(diffDays) {
  if (diffDays === 7) return { stage: 'PRE_DUE_1', message: 'Nhắc hạn lần 1: còn 7 ngày tới hạn thanh toán.' };
  if (diffDays === 5) return { stage: 'PRE_DUE_2', message: 'Nhắc hạn lần 2: còn 5 ngày tới hạn thanh toán.' };
  if (diffDays === -3) return { stage: 'OVERDUE_1', message: 'Báo quá hạn lần 1: hóa đơn đã quá hạn 3 ngày.' };
  if (diffDays === -5) return { stage: 'OVERDUE_2', message: 'Báo quá hạn lần 2: hóa đơn đã quá hạn 5 ngày.' };
  if (diffDays <= -6) return { stage: 'OVERDUE_DAILY', message: `Nhắc nợ hàng ngày: đã quá hạn ${-diffDays} ngày.` };
  return null;
}

/**
 * Gửi thông báo thực tế tới khách thuê. Tùy hạ tầng triển khai (email/SMS/Zalo ZNS/push notification),
 * thay thế phần console.log này bằng lệnh gọi dịch vụ gửi tin thật.
 */
async function sendNotification(invoice, stageInfo) {
  console.log(
    `[REMINDER] -> Phòng ${invoice.room_number} (${invoice.tenant_name}) | Hóa đơn #${invoice.id} | ${stageInfo.message}`
  );
  // TODO: tích hợp email/SMS/Zalo ZNS/push thực tế tại đây.
}

/**
 * Chạy 1 lượt quét toàn bộ hóa đơn UNPAID và gửi nhắc nợ theo đúng mốc.
 * Được gọi bởi lịch cron 08:00 hằng ngày, hoặc thủ công qua API /api/invoices/trigger-reminders.
 */
async function runReminderPass() {
  const today = todayISO();
  const [invoices] = await pool.query(`SELECT * FROM invoices WHERE payment_status = 'UNPAID'`);

  let sentCount = 0;
  const details = [];

  for (const invoice of invoices) {
    const diffDays = daysBetween(invoice.due_date, today);
    const stageInfo = resolveReminderStage(diffDays);
    if (!stageInfo) continue;

    await sendNotification(invoice, stageInfo);

    await pool.query(
      `UPDATE invoices SET last_reminder_sent_at = NOW(), reminder_count = reminder_count + 1 WHERE id = ?`,
      [invoice.id]
    );

    sentCount += 1;
    details.push({ invoice_id: invoice.id, room_number: invoice.room_number, stage: stageInfo.stage });
  }

  return { checked: invoices.length, sent: sentCount, details };
}

/**
 * Đăng ký lịch cron. Gọi 1 lần lúc khởi động server (xem app.js).
 * Bật/tắt qua biến môi trường ENABLE_REMINDER_CRON, đổi lịch qua REMINDER_CRON_TIME (mặc định 08:00 hàng ngày).
 */
function scheduleReminderCron() {
  if (process.env.ENABLE_REMINDER_CRON !== 'true') {
    console.log('⏸️  Auto-Reminder Cron đang TẮT (ENABLE_REMINDER_CRON != true).');
    return;
  }
  const cronTime = process.env.REMINDER_CRON_TIME || '0 8 * * *';
  cron.schedule(cronTime, async () => {
    console.log('⏰ [CRON] Bắt đầu quét nhắc nợ lúc', new Date().toISOString());
    try {
      const summary = await runReminderPass();
      console.log('✅ [CRON] Hoàn tất:', summary.checked, 'hóa đơn được kiểm tra,', summary.sent, 'thông báo đã gửi.');
    } catch (err) {
      console.error('❌ [CRON] Lỗi khi chạy tiến trình nhắc nợ:', err.message);
    }
  });
  console.log(`⏱️  Đã đăng ký Auto-Reminder Cron: "${cronTime}"`);
}

module.exports = { scheduleReminderCron, runReminderPass };
