const BaseRepository = require('./BaseRepository');

// Số phòng / tên khách lấy qua JOIN (không còn sao chép trong bảng tickets).
const TICKET_SELECT = `
  SELECT t.id, t.room_id, t.tenant_id, r.room_number, u.full_name AS tenant_name, t.title, t.description,
         t.image_url, t.severity, t.status, t.admin_note, t.created_at, t.updated_at, t.resolved_at
    FROM tickets t
    JOIN rooms r ON r.id = t.room_id
    JOIN users u ON u.id = t.tenant_id`;

class TicketRepository extends BaseRepository {
  // tạo ticket mới
  async create({ room_id, tenant_id, title, description, image_url, severity }) {
    const result = await this.query(
      `INSERT INTO tickets (room_id, tenant_id, title, description, image_url, severity, status)
       VALUES (?, ?, ?, ?, ?, ?, 'PENDING')`,
      [room_id, tenant_id, title, description || null, image_url || null, severity || 'MEDIUM']
    );
    return result.insertId;
  }
  // lấy danh sách ticket với các bộ lọc
  async findAll({ status, severity } = {}) {
    let sql = `${TICKET_SELECT} WHERE 1=1`;
    const params = [];
    if (status) { sql += ' AND t.status = ?'; params.push(status); }
    if (severity) { sql += ' AND t.severity = ?'; params.push(severity); }
    sql += " ORDER BY FIELD(t.status, 'PENDING', 'IN_PROGRESS', 'RESOLVED'), FIELD(t.severity, 'HIGH', 'MEDIUM', 'LOW'), t.created_at DESC";
    return this.query(sql, params);
  }
  // sự cố do chính khách báo
  async findByTenant(tenantId) {
    return this.query(`${TICKET_SELECT} WHERE t.tenant_id = ? ORDER BY t.created_at DESC`, [tenantId]);
  }
  // cập nhật trạng thái (+ ghi chú của chủ trọ); resolved_at do service truyền vào
  async updateHandling(id, { status, admin_note, resolved_at }) {
    const result = await this.query(
      'UPDATE tickets SET status = ?, admin_note = ?, resolved_at = ? WHERE id = ?',
      [status, admin_note, resolved_at, id]
    );
    return result.affectedRows;
  }
  async findById(id) {
    const rows = await this.query(`${TICKET_SELECT} WHERE t.id = ? LIMIT 1`, [id]);
    return rows[0] || null;
  }
}

module.exports = TicketRepository;
