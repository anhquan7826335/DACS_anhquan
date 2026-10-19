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
  // đăng nhập
  login = async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: 'Vui lòng nhập email và mật khẩu.' });
      }
      const result = await this.authService.login(email, password);
      res.cookie('token', result.token, {
        httpOnly: true,
        sameSite: 'Lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      return res.json(result);
    } catch (err) {
      return this.handleError(res, err, 'Lỗi máy chủ khi đăng nhập.');
    }
  };
  // đăng ký
  register = async (req, res) => {
    try {
      const { full_name, email, phone, password } = req.body;
      if (!full_name || !email || !phone || !password) {
        return res.status(400).json({ message: 'Vui lòng nhập đầy đủ thông tin bắt buộc.' });
      }
      const result = await this.authService.register(req.body);
      res.cookie('token', result.token, {
        httpOnly: true,
        sameSite: 'Lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      return res.status(201).json(result);
    } catch (err) {
      return this.handleError(res, err, 'Lỗi máy chủ khi đăng ký.');
    }
  };
  // đăng xuất
  logout = (req, res) => {
    res.clearCookie('token', {
      httpOnly: true,
      sameSite: 'Lax',
      secure: process.env.NODE_ENV === 'production',
    });
    return res.json({ message: 'Đăng xuất thành công.' });
  };
  // đổi mật khẩu
  changePassword = async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Vui lòng nhập mật khẩu hiện tại và mật khẩu mới.' });
      }
      await this.authService.changePassword(req.user.id, currentPassword, newPassword);
      return res.json({ message: 'Đổi mật khẩu thành công.' });
    } catch (err) {
      return this.handleError(res, err, 'Lỗi máy chủ khi đổi mật khẩu.');
    }
  };
  // tải ảnh đại diện lên Cloudinary và lưu URL vào tài khoản
  uploadAvatar = async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'Vui lòng chọn ảnh đại diện.' });
      }
      const user = await this.authService.uploadAvatar(req.user.id, req.file.buffer);
      return res.json({ user, message: 'Cập nhật ảnh đại diện thành công.' });
    } catch (err) {
      return this.handleError(res, err, 'Lỗi máy chủ khi tải ảnh đại diện.');
    }
  };
  // tìm kiếm tenant theo email hoặc phone
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
