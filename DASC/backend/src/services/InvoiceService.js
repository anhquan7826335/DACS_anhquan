const Invoice = require('../models/Invoice');

/**
 * InvoiceService — business logic trung tâm của hệ thống: tính tiền điện nước,
 * điều phối OCRService (đọc chỉ số), CloudinaryService (lưu file gốc),
 * và PaymentService (sinh QR + xử lý webhook).
 */
class InvoiceService {
  constructor(invoiceRepository, contractRepository, roomRepository, cloudinaryService, ocrService, paymentService) {
    this.invoiceRepository = invoiceRepository;
    this.contractRepository = contractRepository;
    this.roomRepository = roomRepository;
    this.cloudinaryService = cloudinaryService;
    this.ocrService = ocrService;
    this.paymentService = paymentService;
  }

  /**
   * Quét ảnh/PDF hóa đơn hoặc công tơ bằng AI Vision (OCRService), đồng thời lưu file
   * gốc lên Cloudinary (CloudinaryService) để tham chiếu sau này.
   */
  async scanBill(fileBuffer, mimeType) {
    const uploadResult = await this.cloudinaryService.uploadBuffer(fileBuffer, {
      folder: 'rental_management/bills',
      resourceType: 'auto',
    });
    const base64 = fileBuffer.toString('base64');
    const reading = await this.ocrService.extractMeterReading(base64, mimeType);

    return {
      bill_file_url: uploadResult.secure_url,
      new_electricity: reading.new_electricity,
      new_water: reading.new_water,
      confidence: reading.confidence,
      raw_text: reading.raw_text,
    };
  }

  /**
   * Tạo hóa đơn mới: lấy đơn giá từ Contract + giá phòng từ Room, tính tổng tiền
   * (dùng Invoice.calculate — logic tính toán thuộc Model), lưu DB, rồi nhờ
   * PaymentService sinh mã QR thanh toán.
   */
  async createInvoice(data) {
    const { contract_id, month, year, electricity, water, due_date } = data;
    if (!contract_id || !month || !year || !due_date) {
      const err = new Error('Thiếu thông tin bắt buộc để tạo hóa đơn.');
      err.status = 400;
      throw err;
    }
    if (!Number.isInteger(Number(month)) || Number(month) < 1 || Number(month) > 12 ||
        !Number.isInteger(Number(year)) || Number(year) < 1) {
      const err = new Error('Kỳ hóa đơn không hợp lệ.');
      err.status = 400;
      throw err;
    }

    const contract = await this.contractRepository.findById(contract_id);
    if (!contract) { const e = new Error('Không tìm thấy hợp đồng.'); e.status = 404; throw e; }

    const isDaily = contract.rental_type === 'DAILY';
    if (!isDaily && (electricity == null || water == null ||
        !Number.isInteger(Number(electricity)) || Number(electricity) < 0 ||
        !Number.isInteger(Number(water)) || Number(water) < 0)) {
      const err = new Error('Chỉ số điện và nước tiêu thụ phải là số nguyên không âm.');
      err.status = 400;
      throw err;
    }

    const room = await this.roomRepository.findById(contract.room_id);
    let roomPrice = room?.price || 0;
    let billableElectricity = Number(electricity || 0);
    let billableWater = Number(water || 0);
    let otherFee = Number(data.other_fee || 0);

    if (isDaily) {
      const periodStart = `${year}-${String(month).padStart(2, '0')}-01`;
      const periodEnd = new Date(Date.UTC(Number(year), Number(month), 0)).toISOString().slice(0, 10);
      const billableStart = contract.start_date > periodStart ? contract.start_date : periodStart;
      const billableEnd = contract.end_date < periodEnd ? contract.end_date : periodEnd;
      if (billableStart > billableEnd) {
        const err = new Error('Kỳ hóa đơn không nằm trong thời gian thuê của hợp đồng.');
        err.status = 400;
        throw err;
      }
      roomPrice = Math.round(Number(contract.daily_rate) * countDaysInclusive(billableStart, billableEnd));
      billableElectricity = 0;
      billableWater = 0;
      otherFee = 0;
    }

    const calc = Invoice.calculate({
      electricity: billableElectricity,
      water: billableWater,
      roomPrice, electricityRate: isDaily ? 0 : contract.electricity_rate,
      waterRate: isDaily ? 0 : contract.water_rate,
      serviceFee: isDaily ? 0 : contract.service_fee, otherFee,
    });

    const invoiceId = await this.invoiceRepository.create({
      contract_id, room_id: contract.room_id, tenant_id: contract.tenant_id,
      room_number: contract.room_number, tenant_name: contract.tenant_name, month, year,
      electricity: calc.electricity, water: calc.water,
      room_fee: calc.roomFee, electricity_fee: calc.electricityFee, water_fee: calc.waterFee,
      other_fee: otherFee, total_amount: calc.totalAmount,
      due_date, bill_file_url: data.bill_file_url,
    });

    const { qrUrl, transferContent } = this.paymentService.generateQRCode({
      amount: calc.totalAmount, roomNumber: contract.room_number, invoiceId,
    });

    return { id: invoiceId, total_amount: calc.totalAmount, qr_url: qrUrl, transfer_content: transferContent };
  }

  async listAll(filters) {
    return this.invoiceRepository.findAll(filters);
  }

  /**
   * Trả danh sách hóa đơn của tenant, kèm QR cho các hóa đơn UNPAID để FE hiển thị nút thanh toán.
   */
  async listForTenant(tenantId) {
    const rows = await this.invoiceRepository.findByTenant(tenantId);
    return rows.map((row) => {
      if (row.payment_status === 'UNPAID') {
        const { qrUrl, transferContent } = this.paymentService.generateQRCode({
          amount: row.total_amount, roomNumber: row.room_number, invoiceId: row.id,
        });
        return { ...row, qr_url: qrUrl, transfer_content: transferContent };
      }
      return row;
    });
  }

  async markPaid(invoiceId) {
    const affected = await this.invoiceRepository.markPaid(invoiceId);
    if (affected === 0) { const e = new Error('Không tìm thấy hóa đơn.'); e.status = 404; throw e; }
  }

  async handleBankWebhook(payload) {
    return this.paymentService.processBankWebhook(payload);
  }
}

function countDaysInclusive(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  return Math.floor((end - start) / 86400000) + 1;
}

module.exports = InvoiceService;
