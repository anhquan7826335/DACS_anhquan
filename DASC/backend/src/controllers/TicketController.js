const BaseController = require('./BaseController');

class TicketController extends BaseController {
  constructor(ticketService) {
    super();
    this.ticketService = ticketService;
  }
  // phân tích ảnh sự cố
  analyzeImage = async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: 'Vui lòng đính kèm ảnh hoặc video sự cố.' });
      const result = await this.ticketService.analyzeImage(req.file.buffer, req.file.mimetype);
      return res.json(result);
    } catch (err) {
      return this.handleError(res, err, 'Lỗi khi phân tích ảnh sự cố.');
    }
  };
  // tạo ticket mới
  createTicket = async (req, res) => {
    try {
      const id = await this.ticketService.create({
        ...req.body,
        tenant_id: req.user.id,
      });
      return res.status(201).json({ id, message: 'Đã gửi báo cáo sự cố.' });
    } catch (err) {
      return this.handleError(res, err, 'Lỗi máy chủ khi tạo ticket.');
    }
  };
  // lấy danh sách ticket
  getTickets = async (req, res) => {
    try {
      const rows = await this.ticketService.list(req.query);
      return res.json(rows);
    } catch (err) {
      return this.handleError(res, err);
    }
  };
  getMyTickets = async (req, res) => {
    try {
      return res.json(await this.ticketService.listMine(req.user.id));
    } catch (err) {
      return this.handleError(res, err);
    }
  };
  // admin xử lý sự cố: trạng thái + ghi chú
  updateTicketStatus = async (req, res) => {
    try {
      await this.ticketService.handle(req.params.id, req.body || {});
      return res.json({ message: 'Đã cập nhật sự cố.' });
    } catch (err) {
      return this.handleError(res, err);
    }
  };
}

module.exports = TicketController;
