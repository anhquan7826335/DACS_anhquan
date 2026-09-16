const BaseRepository = require('./BaseRepository');

class InvoiceRepository extends BaseRepository {
  async create(data) {
    const result = await this.query(
      `INSERT INTO invoices
        (contract_id, room_id, tenant_id, room_number, tenant_name, month, year,
         old_electricity, new_electricity, old_water, new_water,
         room_fee, electricity_fee, water_fee, other_fee, total_amount,
         payment_status, due_date, bill_file_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'UNPAID', ?, ?)`,
      [
        data.contract_id, data.room_id, data.tenant_id, data.room_number, data.tenant_name,
        data.month, data.year, data.old_electricity, data.new_electricity, data.old_water, data.new_water,
        data.room_fee, data.electricity_fee, data.water_fee, data.other_fee || 0, data.total_amount,
        data.due_date, data.bill_file_url || null,
      ]
    );
    return result.insertId;
  }

  async findAll({ status, month, year } = {}) {
    let sql = 'SELECT * FROM invoices WHERE 1=1';
    const params = [];
    if (status) { sql += ' AND payment_status = ?'; params.push(status); }
    if (month) { sql += ' AND month = ?'; params.push(month); }
    if (year) { sql += ' AND year = ?'; params.push(year); }
    sql += ' ORDER BY year DESC, month DESC, room_number ASC';
    return this.query(sql, params);
  }

  async findByTenant(tenantId) {
    return this.query('SELECT * FROM invoices WHERE tenant_id = ? ORDER BY year DESC, month DESC', [tenantId]);
  }

  async findById(id) {
    const rows = await this.query('SELECT * FROM invoices WHERE id = ? LIMIT 1', [id]);
    return rows[0] || null;
  }

  async findAllUnpaid() {
    return this.query(`SELECT * FROM invoices WHERE payment_status = 'UNPAID'`);
  }

  async markPaid(id) {
    const result = await this.query(`UPDATE invoices SET payment_status = 'PAID' WHERE id = ?`, [id]);
    return result.affectedRows;
  }

  async incrementReminder(id) {
    await this.query(
      `UPDATE invoices SET last_reminder_sent_at = NOW(), reminder_count = reminder_count + 1 WHERE id = ?`,
      [id]
    );
  }
}

module.exports = InvoiceRepository;
