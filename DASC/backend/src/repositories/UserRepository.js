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
}

module.exports = UserRepository;
