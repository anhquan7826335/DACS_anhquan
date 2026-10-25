/**
 * Model: User — Entity ánh xạ từ bảng `users`.
 * Đóng gói dữ liệu 1 tài khoản (Admin/Chủ trọ hoặc Tenant/Khách thuê) và cung cấp
 * các phương thức tiện ích liên quan trực tiếp tới entity này (không chứa business logic
 * phức tạp — logic đăng nhập/đăng ký thuộc về AuthService).
 */
class User {
  constructor({ id, full_name, email, phone, avatar_url, password_hash, role, is_active, created_at }) {
    this.id = id;
    this.full_name = full_name;
    this.email = email;
    this.phone = phone;
    this.avatar_url = avatar_url || null;
    this.password_hash = password_hash; // không bao giờ trả field này ra ngoài API
    this.role = role; // 'ADMIN' | 'TENANT'
    this.is_active = is_active === undefined ? 1 : is_active;
    this.created_at = created_at;
  }

  static fromRow(row) {
    return row ? new User(row) : null;
  }

  isAdmin() {
    return this.role === 'ADMIN';
  }

  /**
   * Chuẩn hóa dữ liệu trả về client — loại bỏ password_hash để không lộ ra ngoài.
   */
  toPublicJSON() {
    return {
      id: this.id,
      full_name: this.full_name,
      email: this.email,
      phone: this.phone,
      avatar_url: this.avatar_url,
      role: this.role,
    };
  }
}

module.exports = User;
