const BaseController = require('./BaseController');

async function sendWorkbook(res, wb, filename) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await wb.xlsx.write(res);
  res.end();
}

class ReportController extends BaseController {
  constructor(reportService) {
    super();
    this.reportService = reportService;
  }
  revenue = async (req, res) => {
    try { return res.json(await this.reportService.revenue(req.query)); } catch (err) { return this.handleError(res, err); }
  };
  exportRevenue = async (req, res) => {
    try {
      const wb = await this.reportService.revenueWorkbook(req.query);
      return await sendWorkbook(res, wb, 'doanh-thu.xlsx');
    } catch (err) { return this.handleError(res, err); }
  };
  exportTenantInvoices = async (req, res) => {
    try {
      const wb = await this.reportService.tenantInvoicesWorkbook(req.user.id, { from: req.query.from, to: req.query.to });
      return await sendWorkbook(res, wb, 'hoa-don.xlsx');
    } catch (err) { return this.handleError(res, err); }
  };
}

module.exports = ReportController;
