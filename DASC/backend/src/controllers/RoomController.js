const BaseController = require('./BaseController');

class RoomController extends BaseController {
  constructor(roomService) {
    super();
    this.roomService = roomService;
  }
  // lấy danh sách phòng
  getRooms = async (req, res) => {
    try {
      const { status, search } = req.query;
      const rooms = await this.roomService.list({ status, search }, req.user);
      return res.json(rooms);
    } catch (err) {
      return this.handleError(res, err, 'Lỗi máy chủ khi lấy danh sách phòng.');
    }
  };
  // lấy thông tin phòng theo id
  getRoomById = async (req, res) => {
    try {
      const room = await this.roomService.getById(req.params.id, req.user);
      return res.json(room);
    } catch (err) {
      return this.handleError(res, err);
    }
  };
  // tạo phòng
  createRoom = async (req, res) => {
    try {
      const id = await this.roomService.create(req.body);
      return res.status(201).json({ id, message: 'Tạo phòng thành công.' });
    } catch (err) {
      return this.handleError(res, err, 'Lỗi máy chủ khi tạo phòng.');
    }
  };
  // cập nhật thông tin phòng
  updateRoom = async (req, res) => {
    try {
      await this.roomService.update(req.params.id, req.body);
      return res.json({ message: 'Cập nhật phòng thành công.' });
    } catch (err) {
      return this.handleError(res, err, 'Lỗi máy chủ khi cập nhật phòng.');
    }
  };
  // xóa phòng
  deleteRoom = async (req, res) => {
    try {
      await this.roomService.remove(req.params.id);
      return res.json({ message: 'Đã xóa phòng.' });
    } catch (err) {
      return this.handleError(res, err, 'Lỗi máy chủ khi xóa phòng.');
    }
  };
  // tải ảnh phòng (admin) — multipart field "image"
  uploadImage = async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: 'Vui lòng chọn ảnh phòng.' });
      const image_url = await this.roomService.uploadImage(req.params.id, req.file.buffer);
      return res.status(201).json({ image_url, message: 'Đã cập nhật ảnh phòng.' });
    } catch (err) {
      return this.handleError(res, err, 'Lỗi máy chủ khi tải ảnh phòng.');
    }
  };
}

module.exports = RoomController;
