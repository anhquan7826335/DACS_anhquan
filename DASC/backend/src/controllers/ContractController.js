const BaseController = require('./BaseController');

class ContractController extends BaseController {
  constructor(contractService) {
    super();
    this.contractService = contractService;
  }

  createContract = async (req, res) => {
    try {
      const id = await this.contractService.create(req.body);
      return res.status(201).json({ id, message: 'Tạo hợp đồng thành công.' });
    } catch (err) {
      return this.handleError(res, err, 'Lỗi máy chủ khi tạo hợp đồng.');
    }
  };

  getActiveContractByRoom = async (req, res) => {
    try {
      const contract = await this.contractService.getActiveByRoom(req.params.roomId);
      return res.json(contract);
    } catch (err) {
      return this.handleError(res, err);
    }
  };

  getMyActiveContract = async (req, res) => {
    try {
      const contract = await this.contractService.getActiveByTenant(req.user.id);
      return res.json(contract);
    } catch (err) {
      return this.handleError(res, err);
    }
  };

  terminateContract = async (req, res) => {
    try {
      await this.contractService.terminate(req.params.id);
      return res.json({ message: 'Đã thanh lý hợp đồng, phòng chuyển về trạng thái Trống.' });
    } catch (err) {
      return this.handleError(res, err, 'Lỗi máy chủ khi thanh lý hợp đồng.');
    }
  };
}

module.exports = ContractController;
