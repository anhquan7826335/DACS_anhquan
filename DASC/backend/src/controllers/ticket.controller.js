const { pool } = require('../config/db');
const { uploadBuffer } = require('../utils/cloudinary');
const { analyzeIssueImage } = require('../utils/ai');

// POST /api/tickets/analyze-image  (multipart/form-data, field "file": ảnh hoặc video sự cố)
// Upload lên Cloudinary rồi gọi AI Vision để bóc tách device_type, issue_type, severity, summary_vi.
// FE dùng kết quả này để tự động điền biểu mẫu báo sự cố, khách chỉ cần bấm "Gửi".
async function analyzeImage(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Vui lòng đính kèm ảnh hoặc video sự cố.' });
    }

    const isVideo = req.file.mimetype.startsWith('video/');
    const uploadResult = await uploadBuffer(req.file.buffer, {
      folder: 'rental_management/tickets',
      resourceType: isVideo ? 'video' : 'image',
    });

    let analysis;
    if (isVideo) {
      // AI Vision hiện chỉ phân tích ảnh tĩnh trực tiếp; với video, khuyến nghị
      // trích 1 khung hình đại diện (thumbnail) ở tầng xử lý media trước khi gọi AI.
      analysis = {
        device_type: 'Chưa xác định (video)',
        issue_type: 'Cần xem thủ công',
        severity: 'MEDIUM',
        title: 'Sự cố báo cáo qua video',
        summary_vi: 'Video đã được lưu trữ, vui lòng xem trực tiếp để đánh giá vì AI Vision hiện chỉ hỗ trợ phân tích ảnh tĩnh.',
      };
    } else {
      const base64 = req.file.buffer.toString('base64');
      analysis = await analyzeIssueImage(base64, req.file.mimetype);
    }

    return res.json({ image_url: uploadResult.secure_url, ...analysis });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Lỗi khi phân tích ảnh sự cố: ' + err.message });
  }
}

// POST /api/tickets  -> Khách thuê tạo ticket báo sự cố
// { room_id, title, description, image_url, severity }
async function createTicket(req, res) {
  try {
    const { room_id, title, description, image_url, severity } = req.body;
    if (!room_id || !title) {
      return res.status(400).json({ message: 'Thiếu Số phòng hoặc Tiêu đề sự cố.' });
    }

    const [roomRows] = await pool.query('SELECT room_number FROM rooms WHERE id = ?', [room_id]);
    if (roomRows.length === 0) return res.status(404).json({ message: 'Không tìm thấy phòng.' });

    const [result] = await pool.query(
      `INSERT INTO tickets (room_id, tenant_id, room_number, tenant_name, title, description, image_url, severity, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
      [
        room_id, req.user.id, roomRows[0].room_number, req.user.full_name,
        title, description || null, image_url || null, severity || 'MEDIUM',
      ]
    );
    return res.status(201).json({ id: result.insertId, message: 'Đã gửi báo cáo sự cố.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Lỗi máy chủ khi tạo ticket.' });
  }
}

// GET /api/tickets  -> Admin xem danh sách báo cáo sự cố (hỗ trợ ?status=&severity=)
async function getTickets(req, res) {
  try {
    const { status, severity } = req.query;
    let sql = 'SELECT * FROM tickets WHERE 1=1';
    const params = [];
    if (status) { sql += ' AND status = ?'; params.push(status); }
    if (severity) { sql += ' AND severity = ?'; params.push(severity); }
    sql += ' ORDER BY FIELD(severity, "HIGH","MEDIUM","LOW"), created_at DESC';

    const [rows] = await pool.query(sql, params);
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Lỗi máy chủ.' });
  }
}

// PUT /api/tickets/:id  -> Admin cập nhật trạng thái xử lý ticket
async function updateTicketStatus(req, res) {
  try {
    const { status } = req.body;
    if (!['PENDING', 'IN_PROGRESS', 'RESOLVED'].includes(status)) {
      return res.status(400).json({ message: 'Trạng thái không hợp lệ.' });
    }
    const [result] = await pool.query('UPDATE tickets SET status = ? WHERE id = ?', [status, req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Không tìm thấy ticket.' });
    return res.json({ message: 'Đã cập nhật trạng thái ticket.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Lỗi máy chủ.' });
  }
}

module.exports = { analyzeImage, createTicket, getTickets, updateTicketStatus };
