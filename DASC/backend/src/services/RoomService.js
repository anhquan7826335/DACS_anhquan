/**
 * RoomService — business logic cho module Phòng trọ.
 * RoomController gọi các phương thức ở đây, không tự viết SQL.
 */
class RoomService {
  constructor(roomRepository) {
    this.roomRepository = roomRepository;
  }

  async list(filters) {
    return this.roomRepository.findAll(filters);
  }

  async getById(id) {
    const room = await this.roomRepository.findById(id);
    if (!room) {
      const err = new Error('Không tìm thấy phòng.');
      err.status = 404;
      throw err;
    }
    return room;
  }

  async create({ room_number, floor, price, area, description }) {
    if (!room_number || !floor || !price) {
      const err = new Error('Vui lòng nhập Số phòng, Tầng và Giá phòng.');
      err.status = 400;
      throw err;
    }
    const existing = await this.roomRepository.findByRoomNumber(room_number);
    if (existing) {
      const err = new Error(`Số phòng ${room_number} đã tồn tại.`);
      err.status = 409;
      throw err;
    }
    return this.roomRepository.create({ room_number, floor, price, area, description });
  }

  async update(id, fields) {
    const affected = await this.roomRepository.update(id, fields);
    if (affected === 0) {
      const err = new Error('Không tìm thấy phòng.');
      err.status = 404;
      throw err;
    }
    return affected;
  }
}

module.exports = RoomService;
