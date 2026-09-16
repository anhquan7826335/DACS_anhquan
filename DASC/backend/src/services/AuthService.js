const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * AuthService — chứa toàn bộ business logic xác thực: hash mật khẩu, so khớp,
 * sinh JWT. AuthController chỉ gọi các phương thức này và trả response,
 * không tự viết logic nghiệp vụ (tách biệt trách nhiệm — Separation of Concerns).
 */
class AuthService {
  constructor(userRepository, { jwtSecret, jwtExpiresIn = '7d' }) {
    this.userRepository = userRepository;
    this.jwtSecret = jwtSecret;
    this.jwtExpiresIn = jwtExpiresIn;
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

  async register({ full_name, email, phone, cccd, password, role }) {
    const existing = await this.userRepository.findByEmailOrPhone(email, phone);
    if (existing) {
      const err = new Error('Email hoặc số điện thoại đã được sử dụng.');
      err.status = 409;
      throw err;
    }
    const password_hash = await bcrypt.hash(password, 10);
    const finalRole = role === 'ADMIN' ? 'ADMIN' : 'TENANT';
    const id = await this.userRepository.create({ full_name, email, phone, cccd, password_hash, role: finalRole });

    const user = new User({ id, full_name, email, phone, cccd, role: finalRole });
    return { token: this._signToken(user), user: user.toPublicJSON() };
  }

  async lookupTenants(keyword) {
    return this.userRepository.searchTenants(keyword);
  }
}

module.exports = AuthService;
