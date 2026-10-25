const BaseRepository = require('./BaseRepository');

// Hợp đồng = cả yêu cầu thuê (PENDING/REJECTED/CANCELLED) lẫn hợp đồng chính thức (ACTIVE/EXPIRED).
// Tên khách / sđt / số phòng lấy qua JOIN (không còn sao chép trong bảng).
// daily_rate là bí danh của daily_fee để FE giữ nguyên tên trường.
const CONTRACT_SELECT = `
  SELECT c.id, c.tenant_id, c.room_id, c.monthly_fee, c.daily_fee, c.daily_fee AS daily_rate, c.deposit,
         c.start_date, c.end_date, c.rental_type, c.status, c.admin_note, c.decided_at, c.created_at,
         r.room_number, r.image_url AS room_image, r.monthly_price AS room_price,
         u.full_name AS tenant_name, u.phone AS tenant_phone, u.email AS tenant_email,
         DATEDIFF(c.end_date, c.start_date) + 1 AS days,
         TIMESTAMPDIFF(MONTH, c.start_date, DATE_ADD(c.end_date, INTERVAL 1 DAY)) AS months,
         CASE c.rental_type
           WHEN 'DAILY' THEN c.daily_fee * (DATEDIFF(c.end_date, c.start_date) + 1)
           ELSE c.monthly_fee * TIMESTAMPDIFF(MONTH, c.start_date, DATE_ADD(c.end_date, INTERVAL 1 DAY))
         END AS estimated_total
    FROM contracts c
    JOIN rooms r ON r.id = c.room_id
    JOIN users u ON u.id = c.tenant_id`;

class ContractRepository extends BaseRepository {
  // danh sách hợp đồng (admin) kèm thông tin phòng/khách — lọc theo trạng thái, phòng, khách, loại
  async findAll({ status, room_id, tenant_id, rental_type } = {}) {
    let sql = `${CONTRACT_SELECT} WHERE 1=1`;
    const params = [];
    if (status) { sql += ' AND c.status = ?'; params.push(status); }
    if (room_id) { sql += ' AND c.room_id = ?'; params.push(room_id); }
    if (tenant_id) { sql += ' AND c.tenant_id = ?'; params.push(tenant_id); }
    if (rental_type) { sql += ' AND c.rental_type = ?'; params.push(rental_type); }
    sql += ' ORDER BY FIELD(c.status, \'PENDING\', \'ACTIVE\', \'EXPIRED\', \'REJECTED\', \'CANCELLED\'), r.room_number ASC, c.id DESC';
    return this.query(sql, params);
  }
  async findActiveByRoom(roomId) {
    const rows = await this.query(`${CONTRACT_SELECT} WHERE c.room_id = ? AND c.status = 'ACTIVE' LIMIT 1`, [roomId]);
    return rows[0] || null;
  }
  // lấy hợp đồng đang hiệu lực theo tenant (mới nhất)
  async findActiveByTenant(tenantId) {
    const rows = await this.query(
      `${CONTRACT_SELECT} WHERE c.tenant_id = ? AND c.status = 'ACTIVE' ORDER BY c.id DESC LIMIT 1`, [tenantId]
    );
    return rows[0] || null;
  }
  // mọi hợp đồng / yêu cầu của 1 khách
  async findByTenant(tenantId) {
    return this.query(`${CONTRACT_SELECT} WHERE c.tenant_id = ? ORDER BY c.created_at DESC, c.id DESC`, [tenantId]);
  }
  // lấy hợp đồng theo id
  async findById(id) {
    const rows = await this.query(`${CONTRACT_SELECT} WHERE c.id = ? LIMIT 1`, [id]);
    return rows[0] || null;
  }
  async findPendingByTenantAndRoom(tenantId, roomId) {
    const rows = await this.query(
      `SELECT id FROM contracts WHERE tenant_id = ? AND room_id = ? AND status = 'PENDING' LIMIT 1`, [tenantId, roomId]
    );
    return rows[0] || null;
  }

  /** Khách tự hủy yêu cầu của chính mình khi còn PENDING. Trả về số dòng bị ảnh hưởng. */
  async cancel(id, tenantId, now) {
    const result = await this.query(
      `UPDATE contracts SET status = 'CANCELLED', decided_at = ? WHERE id = ? AND tenant_id = ? AND status = 'PENDING'`,
      [now, id, tenantId]
    );
    return result.affectedRows;
  }
  /** Admin từ chối yêu cầu còn PENDING. Trả về số dòng bị ảnh hưởng. */
  async reject(id, note, now) {
    const result = await this.query(
      `UPDATE contracts SET status = 'REJECTED', admin_note = ?, decided_at = ? WHERE id = ? AND status = 'PENDING'`,
      [note, now, id]
    );
    return result.affectedRows;
  }

  // ---- Các hàm dưới đây nhận `conn` (connection đang trong transaction) từ Service ----

  /** Thêm hợp đồng / yêu cầu thuê. `status` = 'ACTIVE' (admin tạo) hoặc 'PENDING' (khách gửi yêu cầu). */
  async insertWithConnection(conn, d) {
    const [result] = await conn.query(
      `INSERT INTO contracts
        (tenant_id, room_id, monthly_fee, daily_fee, deposit, start_date, end_date, rental_type, status, decided_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        d.tenant_id, d.room_id, d.monthly_fee || 0, d.daily_fee || 0, d.deposit || 0,
        d.start_date, d.end_date, d.rental_type, d.status, d.decided_at || null,
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
  async markApproved(conn, id, deposit, now) {
    await conn.query(
      `UPDATE contracts SET status = 'ACTIVE', deposit = ?, decided_at = ? WHERE id = ?`, [deposit, now, id]
    );
  }
  /** Phòng đã có người thuê -> tự động từ chối mọi yêu cầu PENDING còn lại của phòng đó. */
  async rejectOtherPending(conn, roomId, exceptId, note, now) {
    await conn.query(
      `UPDATE contracts SET status = 'REJECTED', admin_note = ?, decided_at = ?
        WHERE room_id = ? AND id <> ? AND status = 'PENDING'`,
      [note, now, roomId, exceptId]
    );
  }
  async countInvoicesWithConnection(conn, contractId) {
    const [rows] = await conn.query('SELECT COUNT(*) AS n FROM invoices WHERE contract_id = ?', [contractId]);
    return Number(rows[0].n);
  }
  // cập nhật các cột cho phép của hợp đồng
  async update(id, patch) {
    const keys = Object.keys(patch);
    const result = await this.query(
      `UPDATE contracts SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`,
      [...keys.map((k) => patch[k]), id]
    );
    return result.affectedRows;
  }
}

module.exports = ContractRepository;
