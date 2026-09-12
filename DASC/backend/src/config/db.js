const mysql = require('mysql2/promise');
require('dotenv').config();

// Pool kết nối dùng chung toàn hệ thống. Tất cả truy vấn dùng mysql2/promise
// để có thể await trực tiếp, không cần callback.
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'rental_management',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true, // trả DATE/DATETIME dạng chuỗi 'YYYY-MM-DD' cho dễ xử lý ở FE
});

// Kiểm tra kết nối khi khởi động server, không làm crash tiến trình nếu lỗi
// (cho phép server vẫn chạy để dev xem log / sửa .env)
async function testConnection() {
  try {
    const conn = await pool.getConnection();
    console.log('✅ Kết nối MySQL thành công.');
    conn.release();
  } catch (err) {
    console.error('❌ Không thể kết nối MySQL:', err.message);
    console.error('   Kiểm tra lại DB_HOST/DB_USER/DB_PASSWORD/DB_NAME trong file .env');
  }
}

module.exports = { pool, testConnection };
