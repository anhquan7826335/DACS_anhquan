class SupportController {
  constructor(supportService) {
    this.supportService = supportService;
  }
  // lịch sử trò chuyện
  getHistory = async (req, res) => {
    try {
      return res.json(await this.supportService.history(req.user.id));
    } catch (err) {
      return res.status(err.status || 500).json({ message: err.message || 'Không thể tải lịch sử hỗ trợ.' });
    }
  };
  // câu hỏi cho AI
  ask = async (req, res) => {
    try {
      return res.status(201).json(await this.supportService.ask(req.user, req.body.question));
    } catch (err) {
      return res.status(err.status || 500).json({ message: err.message || 'Không thể gửi câu hỏi.' });
    }
  };
}

module.exports = SupportController;