const bcrypt = require('bcryptjs');
const { httpError } = require('../utils/httpError');

const { profileFields } = require('../utils/validators');

/**
 * UserService — quản lý người dùng dành cho admin: xem danh sách, sửa hồ sơ/vai trò/mật khẩu, xóa.
 */
class UserService {
  constructor(userRepository) {
    this.userRepository = userRepository;
  }

  async list(filters = {}) {
    const role = ['ADMIN', 'TENANT'].includes(filters.role) ? filters.role : undefined;
    const search = String(filters.search || '').trim() || undefined;
    return this.userRepository.findAllForAdmin({ role, search });
  }

  async update(actor, id, body = {}) {
    const row = await this.userRepository.findById(id);
    if (!row) throw httpError(404, 'Không tìm thấy người dùng.');

    const fields = profileFields(body);
    if (body.role !== undefined && body.role !== row.role) {
      if (!['ADMIN', 'TENANT'].includes(body.role)) throw httpError(400, 'Vai trò không hợp lệ.');
      if (Number(id) === Number(actor.id)) throw httpError(400, 'Bạn không thể tự đổi vai trò của chính mình.');
      fields.role = body.role;
    }
    if (body.is_active !== undefined) {
      if (Number(id) === Number(actor.id) && !body.is_active) throw httpError(400, 'Bạn không thể tự khóa tài khoản của chính mình.');
      fields.is_active = body.is_active ? 1 : 0;
    }
    if (body.password !== undefined && body.password !== '') {
      if (typeof body.password !== 'string' || body.password.length < 6) {
        throw httpError(400, 'Mật khẩu mới phải có ít nhất 6 ký tự.');
      }
      fields.password_hash = await bcrypt.hash(body.password, 10);
    }
    if (Object.keys(fields).length === 0) throw httpError(400, 'Không có thông tin nào để cập nhật.');

    const email = fields.email ?? row.email;
    const phone = fields.phone ?? row.phone;
    const conflict = await this.userRepository.findConflict(email, phone, row.id);
    if (conflict) throw httpError(409, 'Email hoặc số điện thoại đã được người dùng khác sử dụng.');

    await this.userRepository.updateProfile(row.id, fields);
  }

  _public(row) {
    return { id: row.id, full_name: row.full_name, email: row.email, phone: row.phone, avatar_url: row.avatar_url, role: row.role };
  }

  async getMe(userId) {
    const row = await this.userRepository.findById(userId);
    if (!row) throw httpError(404, 'Không tìm thấy tài khoản.');
    return this._public(row);
  }

  /** Người dùng tự cập nhật họ tên / email / số điện thoại của mình. */
  async updateMe(userId, body = {}) {
    const row = await this.userRepository.findById(userId);
    if (!row) throw httpError(404, 'Không tìm thấy tài khoản.');
    const fields = profileFields(body);
    if (Object.keys(fields).length === 0) throw httpError(400, 'Không có thông tin nào để cập nhật.');
    const conflict = await this.userRepository.findConflict(fields.email ?? row.email, fields.phone ?? row.phone, row.id);
    if (conflict) throw httpError(409, 'Email hoặc số điện thoại đã được người dùng khác sử dụng.');
    await this.userRepository.updateProfile(row.id, fields);
    return this._public({ ...row, ...fields });
  }

  /** Khóa / mở khóa tài khoản (không tự khóa chính mình). */
  async setActive(actor, id, active) {
    const row = await this.userRepository.findById(id);
    if (!row) throw httpError(404, 'Không tìm thấy người dùng.');
    if (Number(id) === Number(actor.id)) throw httpError(400, 'Bạn không thể tự khóa tài khoản của chính mình.');
    await this.userRepository.updateProfile(row.id, { is_active: active ? 1 : 0 });
  }

  async remove(actor, id) {
    const row = await this.userRepository.findById(id);
    if (!row) throw httpError(404, 'Không tìm thấy người dùng.');
    if (Number(id) === Number(actor.id)) throw httpError(400, 'Bạn không thể xóa chính tài khoản đang đăng nhập.');
    if (await this.userRepository.countBindingContracts(row.id) > 0) {
      throw httpError(409, 'Người dùng này đã có hợp đồng thuê nên không thể xóa (cần giữ lại để đối chiếu hóa đơn). Hãy khóa tài khoản thay vì xóa.');
    }
    await this.userRepository.deleteWithRelated(row.id);
  }
}

module.exports = UserService;
