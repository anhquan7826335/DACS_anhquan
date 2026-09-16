const BaseController = require('./BaseController');

/**
 * AuthController — kế thừa BaseController. Nhận request/response, gọi AuthService
 * để xử lý nghiệp vụ, không tự chứa logic hash/JWT (Single Responsibility).
 */
class AuthController extends BaseController {
  constructor(authService) {
    super();
    this.authService = authService;
  }

  login = async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: 'Vui lòng nhập email và mật khẩu.' });
      }
      const result = await this.authService.login(email, password);
      return res.json(result);
    } catch (err) {
      return this.handleError(res, err, 'Lỗi máy chủ khi đăng nhập.');
    }
  };

  register = async (req, res) => {
    try {
      const { full_name, email, phone, password } = req.body;
      if (!full_name || !email || !phone || !password) {
        return res.status(400).json({ message: 'Vui lòng nhập đầy đủ thông tin bắt buộc.' });
      }
      const result = await this.authService.register(req.body);
      return res.status(201).json(result);
    } catch (err) {
      return this.handleError(res, err, 'Lỗi máy chủ khi đăng ký.');
    }
  };

  lookupTenant = async (req, res) => {
    try {
      const { keyword } = req.query;
      if (!keyword) return res.status(400).json({ message: 'Vui lòng nhập email hoặc số điện thoại.' });
      const rows = await this.authService.lookupTenants(keyword);
      return res.json(rows);
    } catch (err) {
      return this.handleError(res, err);
    }
  };
}

module.exports = AuthController;
