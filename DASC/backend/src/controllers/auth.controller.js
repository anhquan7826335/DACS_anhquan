const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
require('dotenv').config();

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, full_name: user.full_name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// POST /api/auth/login  { email, password }
async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Vui lòng nhập email và mật khẩu.' });
    }

    const [rows] = await pool.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng.' });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng.' });
    }

    const token = signToken(user);
    return res.json({
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Lỗi máy chủ khi đăng nhập.' });
  }
}

// POST /api/auth/register  { full_name, email, phone, cccd, password, role }
async function register(req, res) {
  try {
    const { full_name, email, phone, cccd, password, role } = req.body;
    if (!full_name || !email || !phone || !password) {
      return res.status(400).json({ message: 'Vui lòng nhập đầy đủ thông tin bắt buộc.' });
    }

    const [existing] = await pool.query(
      'SELECT id FROM users WHERE email = ? OR phone = ? LIMIT 1',
      [email, phone]
    );
    if (existing.length > 0) {
      return res.status(409).json({ message: 'Email hoặc số điện thoại đã được sử dụng.' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const finalRole = role === 'ADMIN' ? 'ADMIN' : 'TENANT';

    const [result] = await pool.query(
      `INSERT INTO users (full_name, email, phone, cccd, password_hash, role)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [full_name, email, phone, cccd || null, password_hash, finalRole]
    );

    const newUser = {
      id: result.insertId,
      full_name,
      email,
      phone,
      role: finalRole,
    };
    const token = signToken(newUser);
    return res.status(201).json({ token, user: newUser });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Lỗi máy chủ khi đăng ký.' });
  }
}

// GET /api/auth/tenant-lookup?keyword=...  (ADMIN) -> tra cứu khách thuê theo email/số điện thoại
// để chọn tenant_id khi tạo hợp đồng, tránh phải nhớ ID thủ công.
async function lookupTenant(req, res) {
  try {
    const { keyword } = req.query;
    if (!keyword) return res.status(400).json({ message: 'Vui lòng nhập email hoặc số điện thoại.' });

    const [rows] = await pool.query(
      `SELECT id, full_name, email, phone, cccd FROM users
       WHERE role = 'TENANT' AND (email LIKE ? OR phone LIKE ?) LIMIT 10`,
      [`%${keyword}%`, `%${keyword}%`]
    );
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Lỗi máy chủ.' });
  }
}

module.exports = { login, register, lookupTenant };
