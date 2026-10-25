const BaseRepository = require('./BaseRepository');

// Hóa đơn gắn với hợp đồng; phòng / khách lấy qua JOIN. electricity / water là TIỀN (VNĐ).
// total_amount là cột tính tự động trong DB (= room_fee + electricity_fee + water_fee + other_fee).
const INVOICE_SELECT = `
  SELECT i.id, i.contract_id, c.room_id, c.tenant_id, r.room_number, u.full_name AS tenant_name,
         c.rental_type, i.month, i.year, i.room_fee,
         i.electricity_fee AS electricity, i.water_fee AS water, i.other_fee, i.total_amount,
         i.payment_status, i.paid_at, i.payment_method, i.transaction_ref,
         i.due_date, i.bill_file_url, i.last_reminder_sent_at, i.reminder_count, i.created_at
    FROM invoices i
    JOIN contracts c ON c.id = i.contract_id
    JOIN rooms r ON r.id = c.room_id
    JOIN users u ON u.id = c.tenant_id`;

class InvoiceRepository extends BaseRepository {
  async create(data) {
    const result = await this.query(
      `INSERT INTO invoices
        (contract_id, month, year, room_fee, electricity_fee, water_fee, other_fee,
         payment_status, due_date, bill_file_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'UNPAID', ?, ?)`,
      [
        data.contract_id, data.month, data.year, data.room_fee, data.electricity, data.water,
        data.other_fee || 0, data.due_date, data.bill_file_url || null,
      ]
    );
    return result.insertId;
  }
  async findById(id) {
    const rows = await this.query(`${INVOICE_SELECT} WHERE i.id = ? LIMIT 1`, [id]);
    return rows[0] || null;
  }
  // cập nhật hóa đơn (total_amount do DB tự tính); chuyển trạng thái thì ghi/xóa thông tin thanh toán
  async update(id, d) {
    const result = await this.query(
      `UPDATE invoices SET room_fee = ?, electricity_fee = ?, water_fee = ?, other_fee = ?,
         due_date = ?, payment_status = ?, paid_at = ?, payment_method = ?, transaction_ref = ? WHERE id = ?`,
      [d.room_fee, d.electricity, d.water, d.other_fee, d.due_date, d.payment_status,
        d.paid_at, d.payment_method, d.transaction_ref, id]
    );
    return result.affectedRows;
  }
  async delete(id) {
    const result = await this.query('DELETE FROM invoices WHERE id = ?', [id]);
    return result.affectedRows;
  }
  // lấy danh sách hóa đơn với các bộ lọc
  async findAll({ status, month, year } = {}) {
    let sql = `${INVOICE_SELECT} WHERE 1=1`;
    const params = [];
    if (status) { sql += ' AND i.payment_status = ?'; params.push(status); }
    if (month) { sql += ' AND i.month = ?'; params.push(month); }
    if (year) { sql += ' AND i.year = ?'; params.push(year); }
    sql += ' ORDER BY i.year DESC, i.month DESC, r.room_number ASC';
    return this.query(sql, params);
  }
  /**
   * Hóa đơn của một tenant. `fromIdx`/`toIdx` (tùy chọn) = year*12+month để lọc theo kỳ hóa đơn.
   */
  async findByTenant(tenantId, { fromIdx, toIdx } = {}) {
    let sql = `${INVOICE_SELECT} WHERE c.tenant_id = ?`;
    const params = [tenantId];
    if (fromIdx != null) { sql += ' AND (i.year * 12 + i.month) >= ?'; params.push(fromIdx); }
    if (toIdx != null) { sql += ' AND (i.year * 12 + i.month) <= ?'; params.push(toIdx); }
    sql += ' ORDER BY i.year DESC, i.month DESC';
    return this.query(sql, params);
  }
  // lấy danh sách hóa đơn chưa thanh toán
  async findAllUnpaid() {
    return this.query(`${INVOICE_SELECT} WHERE i.payment_status = 'UNPAID'`);
  }
  // đánh dấu đã thanh toán (chỉ khi còn UNPAID); trả về số dòng thay đổi
  async markPaid(id, { paidAt, method, transactionRef = null }) {
    const result = await this.query(
      `UPDATE invoices SET payment_status = 'PAID', paid_at = ?, payment_method = ?, transaction_ref = ?
        WHERE id = ? AND payment_status = 'UNPAID'`,
      [paidAt, method, transactionRef, id]
    );
    return result.affectedRows;
  }
  // tăng số lần nhắc nhở và cập nhật thời gian nhắc nhở cuối cùng
  async incrementReminder(id) {
    await this.query(
      `UPDATE invoices SET last_reminder_sent_at = NOW(), reminder_count = reminder_count + 1 WHERE id = ?`,
      [id]
    );
  }
}

module.exports = InvoiceRepository;
