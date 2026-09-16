const jwt = require('jsonwebtoken');
require('dotenv').config();

/**
 * Xác thực JWT Token gửi kèm header: Authorization: Bearer <token>
 * Gắn thông tin user đã giải mã vào req.user = { id, role, full_name }
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Thiếu token xác thực.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, role, full_name }
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn.' });
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
