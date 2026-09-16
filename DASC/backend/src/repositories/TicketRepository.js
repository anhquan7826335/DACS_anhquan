const BaseRepository = require('./BaseRepository');

class TicketRepository extends BaseRepository {
  async create({ room_id, tenant_id, room_number, tenant_name, title, description, image_url, severity }) {
    const result = await this.query(
      `INSERT INTO tickets (room_id, tenant_id, room_number, tenant_name, title, description, image_url, severity, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
      [room_id, tenant_id, room_number, tenant_name, title, description || null, image_url || null, severity || 'MEDIUM']
    );
    return result.insertId;
  }

  async findAll({ status, severity } = {}) {
    let sql = 'SELECT * FROM tickets WHERE 1=1';
    const params = [];
    if (status) { sql += ' AND status = ?'; params.push(status); }
    if (severity) { sql += ' AND severity = ?'; params.push(severity); }
    sql += ' ORDER BY FIELD(severity, "HIGH","MEDIUM","LOW"), created_at DESC';
    return this.query(sql, params);
  }

  async updateStatus(id, status) {
    const result = await this.query('UPDATE tickets SET status = ? WHERE id = ?', [status, id]);
    return result.affectedRows;
  }
}

module.exports = TicketRepository;
