const BaseController = require('./BaseController');

class UserController extends BaseController {
  constructor(userService) {
    super();
    this.userService = userService;
  }

  list = async (req, res) => {
    try {
      const { role, search } = req.query;
      return res.json(await this.userService.list({ role, search }));
    } catch (err) {
      return this.handleError(res, err, 'Lỗi máy chủ khi lấy danh sách người dùng.');
    }
  };

  update = async (req, res) => {
    try {
      await this.userService.update(req.user, req.params.id, req.body);
      return res.json({ message: 'Cập nhật người dùng thành công.' });
    } catch (err) {
      return this.handleError(res, err, 'Lỗi máy chủ khi cập nhật người dùng.');
    }
  };

  me = async (req, res) => {
    try { return res.json(await this.userService.getMe(req.user.id)); } catch (err) { return this.handleError(res, err); }
  };

  updateMe = async (req, res) => {
    try {
      const user = await this.userService.updateMe(req.user.id, req.body);
      return res.json({ user, message: 'Cập nhật thông tin cá nhân thành công.' });
    } catch (err) {
      return this.handleError(res, err, 'Lỗi máy chủ khi cập nhật thông tin.');
    }
  };

  setActive = async (req, res) => {
    try {
      const active = !!(req.body && req.body.is_active);
      await this.userService.setActive(req.user, req.params.id, active);
      return res.json({ message: active ? 'Đã mở khóa tài khoản.' : 'Đã khóa tài khoản.' });
    } catch (err) {
      return this.handleError(res, err);
    }
  };

  remove = async (req, res) => {
    try {
      await this.userService.remove(req.user, req.params.id);
      return res.json({ message: 'Đã xóa người dùng.' });
    } catch (err) {
      return this.handleError(res, err, 'Lỗi máy chủ khi xóa người dùng.');
    }
  };
}

module.exports = UserController;
