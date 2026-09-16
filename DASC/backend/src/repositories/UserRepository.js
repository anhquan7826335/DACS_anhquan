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

  async findById(id) {
    const rows = await this.query('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
    return rows[0] || null;
  }

  async findByEmailOrPhone(email, phone) {
    const rows = await this.query('SELECT id FROM users WHERE email = ? OR phone = ? LIMIT 1', [email, phone]);
    return rows[0] || null;
  }

  async create({ full_name, email, phone, cccd, password_hash, role }) {
    const rows = await this.query(
      `INSERT INTO users (full_name, email, phone, cccd, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)`,
      [full_name, email, phone, cccd || null, password_hash, role]
    );
    return rows.insertId;
  }

  async searchTenants(keyword) {
    return this.query(
      `SELECT id, full_name, email, phone, cccd FROM users
       WHERE role = 'TENANT' AND (email LIKE ? OR phone LIKE ?) LIMIT 10`,
      [`%${keyword}%`, `%${keyword}%`]
    );
  }
}

module.exports = UserRepository;
