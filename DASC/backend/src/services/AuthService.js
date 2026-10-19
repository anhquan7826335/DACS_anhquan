const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * AuthService — chứa toàn bộ business logic xác thực: hash mật khẩu, so khớp,
 * sinh JWT. AuthController chỉ gọi các phương thức này và trả response,
 * không tự viết logic nghiệp vụ (tách biệt trách nhiệm — Separation of Concerns).
 */
class AuthService {
  constructor(userRepository, { jwtSecret, jwtExpiresIn = '7d' }, cloudinaryService) {
    this.userRepository = userRepository;
    this.jwtSecret = jwtSecret;
    this.jwtExpiresIn = jwtExpiresIn;
    this.cloudinaryService = cloudinaryService;
  }

  _signToken(user) {
    return jwt.sign(
      { id: user.id, role: user.role, full_name: user.full_name },
      this.jwtSecret,
      { expiresIn: this.jwtExpiresIn }
    );
  }

  async login(email, password) {
    const row = await this.userRepository.findByEmail(email);
    if (!row) {
      const err = new Error('Email hoặc mật khẩu không đúng.');
      err.status = 401;
      throw err;
    }
    const user = User.fromRow(row);
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      const err = new Error('Email hoặc mật khẩu không đúng.');
      err.status = 401;
      throw err;
    }
    return { token: this._signToken(user), user: user.toPublicJSON() };
  }

  async register({ full_name, email, phone, password, role }) {
    const existing = await this.userRepository.findByEmailOrPhone(email, phone);
    if (existing) {
      const err = new Error('Email hoặc số điện thoại đã được sử dụng.');
      err.status = 409;
      throw err;
    }
    const password_hash = await bcrypt.hash(password, 10);
    const finalRole = role === 'ADMIN' ? 'ADMIN' : 'TENANT';
    const id = await this.userRepository.create({ full_name, email, phone, password_hash, role: finalRole });

    const user = new User({ id, full_name, email, phone, role: finalRole });
    return { token: this._signToken(user), user: user.toPublicJSON() };
  }

  async changePassword(userId, currentPassword, newPassword) {
    if (typeof currentPassword !== 'string' || !currentPassword ||
      typeof newPassword !== 'string' || newPassword.length < 6) {
      const err = new Error('Mật khẩu mới phải có ít nhất 6 ký tự.');
      err.status = 400;
      throw err;
    }

    const row = await this.userRepository.findById(userId);
    if (!row) {
      const err = new Error('Không tìm thấy tài khoản.');
      err.status = 404;
      throw err;
    }

    const user = User.fromRow(row);
    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      const err = new Error('Mật khẩu hiện tại không đúng.');
      err.status = 400;
      throw err;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.userRepository.updatePassword(userId, passwordHash);
  }

  async uploadAvatar(userId, fileBuffer) {
    if (!this.cloudinaryService) {
      const err = new Error('Dịch vụ lưu ảnh chưa được cấu hình.');
      err.status = 503;
      throw err;
    }

    const userRow = await this.userRepository.findById(userId);
    if (!userRow) {
      const err = new Error('Không tìm thấy tài khoản.');
      err.status = 404;
      throw err;
    }

    const uploaded = await this.cloudinaryService.uploadBuffer(fileBuffer, {
      folder: 'rental_management/avatars',
      resourceType: 'image',
    });
    if (!uploaded?.secure_url) {
      throw new Error('Không nhận được địa chỉ ảnh sau khi tải lên.');
    }

    await this.userRepository.updateAvatar(userId, uploaded.secure_url);
    return User.fromRow({ ...userRow, avatar_url: uploaded.secure_url }).toPublicJSON();
  }

  async lookupTenants(keyword) {
    return this.userRepository.searchTenants(keyword);
  }
}

module.exports = AuthService;
