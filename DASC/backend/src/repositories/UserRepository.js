const BaseRepository = require('./BaseRepository');

/**
 * UserRepository — kế thừa BaseRepository, chịu trách nhiệm duy nhất truy vấn bảng `users`.
 * Không chứa logic nghiệp vụ (hash mật khẩu, sinh token...) — việc đó thuộc về AuthService.
 */
class UserRepository extends BaseRepository {
  async findByEmail(email) {
    const rows = await this.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
    return rows[0] || null;
  }
  // lấy thông tin user theo id
  async findById(id) {
    const rows = await this.query('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
    return rows[0] || null;
  }
  // lấy thông tin user theo email hoặc số điện thoại
  async findByEmailOrPhone(email, phone) {
    const rows = await this.query('SELECT id FROM users WHERE email = ? OR phone = ? LIMIT 1', [email, phone]);
    return rows[0] || null;
  }
  // tạo user mới
  async create({ full_name, email, phone, password_hash, role }) {
    const rows = await this.query(
      `INSERT INTO users (full_name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)`,
      [full_name, email, phone, password_hash, role]
    );
    return rows.insertId;
  }
  // đổi mật khẩu user
  async updatePassword(id, passwordHash) {
    await this.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, id]);
  }
  // cập nhật ảnh đại diện user
  async updateAvatar(id, avatarUrl) {
    await this.query('UPDATE users SET avatar_url = ? WHERE id = ?', [avatarUrl, id]);
  }
  // tìm kiếm tenant theo email hoặc số điện thoại
  async searchTenants(keyword) {
    return this.query(
      `SELECT id, full_name, email, phone FROM users
       WHERE role = 'TENANT' AND (email LIKE ? OR phone LIKE ?) LIMIT 10`,
      [`%${keyword}%`, `%${keyword}%`]
    );
  }

  // danh sách người dùng cho admin (kèm số hợp đồng đang hiệu lực), không trả password_hash
  async findAllForAdmin({ role, search } = {}) {
    let sql = `SELECT u.id, u.full_name, u.email, u.phone, u.avatar_url, u.role, u.is_active, u.created_at,
        (SELECT COUNT(*) FROM contracts c WHERE c.tenant_id = u.id AND c.status = 'ACTIVE') AS active_contracts
      FROM users u WHERE 1=1`;
    const params = [];
    if (role) { sql += ' AND u.role = ?'; params.push(role); }
    if (search) {
      sql += ' AND (u.full_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    sql += ' ORDER BY u.role ASC, u.full_name ASC';
    return this.query(sql, params);
  }
  // email/sđt đã thuộc về người dùng KHÁC chưa
  async findConflict(email, phone, excludeId) {
    const rows = await this.query(
      'SELECT id, email, phone FROM users WHERE (email = ? OR phone = ?) AND id <> ? LIMIT 1',
      [email, phone, excludeId]
    );
    return rows[0] || null;
  }
  // số hợp đồng còn hiệu lực/đã phát sinh hóa đơn (ACTIVE, EXPIRED) — chặn xóa người dùng
  async countBindingContracts(userId) {
    const rows = await this.query(
      `SELECT COUNT(*) AS n FROM contracts WHERE tenant_id = ? AND status IN ('ACTIVE', 'EXPIRED')`, [userId]
    );
    return Number(rows[0].n);
  }
  async activeContractCount(userId) {
    const rows = await this.query(`SELECT COUNT(*) AS n FROM contracts WHERE tenant_id = ? AND status = 'ACTIVE'`, [userId]);
    return Number(rows[0].n);
  }

  /** Cập nhật hồ sơ (chỉ các cột trong whitelist). Tên/sđt chỉ lưu ở bảng users nên không cần đồng bộ nơi khác. */
  async updateProfile(id, fields) {
    const allowed = ['full_name', 'email', 'phone', 'role', 'password_hash', 'is_active'];
    const keys = Object.keys(fields).filter((k) => allowed.includes(k));
    if (!keys.length) return 0;
    const r = await this.query(
      `UPDATE users SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`,
      [...keys.map((k) => fields[k]), id]
    );
    return r.affectedRows;
  }

  /** Xóa người dùng cùng dữ liệu phụ thuộc (yêu cầu thuê chưa hiệu lực, sự cố, hội thoại hỗ trợ). */
  async deleteWithRelated(id) {
    const conn = await this.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(`DELETE FROM contracts WHERE tenant_id = ? AND status IN ('PENDING', 'REJECTED', 'CANCELLED')`, [id]);
      await conn.query('DELETE FROM tickets WHERE tenant_id = ?', [id]);
      await conn.query('DELETE FROM support_messages WHERE user_id = ?', [id]);
      const [result] = await conn.query('DELETE FROM users WHERE id = ?', [id]);
      await conn.commit();
      return result.affectedRows;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
}

module.exports = UserRepository;
