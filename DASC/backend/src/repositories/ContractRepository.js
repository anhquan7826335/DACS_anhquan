const BaseRepository = require('./BaseRepository');

class ContractRepository extends BaseRepository {
  async findActiveByRoom(roomId) {
    const rows = await this.query(
      `SELECT * FROM contracts WHERE room_id = ? AND status = 'ACTIVE' ORDER BY id DESC LIMIT 1`,
      [roomId]
    );
    return rows[0] || null;
  }

  async findActiveByTenant(tenantId) {
    const rows = await this.query(
      `SELECT * FROM contracts WHERE tenant_id = ? AND status = 'ACTIVE' ORDER BY id DESC LIMIT 1`,
      [tenantId]
    );
    return rows[0] || null;
  }

  async findById(id) {
    const rows = await this.query('SELECT * FROM contracts WHERE id = ? LIMIT 1', [id]);
    return rows[0] || null;
  }

  // ---- Các hàm dưới đây nhận `conn` (connection đang trong transaction) từ Service ----

  async createWithConnection(conn, data) {
    const [result] = await conn.query(
      `INSERT INTO contracts
        (room_id, tenant_id, room_number, tenant_name, tenant_phone, tenant_cccd,
         deposit, electricity_rate, water_rate, service_fee, start_date, end_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
      [
        data.room_id, data.tenant_id, data.room_number, data.tenant_name,
        data.tenant_phone, data.tenant_cccd, data.deposit, data.electricity_rate,
        data.water_rate, data.service_fee || 0, data.start_date, data.end_date,
      ]
    );
    return result.insertId;
  }

  async findByIdForUpdate(conn, id) {
    const [rows] = await conn.query('SELECT * FROM contracts WHERE id = ? FOR UPDATE', [id]);
    return rows[0] || null;
  }

  async setStatusWithConnection(conn, id, status) {
    await conn.query('UPDATE contracts SET status = ? WHERE id = ?', [status, id]);
  }
}

module.exports = ContractRepository;
