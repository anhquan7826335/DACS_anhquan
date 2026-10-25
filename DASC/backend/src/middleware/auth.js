const jwt = require('jsonwebtoken');
require('dotenv').config();
const { pool } = require('../config/db');

/**
 * Xác thực JWT Token gửi kèm header: Authorization: Bearer <token>
 * Gắn thông tin user đã giải mã vào req.user = { id, role, full_name }
 */
function getTokenFromRequest(req) {
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (bearerToken) return bearerToken;

  const cookieHeader = req.headers.cookie || '';
  const cookiePair = cookieHeader
    .split(';')
    .map((chunk) => chunk.trim())
    .find((chunk) => chunk.startsWith('token='));

  if (!cookiePair) return null;
  return decodeURIComponent(cookiePair.slice('token='.length));
}

async function authenticate(req, res, next) {
  const token = getTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({ message: 'Thiếu token xác thực.' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn.' });
  }

  try {
    // Đối chiếu DB: tài khoản bị admin xóa thì token cũ vô hiệu ngay; đổi vai trò/tên có hiệu lực ngay
    // (không phải chờ token hết hạn).
    const [rows] = await pool.query('SELECT id, role, full_name, is_active FROM users WHERE id = ? LIMIT 1', [decoded.id]);
    if (rows.length === 0) {
      return res.status(401).json({ message: 'Tài khoản không còn tồn tại.' });
    }
    if (!rows[0].is_active) {
      return res.status(403).json({ message: 'Tài khoản đã bị khóa. Vui lòng liên hệ chủ trọ.' });
    }
    req.user = { id: rows[0].id, role: rows[0].role, full_name: rows[0].full_name };
    next();
  } catch (err) {
    console.error('Lỗi xác thực:', err);
    return res.status(500).json({ message: 'Lỗi máy chủ khi xác thực.' });
  }
}

/**
 * Chỉ cho phép các role được liệt kê đi tiếp.
 * Dùng: router.post('/', authenticate, authorize('ADMIN'), controller)
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Bạn không có quyền truy cập chức năng này.' });
    }
    next();
  };
}

module.exports = { authenticate, authorize };
