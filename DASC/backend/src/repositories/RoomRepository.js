const BaseRepository = require('./BaseRepository');

// API vẫn trả `price` (giá tháng) và `daily_rate` (giá ngày, mặc định = giá tháng / 30) để FE giữ nguyên tên trường.
// Khách đang thuê / hợp đồng hiện tại được suy ra từ hợp đồng ACTIVE (tối đa 1 hợp đồng ACTIVE mỗi phòng).
const ROOM_SELECT = `
  SELECT r.id, r.room_number, r.floor, r.monthly_price AS price, r.daily_price,
         CAST(COALESCE(r.daily_price, ROUND(r.monthly_price / 30)) AS SIGNED) AS daily_rate,
         r.area, r.description, r.image_url, r.status,
         c.id AS current_contract_id, u.full_name AS tenant_name, c.end_date AS end_date,
         (SELECT COUNT(*) FROM contracts p WHERE p.room_id = r.id AND p.status = 'PENDING') AS pending_requests
    FROM rooms r
    LEFT JOIN contracts c ON c.active_room_id = r.id
    LEFT JOIN users u ON u.id = c.tenant_id`;

// tên trường API -> cột DB được phép cập nhật
const UPDATABLE = {
  room_number: 'room_number', floor: 'floor', price: 'monthly_price', daily_price: 'daily_price',
  area: 'area', status: 'status', description: 'description',
};

class RoomRepository extends BaseRepository {
  // lấy danh sách phòng với các bộ lọc (kèm số yêu cầu thuê đang chờ duyệt)
  async findAll({ status, search } = {}) {
    let sql = `${ROOM_SELECT} WHERE 1=1`;
    const params = [];
    if (status) { sql += ' AND r.status = ?'; params.push(status); }
    if (search) { sql += ' AND r.room_number LIKE ?'; params.push(`%${search}%`); }
    sql += ' ORDER BY r.floor ASC, r.room_number ASC';
    return this.query(sql, params);
  }
  // lấy thông tin phòng theo id
  async findById(id) {
    const rows = await this.query(`${ROOM_SELECT} WHERE r.id = ? LIMIT 1`, [id]);
    return rows[0] || null;
  }

  /**
   * Dọn trạng thái hết hiệu lực — gọi "lười" (lazy) mỗi khi đọc phòng/hợp đồng/đặt phòng.
   * `today` là chuỗi YYYY-MM-DD, `now` là 'YYYY-MM-DD HH:MM:SS' theo múi giờ ứng dụng.
   *  1) Hợp đồng thuê NGÀY đã qua ngày kết thúc -> EXPIRED
   *  2) Yêu cầu PENDING đã qua ngày bắt đầu mà chưa được duyệt -> EXPIRED
   *  3) Phòng đang RENTED nhưng không còn hợp đồng ACTIVE -> EMPTY
   */
  async housekeeping(today, now) {
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        `UPDATE contracts SET status = 'EXPIRED'
          WHERE status = 'ACTIVE' AND rental_type = 'DAILY' AND end_date < ?`,
        [today]
      );
      await conn.query(
        `UPDATE contracts SET status = 'EXPIRED', decided_at = ?,
                admin_note = COALESCE(admin_note, 'Yêu cầu hết hạn: quá ngày bắt đầu mà chưa được duyệt')
          WHERE status = 'PENDING' AND start_date < ?`,
        [now, today]
      );
      await conn.query(
        `UPDATE rooms r SET r.status = 'EMPTY'
          WHERE r.status = 'RENTED'
            AND NOT EXISTS (SELECT 1 FROM contracts c WHERE c.room_id = r.id AND c.status = 'ACTIVE')`
      );
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
  // lấy thông tin phòng theo số phòng
  async findByRoomNumber(roomNumber) {
    const rows = await this.query('SELECT id, room_number FROM rooms WHERE room_number = ? LIMIT 1', [roomNumber]);
    return rows[0] || null;
  }
  // tạo phòng
  async create({ room_number, floor, price, daily_price, area, description }) {
    const result = await this.query(
      `INSERT INTO rooms (room_number, floor, monthly_price, daily_price, area, description, status)
       VALUES (?, ?, ?, ?, ?, ?, 'EMPTY')`,
      [room_number, floor, price, daily_price || null, area || null, description || null]
    );
    return result.insertId;
  }
  // cập nhật thông tin phòng (chỉ các cột trong whitelist)
  async update(id, fields) {
    const keys = Object.keys(fields || {}).filter((k) => UPDATABLE[k]);
    if (keys.length === 0) return 0;
    const setClause = keys.map((k) => `${UPDATABLE[k]} = ?`).join(', ');
    const values = keys.map((k) => fields[k]);
    const result = await this.query(`UPDATE rooms SET ${setClause} WHERE id = ?`, [...values, id]);
    return result.affectedRows;
  }
  async countContracts(roomId) {
    const rows = await this.query(
      `SELECT COUNT(*) AS n FROM contracts WHERE room_id = ? AND status IN ('ACTIVE', 'EXPIRED')`, [roomId]
    );
    return Number(rows[0].n);
  }
  // xóa phòng cùng yêu cầu thuê (hợp đồng chưa hiệu lực) và sự cố gắn với phòng đó (transaction)
  async deleteWithRelated(id) {
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(`DELETE FROM contracts WHERE room_id = ? AND status IN ('PENDING', 'REJECTED', 'CANCELLED')`, [id]);
      await conn.query('DELETE FROM tickets WHERE room_id = ?', [id]);
      const [result] = await conn.query('DELETE FROM rooms WHERE id = ?', [id]);
      await conn.commit();
      return result.affectedRows;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
  // lưu URL ảnh phòng
  async updateImage(id, imageUrl) {
    const result = await this.query('UPDATE rooms SET image_url = ? WHERE id = ?', [imageUrl, id]);
    return result.affectedRows;
  }

  /**
   * Dùng trong transaction (khi tạo/thanh lý hợp đồng, duyệt yêu cầu thuê): khóa dòng để tránh
   * 2 admin cùng thao tác trên 1 phòng cùng lúc (race condition).
   */
  async findByIdForUpdate(conn, id) {
    const [rows] = await conn.query(
      `SELECT id, room_number, status, monthly_price AS price, daily_price,
              CAST(COALESCE(daily_price, ROUND(monthly_price / 30)) AS SIGNED) AS daily_rate
         FROM rooms WHERE id = ? FOR UPDATE`,
      [id]
    );
    return rows[0] || null;
  }
}

module.exports = RoomRepository;
