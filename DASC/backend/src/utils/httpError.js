/** Tạo lỗi có mã HTTP để BaseController.handleError trả đúng status. */
function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

module.exports = { httpError };
