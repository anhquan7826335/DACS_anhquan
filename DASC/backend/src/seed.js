const bcrypt = require('bcryptjs');
const { pool } = require('./config/db');
require('dotenv').config();

/**
 * Tạo 1 tài khoản Admin mặc định để đăng nhập lần đầu.
 * Chạy: npm run seed
 */
async function seed() {
  const email = 'admin@local.com';
  const password = 'Admin@123';
  const full_name = 'Chủ trọ';
  const phone = '0900000000';

  try {
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      console.log('ℹ️  Tài khoản admin đã tồn tại, bỏ qua seed.');
      process.exit(0);
    }

    const password_hash = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO users (full_name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, 'ADMIN')`,
      [full_name, email, phone, password_hash]
    );

    console.log('✅ Đã tạo tài khoản Admin mặc định:');
    console.log(`   Email:    ${email}`);
    console.log(`   Mật khẩu: ${password}`);
    console.log('⚠️  Hãy đổi mật khẩu ngay sau khi đăng nhập lần đầu.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Lỗi khi seed dữ liệu:', err.message);
    process.exit(1);
  }
}

seed();
