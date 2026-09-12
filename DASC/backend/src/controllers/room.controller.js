const { pool } = require('../config/db');

// GET /api/rooms  (hỗ trợ ?status=EMPTY&search=P1)
async function getRooms(req, res) {
  try {
    const { status, search } = req.query;
    let sql = 'SELECT * FROM rooms WHERE 1=1';
    const params = [];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (search) {
      sql += ' AND room_number LIKE ?';
      params.push(`%${search}%`);
    }
    sql += ' ORDER BY floor ASC, room_number ASC';

    const [rows] = await pool.query(sql, params);
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Lỗi máy chủ khi lấy danh sách phòng.' });
  }
}

// GET /api/rooms/:id
async function getRoomById(req, res) {
  try {
    const [rows] = await pool.query('SELECT * FROM rooms WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Không tìm thấy phòng.' });
    return res.json(rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Lỗi máy chủ.' });
  }
}

// POST /api/rooms  { room_number, floor, price, area, description }
async function createRoom(req, res) {
  try {
    const { room_number, floor, price, area, description } = req.body;
    if (!room_number || !floor || !price) {
      return res.status(400).json({ message: 'Vui lòng nhập Số phòng, Tầng và Giá phòng.' });
    }

    const [existing] = await pool.query('SELECT id FROM rooms WHERE room_number = ?', [room_number]);
    if (existing.length > 0) {
      return res.status(409).json({ message: `Số phòng ${room_number} đã tồn tại.` });
    }

    const [result] = await pool.query(
      `INSERT INTO rooms (room_number, floor, price, area, description, status)
       VALUES (?, ?, ?, ?, ?, 'EMPTY')`,
      [room_number, floor, price, area || null, description || null]
    );
    return res.status(201).json({ id: result.insertId, message: 'Tạo phòng thành công.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Lỗi máy chủ khi tạo phòng.' });
  }
}

// PUT /api/rooms/:id
async function updateRoom(req, res) {
  try {
    const { floor, price, area, description, status } = req.body;
    const fields = [];
    const params = [];

    if (floor !== undefined) { fields.push('floor = ?'); params.push(floor); }
    if (price !== undefined) { fields.push('price = ?'); params.push(price); }
    if (area !== undefined) { fields.push('area = ?'); params.push(area); }
    if (description !== undefined) { fields.push('description = ?'); params.push(description); }
    if (status !== undefined) { fields.push('status = ?'); params.push(status); }

    if (fields.length === 0) {
      return res.status(400).json({ message: 'Không có dữ liệu nào để cập nhật.' });
    }

    params.push(req.params.id);
    const [result] = await pool.query(`UPDATE rooms SET ${fields.join(', ')} WHERE id = ?`, params);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Không tìm thấy phòng.' });

    return res.json({ message: 'Cập nhật phòng thành công.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Lỗi máy chủ khi cập nhật phòng.' });
  }
}

module.exports = { getRooms, getRoomById, createRoom, updateRoom };
