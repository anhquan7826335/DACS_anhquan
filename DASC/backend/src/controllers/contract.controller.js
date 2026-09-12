const { pool } = require('../config/db');

// POST /api/contracts
// { room_id, tenant_id, deposit, electricity_rate, water_rate, service_fee, start_date, end_date, tenant_phone, tenant_cccd }
async function createContract(req, res) {
  const conn = await pool.getConnection();
  try {
    const {
      room_id, tenant_id, deposit, electricity_rate, water_rate,
      service_fee, start_date, end_date, tenant_phone, tenant_cccd,
    } = req.body;

    if (!room_id || !tenant_id || !deposit || !electricity_rate || !water_rate || !start_date || !end_date) {
      return res.status(400).json({ message: 'Thiếu thông tin bắt buộc để tạo hợp đồng.' });
    }

    await conn.beginTransaction();

    // Lấy dữ liệu tên phòng, tên khách từ rooms và users để lưu dư thừa (denormalize)
    const [roomRows] = await conn.query('SELECT * FROM rooms WHERE id = ? FOR UPDATE', [room_id]);
    if (roomRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Không tìm thấy phòng.' });
    }
    const room = roomRows[0];
    if (room.status === 'RENTED') {
      await conn.rollback();
      return res.status(409).json({ message: `Phòng ${room.room_number} hiện đang có người thuê.` });
    }

    const [tenantRows] = await conn.query('SELECT * FROM users WHERE id = ?', [tenant_id]);
    if (tenantRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Không tìm thấy khách thuê.' });
    }
    const tenant = tenantRows[0];

    // Insert vào contracts (status = 'ACTIVE')
    const [result] = await conn.query(
      `INSERT INTO contracts
        (room_id, tenant_id, room_number, tenant_name, tenant_phone, tenant_cccd,
         deposit, electricity_rate, water_rate, service_fee, start_date, end_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
      [
        room_id, tenant_id, room.room_number, tenant.full_name,
        tenant_phone || tenant.phone, tenant_cccd || tenant.cccd,
        deposit, electricity_rate, water_rate, service_fee || 0, start_date, end_date,
      ]
    );
    const contractId = result.insertId;

    // Update rooms: status = 'RENTED', current_contract_id, tenant_name, end_date
    await conn.query(
      `UPDATE rooms SET status = 'RENTED', current_contract_id = ?, tenant_name = ?, end_date = ?
       WHERE id = ?`,
      [contractId, tenant.full_name, end_date, room_id]
    );

    await conn.commit();
    return res.status(201).json({ id: contractId, message: 'Tạo hợp đồng thành công.' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    return res.status(500).json({ message: 'Lỗi máy chủ khi tạo hợp đồng.' });
  } finally {
    conn.release();
  }
}

// GET /api/contracts/room/:roomId  -> hợp đồng ACTIVE theo phòng
async function getActiveContractByRoom(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM contracts WHERE room_id = ? AND status = 'ACTIVE' ORDER BY id DESC LIMIT 1`,
      [req.params.roomId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Phòng chưa có hợp đồng đang hiệu lực.' });
    }
    return res.json(rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Lỗi máy chủ.' });
  }
}

// PUT /api/contracts/:id/terminate  -> Thanh lý hợp đồng
async function terminateContract(req, res) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query('SELECT * FROM contracts WHERE id = ? FOR UPDATE', [req.params.id]);
    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Không tìm thấy hợp đồng.' });
    }
    const contract = rows[0];

    await conn.query(`UPDATE contracts SET status = 'EXPIRED' WHERE id = ?`, [contract.id]);
    await conn.query(
      `UPDATE rooms SET status = 'EMPTY', current_contract_id = NULL, tenant_name = NULL, end_date = NULL
       WHERE id = ?`,
      [contract.room_id]
    );

    await conn.commit();
    return res.json({ message: 'Đã thanh lý hợp đồng, phòng chuyển về trạng thái Trống.' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    return res.status(500).json({ message: 'Lỗi máy chủ khi thanh lý hợp đồng.' });
  } finally {
    conn.release();
  }
}

// GET /api/contracts/my  (TENANT) -> hợp đồng ACTIVE của chính khách thuê đang đăng nhập
async function getMyActiveContract(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM contracts WHERE tenant_id = ? AND status = 'ACTIVE' ORDER BY id DESC LIMIT 1`,
      [req.user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Bạn hiện không có hợp đồng thuê nào đang hiệu lực.' });
    }
    return res.json(rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Lỗi máy chủ.' });
  }
}

module.exports = { createContract, getActiveContractByRoom, terminateContract, getMyActiveContract };
