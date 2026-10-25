const BaseController = require('./BaseController');

class ContractController extends BaseController {
  constructor(contractService) {
    super();
    this.s = contractService;
  }
  _h(fn, fallback) {
    return async (req, res) => {
      try { await fn(req, res); } catch (err) { this.handleError(res, err, fallback); }
    };
  }
  createContract = this._h(async (req, res) => {
    const id = await this.s.create(req.body);
    res.status(201).json({ id, message: 'Tạo hợp đồng thành công.' });
  }, 'Lỗi máy chủ khi tạo hợp đồng.');
  listContracts = this._h(async (req, res) => res.json(await this.s.list(req.query)));
  getActiveContractByRoom = this._h(async (req, res) => res.json(await this.s.getActiveByRoom(req.params.roomId)));
  getMyActiveContract = this._h(async (req, res) => res.json(await this.s.getActiveByTenant(req.user.id)));
  listMine = this._h(async (req, res) => res.json(await this.s.listMine(req.user.id)));
  requestRental = this._h(async (req, res) => {
    const id = await this.s.request(req.user.id, req.body);
    res.status(201).json({ id, message: 'Đã gửi yêu cầu thuê phòng, vui lòng chờ chủ trọ duyệt.' });
  }, 'Lỗi máy chủ khi gửi yêu cầu thuê.');
  cancelRequest = this._h(async (req, res) => {
    await this.s.cancel(req.params.id, req.user.id);
    res.json({ message: 'Đã hủy yêu cầu thuê phòng.' });
  });
  approve = this._h(async (req, res) => {
    await this.s.approve(req.params.id, req.body);
    res.json({ message: 'Đã duyệt yêu cầu, hợp đồng có hiệu lực.' });
  }, 'Lỗi máy chủ khi duyệt yêu cầu.');
  reject = this._h(async (req, res) => {
    await this.s.reject(req.params.id, req.body && req.body.admin_note);
    res.json({ message: 'Đã từ chối yêu cầu.' });
  });
  updateContract = this._h(async (req, res) => {
    await this.s.update(req.params.id, req.body);
    res.json({ message: 'Cập nhật hợp đồng thành công.' });
  }, 'Lỗi máy chủ khi cập nhật hợp đồng.');
  deleteContract = this._h(async (req, res) => {
    await this.s.remove(req.params.id);
    res.json({ message: 'Đã xóa hợp đồng.' });
  }, 'Lỗi máy chủ khi xóa hợp đồng.');
  terminateContract = this._h(async (req, res) => {
    await this.s.terminate(req.params.id);
    res.json({ message: 'Đã thanh lý hợp đồng, phòng chuyển về trạng thái Trống.' });
  }, 'Lỗi máy chủ khi thanh lý hợp đồng.');
}

module.exports = ContractController;
