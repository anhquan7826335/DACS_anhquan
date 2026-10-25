const { httpError } = require('../utils/httpError');
const { todayInAppTz, nowInAppTz } = require('../utils/date');

/**
 * RoomService — business logic cho module Phòng trọ.
 * RoomController gọi các phương thức ở đây, không tự viết SQL.
 */
class RoomService {
  constructor(roomRepository, cloudinaryService) {
    this.roomRepository = roomRepository;
    this.cloudinaryService = cloudinaryService;
  }

  /**
   * Khách thuê (TENANT) chỉ thấy phòng ĐANG TRỐNG và chỉ các trường công khai
   * (không lộ tên người thuê khác, mã hợp đồng...). Admin thấy đầy đủ.
   */
  _toTenantView(room) {
    const { id, room_number, floor, price, daily_price, daily_rate, area, status, description, image_url } = room;
    return { id, room_number, floor, price, daily_price, daily_rate, area, status, description, image_url };
  }

  _housekeeping() {
    return this.roomRepository.housekeeping(todayInAppTz(), nowInAppTz());
  }

  async list(filters = {}, user) {
    await this._housekeeping();
    if (user?.role === 'TENANT') {
      const rooms = await this.roomRepository.findAll({ search: filters.search, status: 'EMPTY' });
      return rooms.map((r) => this._toTenantView(r));
    }
    const rooms = await this.roomRepository.findAll(filters);
    return rooms;
  }

  async getById(id, user) {
    await this._housekeeping();
    const room = await this.roomRepository.findById(id);
    if (!room || (user?.role === 'TENANT' && room.status !== 'EMPTY')) {
      throw httpError(404, 'Không tìm thấy phòng.');
    }
    return user?.role === 'TENANT' ? this._toTenantView(room) : room;
  }

  async create({ room_number, floor, price, daily_price, area, description } = {}) {
    if (!room_number || !floor || !price) {
      throw httpError(400, 'Vui lòng nhập Số phòng, Tầng và Giá phòng.');
    }
    const existing = await this.roomRepository.findByRoomNumber(room_number);
    if (existing) throw httpError(409, `Số phòng ${room_number} đã tồn tại.`);
    const dp = daily_price === undefined || daily_price === null || daily_price === '' ? null : Number(daily_price);
    if (dp !== null && (!Number.isInteger(dp) || dp <= 0)) throw httpError(400, 'Giá thuê ngày phải là số nguyên dương (VNĐ).');
    return this.roomRepository.create({ room_number, floor, price, daily_price: dp, area, description });
  }

  async update(id, fields = {}) {
    const room = await this.roomRepository.findById(id);
    if (!room) throw httpError(404, 'Không tìm thấy phòng.');

    const patch = {};
    if (fields.room_number !== undefined) {
      const v = String(fields.room_number).trim();
      if (!v || v.length > 20) throw httpError(400, 'Số phòng không được để trống và tối đa 20 ký tự.');
      if (v !== room.room_number && await this.roomRepository.findByRoomNumber(v)) {
        throw httpError(409, `Số phòng ${v} đã tồn tại.`);
      }
      patch.room_number = v;
    }
    if (fields.floor !== undefined) {
      const v = Number(fields.floor);
      if (!Number.isInteger(v) || v < 0) throw httpError(400, 'Tầng phải là số nguyên không âm.');
      patch.floor = v;
    }
    if (fields.price !== undefined) {
      const v = Number(fields.price);
      if (!Number.isInteger(v) || v <= 0) throw httpError(400, 'Giá phòng phải là số nguyên dương (VNĐ).');
      patch.price = v;
    }
    if (fields.daily_price !== undefined) {
      if (fields.daily_price === null || fields.daily_price === '') patch.daily_price = null;
      else {
        const v = Number(fields.daily_price);
        if (!Number.isInteger(v) || v <= 0) throw httpError(400, 'Giá thuê ngày phải là số nguyên dương (VNĐ).');
        patch.daily_price = v;
      }
    }
    if (fields.area !== undefined) {
      if (fields.area === null || fields.area === '') patch.area = null;
      else {
        const v = Number(fields.area);
        if (!Number.isFinite(v) || v < 0) throw httpError(400, 'Diện tích không hợp lệ.');
        patch.area = v;
      }
    }
    if (fields.description !== undefined) {
      patch.description = fields.description === null ? null : String(fields.description);
    }
    if (fields.status !== undefined && fields.status !== room.status) {
      if (!['EMPTY', 'MAINTENANCE'].includes(fields.status)) {
        throw httpError(400, 'Chỉ có thể chuyển phòng sang Trống hoặc Bảo trì; trạng thái Đang thuê được tạo qua hợp đồng.');
      }
      if (room.status === 'RENTED') {
        throw httpError(409, 'Phòng đang có người thuê, hãy thanh lý hợp đồng trước khi đổi trạng thái.');
      }
      patch.status = fields.status;
    }
    if (Object.keys(patch).length === 0) throw httpError(400, 'Không có thông tin nào để cập nhật.');

    return this.roomRepository.update(id, patch);
  }

  async remove(id) {
    const room = await this.roomRepository.findById(id);
    if (!room) throw httpError(404, 'Không tìm thấy phòng.');
    if (room.status === 'RENTED') throw httpError(409, 'Phòng đang có người thuê nên không thể xóa.');
    if (await this.roomRepository.countContracts(id) > 0) {
      throw httpError(409, 'Phòng đã từng có hợp đồng nên không thể xóa (cần giữ lại để đối chiếu hóa đơn). Hãy chuyển sang Bảo trì nếu không cho thuê nữa.');
    }
    await this.roomRepository.deleteWithRelated(id);
  }

  /** Tải ảnh phòng lên Cloudinary và lưu URL vào phòng. */
  async uploadImage(id, fileBuffer) {
    const room = await this.roomRepository.findById(id);
    if (!room) throw httpError(404, 'Không tìm thấy phòng.');

    const uploaded = await this.cloudinaryService.uploadBuffer(fileBuffer, {
      folder: 'rental_management/rooms',
      resourceType: 'image',
    });
    await this.roomRepository.updateImage(id, uploaded.secure_url);
    return uploaded.secure_url;
  }
}

module.exports = RoomService;
