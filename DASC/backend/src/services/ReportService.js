const ExcelJS = require('exceljs');
const { httpError } = require('../utils/httpError');
const { isValidDate, todayInAppTz, countDaysInclusive } = require('../utils/date');

const MONEY = '#,##0';
const STATUS_VI = { PAID: 'Đã thanh toán', UNPAID: 'Chưa thanh toán' };
const METHOD_VI = { CASH: 'Tiền mặt', BANK_TRANSFER: 'Chuyển khoản', MOMO: 'Ví MoMo', OTHER: 'Khác' };

function styleHeader(row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
  row.alignment = { vertical: 'middle', horizontal: 'center' };
}

/** Ghi một sheet: columns = [{header,key,width,money?}], rows = object[], tùy chọn dòng tổng. */
function addSheet(wb, name, columns, rows, totalKeys = []) {
  const ws = wb.addWorksheet(name);
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width || 16, style: c.money ? { numFmt: MONEY } : {} }));
  styleHeader(ws.getRow(1));
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  rows.forEach((r) => ws.addRow(r));
  if (totalKeys.length && rows.length) {
    const total = { [columns[0].key]: 'Tổng cộng' };
    totalKeys.forEach((k) => { total[k] = rows.reduce((s, r) => s + Number(r[k] || 0), 0); });
    const tr = ws.addRow(total);
    tr.font = { bold: true };
    tr.eachCell((cell) => { cell.border = { top: { style: 'thin' } }; });
  }
  return ws;
}

/**
 * ReportService — báo cáo doanh thu (admin) và xuất file Excel hóa đơn (admin / khách thuê).
 */
class ReportService {
  constructor(reportRepository, invoiceService) {
    this.reportRepository = reportRepository;
    this.invoiceService = invoiceService;
  }

  _params(q = {}) {
    const today = todayInAppTz();
    const basis = q.basis === 'period' ? 'period' : 'paid';
    const from = q.from || `${today.slice(0, 4)}-01-01`;
    const to = q.to || today;
    if (!isValidDate(from) || !isValidDate(to)) throw httpError(400, 'Khoảng thời gian không hợp lệ (định dạng YYYY-MM-DD).');
    if (from > to) throw httpError(400, 'Ngày bắt đầu không được sau ngày kết thúc.');
    const days = countDaysInclusive(from, to);
    if (days > 366 * 5) throw httpError(400, 'Khoảng thời gian tối đa là 5 năm.');
    let group = q.group === 'day' ? 'day' : 'month';
    if (basis === 'period') group = 'month'; // kỳ hóa đơn chỉ có đơn vị tháng
    if (group === 'day' && days > 366) throw httpError(400, 'Xem theo ngày tối đa 366 ngày, hãy chọn xem theo tháng.');
    const idx = (d) => Number(d.slice(0, 4)) * 12 + Number(d.slice(5, 7));
    return { basis, group, from, to, fromIdx: idx(from), toIdx: idx(to) };
  }

  async revenue(q) {
    const p = this._params(q);
    const [series, by_room] = await Promise.all([
      this.reportRepository.series(p.basis, p.group, p),
      this.reportRepository.byRoom(p.basis, p),
    ]);
    const sum = (k) => series.reduce((s, r) => s + Number(r[k] || 0), 0);
    const summary = {
      invoices: sum('invoices'),
      billed: sum('billed'),
      collected: sum('collected'),
      components: {
        room_fee: sum('room_fee'), electricity_fee: sum('electricity_fee'),
        water_fee: sum('water_fee'), other_fee: sum('other_fee'),
      },
    };
    if (p.basis === 'paid') {
      const o = await this.reportRepository.outstandingByDue(p);
      summary.outstanding = o.amount;
      summary.outstanding_count = o.count;
    } else {
      summary.outstanding = summary.billed - summary.collected;
      summary.outstanding_count = null;
    }
    return { basis: p.basis, group: p.group, from: p.from, to: p.to, summary, series, by_room };
  }

  async revenueWorkbook(q) {
    const p = this._params(q);
    const data = await this.revenue(q);
    const detail = await this.reportRepository.detail(p.basis, p);
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Quản lý nhà trọ';

    const ws0 = wb.addWorksheet('Tổng quan');
    ws0.columns = [{ width: 34 }, { width: 22 }];
    ws0.addRow([`BÁO CÁO DOANH THU ${p.from} → ${p.to}`]).font = { bold: true, size: 14 };
    ws0.addRow(['Cách tính', p.basis === 'paid' ? 'Theo ngày thực thu' : 'Theo kỳ hóa đơn (phát sinh)']);
    ws0.addRow([]);
    const s = data.summary;
    [['Số hóa đơn', s.invoices], ['Tổng phát sinh', s.billed], ['Đã thu', s.collected],
      [p.basis === 'paid' ? 'Chưa thu (hạn trong khoảng)' : 'Chưa thu', s.outstanding],
      ['Tiền phòng', s.components.room_fee], ['Tiền điện', s.components.electricity_fee],
      ['Tiền nước', s.components.water_fee], ['Phụ phí', s.components.other_fee]]
      .forEach(([k, v]) => { const r = ws0.addRow([k, v]); r.getCell(2).numFmt = MONEY; });

    addSheet(wb, p.basis === 'paid' && p.group === 'day' ? 'Theo ngày' : 'Theo tháng', [
      { header: p.group === 'day' ? 'Ngày' : 'Tháng', key: 'key', width: 14 },
      { header: 'Số hóa đơn', key: 'invoices' },
      { header: 'Tiền phòng', key: 'room_fee', money: true }, { header: 'Tiền điện', key: 'electricity_fee', money: true },
      { header: 'Tiền nước', key: 'water_fee', money: true }, { header: 'Phụ phí', key: 'other_fee', money: true },
      { header: 'Phát sinh', key: 'billed', money: true }, { header: 'Đã thu', key: 'collected', money: true },
    ], data.series, ['invoices', 'room_fee', 'electricity_fee', 'water_fee', 'other_fee', 'billed', 'collected']);

    addSheet(wb, 'Theo phòng', [
      { header: 'Phòng', key: 'room_number', width: 12 }, { header: 'Số hóa đơn', key: 'invoices' },
      { header: 'Phát sinh', key: 'billed', money: true }, { header: 'Đã thu', key: 'collected', money: true },
    ], data.by_room, ['invoices', 'billed', 'collected']);

    addSheet(wb, 'Chi tiết hóa đơn', this._invoiceColumns(true),
      detail.map((r) => this._invoiceRow(r)), ['room_fee', 'electricity_fee', 'water_fee', 'other_fee', 'total_amount']);
    return wb;
  }

  _invoiceColumns(withTenant) {
    return [
      { header: 'Mã HĐ', key: 'id', width: 8 }, { header: 'Kỳ', key: 'period', width: 10 },
      { header: 'Phòng', key: 'room_number', width: 10 },
      ...(withTenant ? [{ header: 'Khách thuê', key: 'tenant_name', width: 22 }] : []),
      { header: 'Loại thuê', key: 'rental', width: 11 },
      { header: 'Tiền phòng', key: 'room_fee', money: true }, { header: 'Tiền điện', key: 'electricity_fee', money: true },
      { header: 'Tiền nước', key: 'water_fee', money: true }, { header: 'Phụ phí', key: 'other_fee', money: true },
      { header: 'Tổng cộng', key: 'total_amount', money: true },
      { header: 'Hạn thanh toán', key: 'due_date', width: 14 }, { header: 'Trạng thái', key: 'status', width: 16 },
      { header: 'Ngày thanh toán', key: 'paid_at', width: 20 }, { header: 'Phương thức', key: 'method', width: 14 },
    ];
  }

  _invoiceRow(r) {
    return {
      ...r,
      period: `${String(r.month).padStart(2, '0')}/${r.year}`,
      rental: r.rental_type === 'DAILY' ? 'Theo ngày' : 'Theo tháng',
      electricity_fee: r.electricity_fee ?? r.electricity ?? 0,
      water_fee: r.water_fee ?? r.water ?? 0,
      status: STATUS_VI[r.payment_status] || r.payment_status,
      method: r.payment_method ? (METHOD_VI[r.payment_method] || r.payment_method) : '',
      paid_at: r.paid_at || '',
    };
  }

  /** File Excel hóa đơn của một khách thuê trong khoảng from/to (YYYY-MM). */
  async tenantInvoicesWorkbook(tenantId, q = {}) {
    const rows = await this.invoiceService.listForTenant(tenantId, q);
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Quản lý nhà trọ';
    addSheet(wb, 'Hóa đơn', this._invoiceColumns(false), rows.map((r) => this._invoiceRow(r)),
      ['room_fee', 'electricity_fee', 'water_fee', 'other_fee', 'total_amount']);
    return wb;
  }
}

module.exports = ReportService;
