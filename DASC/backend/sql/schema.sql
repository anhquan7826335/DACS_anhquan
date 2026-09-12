-- =====================================================================
-- HỆ THỐNG QUẢN LÝ NHÀ TRỌ & TỰ ĐỘNG HÓA HÓA ĐƠN THANH TOÁN
-- CSDL phi chuẩn hóa - 5 bảng chính (MySQL 8.0+)
-- =====================================================================

CREATE DATABASE IF NOT EXISTS rental_management
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE rental_management;

-- 1. Bảng users (Người dùng & Tài khoản)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  phone VARCHAR(20) UNIQUE NOT NULL,
  cccd VARCHAR(20),
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('ADMIN', 'TENANT') DEFAULT 'TENANT',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Bảng rooms (Phòng trọ)
CREATE TABLE IF NOT EXISTS rooms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_number VARCHAR(20) NOT NULL UNIQUE,
  floor INT NOT NULL,
  price BIGINT NOT NULL,
  area FLOAT,
  status ENUM('EMPTY', 'RENTED', 'MAINTENANCE') DEFAULT 'EMPTY',
  description TEXT,
  current_contract_id INT NULL,
  tenant_name VARCHAR(100) NULL,
  end_date DATE NULL
);

-- 3. Bảng contracts (Hợp đồng thuê)
-- Lưu trữ đơn giá thỏa thuận cố định tại thời điểm ký để làm căn cứ tính
-- hóa đơn hàng tháng và in PDF.
CREATE TABLE IF NOT EXISTS contracts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_id INT NOT NULL,
  tenant_id INT NOT NULL,
  room_number VARCHAR(20) NOT NULL,
  tenant_name VARCHAR(100) NOT NULL,
  tenant_phone VARCHAR(20) NOT NULL,
  tenant_cccd VARCHAR(20) NOT NULL,
  deposit BIGINT NOT NULL,
  electricity_rate BIGINT NOT NULL,
  water_rate BIGINT NOT NULL,
  service_fee BIGINT DEFAULT 0,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status ENUM('ACTIVE', 'EXPIRED') DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES rooms(id),
  FOREIGN KEY (tenant_id) REFERENCES users(id)
);

-- 4. Bảng invoices (Hóa đơn & Quản lý Nhắc nợ)
CREATE TABLE IF NOT EXISTS invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  contract_id INT NOT NULL,
  room_id INT NOT NULL,
  tenant_id INT NOT NULL,
  room_number VARCHAR(20) NOT NULL,
  tenant_name VARCHAR(100) NOT NULL,
  month INT NOT NULL,
  year INT NOT NULL,
  old_electricity INT NOT NULL,
  new_electricity INT NOT NULL,
  old_water INT NOT NULL,
  new_water INT NOT NULL,
  room_fee BIGINT NOT NULL,
  electricity_fee BIGINT NOT NULL,
  water_fee BIGINT NOT NULL,
  other_fee BIGINT DEFAULT 0,
  total_amount BIGINT NOT NULL,
  payment_status ENUM('UNPAID', 'PAID') DEFAULT 'UNPAID',
  due_date DATE NOT NULL,               -- Hạn chót thanh toán
  bill_file_url VARCHAR(500) NULL,      -- URL file ảnh/PDF hóa đơn điện nước gốc do Chủ trọ tải lên
  last_reminder_sent_at DATETIME NULL,  -- Thời điểm gửi nhắc nợ gần nhất
  reminder_count INT DEFAULT 0,         -- Số lần đã gửi nhắc nợ
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (contract_id) REFERENCES contracts(id)
);

-- 5. Bảng tickets (Báo cáo sự cố)
CREATE TABLE IF NOT EXISTS tickets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_id INT NOT NULL,
  tenant_id INT NOT NULL,
  room_number VARCHAR(20) NOT NULL,
  tenant_name VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  image_url VARCHAR(500),
  severity ENUM('LOW', 'MEDIUM', 'HIGH') DEFAULT 'MEDIUM',
  status ENUM('PENDING', 'IN_PROGRESS', 'RESOLVED') DEFAULT 'PENDING',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed nhanh: 1 tài khoản Admin mặc định (mật khẩu: Admin@123, đã hash bcrypt sẵn qua seed.js)
