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
      const rooms = await this.roomService.list({ status, search });
      return res.json(rooms);
    } catch (err) {
      return this.handleError(res, err, 'Lỗi máy chủ khi lấy danh sách phòng.');
    }
  };
  // lấy thông tin phòng theo id
  getRoomById = async (req, res) => {
    try {
      const room = await this.roomService.getById(req.params.id);
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
}

module.exports = RoomController;
