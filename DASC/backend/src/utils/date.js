/**
 * Tiện ích ngày (chuỗi 'YYYY-MM-DD'). "Hôm nay" tính theo múi giờ ứng dụng
 * (APP_TIMEZONE, mặc định Asia/Ho_Chi_Minh) chứ không theo UTC, để khách không bị
 * chặn/cho qua nhầm ngày vào khung giờ sáng sớm.
 */
const DAY_MS = 86400000;

function todayInAppTz() {
  const tz = process.env.APP_TIMEZONE || 'Asia/Ho_Chi_Minh';
  // 'en-CA' cho định dạng YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
}

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function addDays(date, days) {
  return new Date(new Date(`${date}T00:00:00.000Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

/** Số ngày giữa 2 mốc, tính cả ngày bắt đầu và ngày kết thúc. */
function countDaysInclusive(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00.000Z`).getTime();
  const end = new Date(`${endDate}T00:00:00.000Z`).getTime();
  return Math.floor((end - start) / DAY_MS) + 1;
}

/** Đơn giá thuê ngày mặc định = giá phòng tháng / 30, làm tròn về đồng (khớp BIGINT daily_fee). */
function dailyRateFromMonthly(monthlyPrice) {
  return Math.round(Number(monthlyPrice) / 30);
}

/** Cộng `months` tháng (kẹp về ngày cuối tháng nếu cần: 31/01 + 1 tháng = 28/02). */
function addMonths(date, months) {
  const [y, m, d] = date.split('-').map(Number);
  const total = (m - 1) + months;
  const ty = y + Math.floor(total / 12);
  const tm = ((total % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  return new Date(Date.UTC(ty, tm, Math.min(d, lastDay))).toISOString().slice(0, 10);
}

/** Thời điểm hiện tại theo múi giờ ứng dụng, dạng 'YYYY-MM-DD HH:MM:SS' (để ghi vào cột DATETIME). */
function nowInAppTz() {
  const tz = process.env.APP_TIMEZONE || 'Asia/Ho_Chi_Minh';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

module.exports = {
  todayInAppTz, isValidDate, addDays, addMonths, countDaysInclusive, dailyRateFromMonthly, nowInAppTz,
};
