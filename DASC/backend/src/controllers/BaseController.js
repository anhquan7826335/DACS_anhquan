/**
 * BaseController — lớp cha cho toàn bộ tầng Controller.
 * Đóng gói (encapsulation) cách xử lý lỗi chung: dựa vào err.status do Service ném ra
 * (400/401/403/404/409...), mặc định 500 nếu không có. Mọi Controller con kế thừa
 * (extends) để tái sử dụng, tránh lặp lại try/catch boilerplate ở từng hàm.
 */
class BaseController {
  handleError(res, err, fallbackMessage = 'Lỗi máy chủ không xác định.') {
    if (!err.status) console.error(err);
    return res.status(err.status || 500).json({ message: err.message || fallbackMessage });
  }
}

module.exports = BaseController;
