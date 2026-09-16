const BaseRepository = require('./BaseRepository');

class RoomRepository extends BaseRepository {
  async findAll({ status, search } = {}) {
    let sql = 'SELECT * FROM rooms WHERE 1=1';
    const params = [];
    if (status) { sql += ' AND status = ?'; params.push(status); }
    if (search) { sql += ' AND room_number LIKE ?'; params.push(`%${search}%`); }
    sql += ' ORDER BY floor ASC, room_number ASC';
    return this.query(sql, params);
  }

  async findById(id) {
    const rows = await this.query('SELECT * FROM rooms WHERE id = ? LIMIT 1', [id]);
    return rows[0] || null;
  }

  async findByRoomNumber(roomNumber) {
    const rows = await this.query('SELECT * FROM rooms WHERE room_number = ? LIMIT 1', [roomNumber]);
    return rows[0] || null;
  }

  async create({ room_number, floor, price, area, description }) {
    const result = await this.query(
      `INSERT INTO rooms (room_number, floor, price, area, description, status) VALUES (?, ?, ?, ?, ?, 'EMPTY')`,
      [room_number, floor, price, area || null, description || null]
    );
    return result.insertId;
  }

  async update(id, fields) {
    const keys = Object.keys(fields);
    if (keys.length === 0) return 0;
    const setClause = keys.map((k) => `${k} = ?`).join(', ');
    const values = keys.map((k) => fields[k]);
    const result = await this.query(`UPDATE rooms SET ${setClause} WHERE id = ?`, [...values, id]);
    return result.affectedRows;
  }

  /**
   * Dùng trong transaction (khi tạo/thanh lý hợp đồng): khóa dòng để tránh 2 admin
   * cùng tạo hợp đồng cho 1 phòng trống cùng lúc (race condition).
   */
  async findByIdForUpdate(conn, id) {
    const [rows] = await conn.query('SELECT * FROM rooms WHERE id = ? FOR UPDATE', [id]);
    return rows[0] || null;
  }
}

module.exports = RoomRepository;
