const BaseRepository = require('./BaseRepository');

/**
 * ReportRepository — truy vấn tổng hợp doanh thu từ bảng invoices.
 * basis = 'paid'   : tính theo NGÀY THỰC THU (paid_at) của hóa đơn đã thanh toán.
 * basis = 'period' : tính theo KỲ HÓA ĐƠN (tháng/năm phát sinh), gồm cả chưa thu.
 * SUM() của MySQL trả DECIMAL (chuỗi) nên luôn CAST sang SIGNED.
 */
class ReportRepository extends BaseRepository {
  _scope(basis, p) {
    if (basis === 'paid') {
      return { where: `i.payment_status = 'PAID' AND DATE(i.paid_at) BETWEEN ? AND ?`, params: [p.from, p.to] };
    }
    return { where: `(i.year * 12 + i.month) BETWEEN ? AND ?`, params: [p.fromIdx, p.toIdx] };
  }

  _key(basis, group) {
    if (basis === 'paid') return group === 'day' ? `DATE_FORMAT(i.paid_at, '%Y-%m-%d')` : `DATE_FORMAT(i.paid_at, '%Y-%m')`;
    return `CONCAT(i.year, '-', LPAD(i.month, 2, '0'))`;
  }

  async series(basis, group, p) {
    const { where, params } = this._scope(basis, p);
    const key = this._key(basis, group);
    return this.query(
      `SELECT ${key} AS \`key\`, COUNT(*) AS invoices,
         CAST(SUM(i.room_fee) AS SIGNED) AS room_fee, CAST(SUM(i.electricity_fee) AS SIGNED) AS electricity_fee,
         CAST(SUM(i.water_fee) AS SIGNED) AS water_fee, CAST(SUM(i.other_fee) AS SIGNED) AS other_fee,
         CAST(SUM(i.total_amount) AS SIGNED) AS billed,
         CAST(SUM(CASE WHEN i.payment_status = 'PAID' THEN i.total_amount ELSE 0 END) AS SIGNED) AS collected
       FROM invoices i WHERE ${where} GROUP BY \`key\` ORDER BY \`key\``,
      params
    );
  }

  async byRoom(basis, p) {
    const { where, params } = this._scope(basis, p);
    return this.query(
      `SELECT r.room_number, COUNT(*) AS invoices,
         CAST(SUM(i.total_amount) AS SIGNED) AS billed,
         CAST(SUM(CASE WHEN i.payment_status = 'PAID' THEN i.total_amount ELSE 0 END) AS SIGNED) AS collected
       FROM invoices i JOIN contracts c ON c.id = i.contract_id JOIN rooms r ON r.id = c.room_id
       WHERE ${where} GROUP BY r.id, r.room_number ORDER BY collected DESC, r.room_number`,
      params
    );
  }

  /** Khoản chưa thu có hạn nằm trong khoảng (dùng cho basis = paid). */
  async outstandingByDue(p) {
    const rows = await this.query(
      `SELECT COUNT(*) AS n, CAST(COALESCE(SUM(total_amount), 0) AS SIGNED) AS amount
         FROM invoices WHERE payment_status = 'UNPAID' AND due_date BETWEEN ? AND ?`,
      [p.from, p.to]
    );
    return { count: Number(rows[0].n), amount: Number(rows[0].amount) };
  }

  async detail(basis, p) {
    const { where, params } = this._scope(basis, p);
    return this.query(
      `SELECT i.id, i.year, i.month, r.room_number, u.full_name AS tenant_name, c.rental_type,
         i.room_fee, i.electricity_fee, i.water_fee, i.other_fee, i.total_amount,
         i.payment_status, i.paid_at, i.payment_method, i.due_date
       FROM invoices i JOIN contracts c ON c.id = i.contract_id JOIN rooms r ON r.id = c.room_id
       JOIN users u ON u.id = c.tenant_id
       WHERE ${where} ORDER BY i.year, i.month, r.room_number`,
      params
    );
  }
}

module.exports = ReportRepository;
