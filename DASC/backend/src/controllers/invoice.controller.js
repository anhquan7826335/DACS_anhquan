const { pool } = require('../config/db');
const { uploadBuffer } = require('../utils/cloudinary');
const { extractMeterReading } = require('../utils/ai');
const { buildVietQRUrl, buildTransferContent } = require('../utils/vietqr');
const { runReminderPass } = require('../cron/reminder.cron');

// POST /api/invoices/scan-bill  (multipart/form-data, field "file")
// Nhận file ảnh/PDF hóa đơn gốc hoặc ảnh công tơ -> AI/OCR bóc tách chỉ số điện/nước.
// FE dùng kết quả này để tự động điền vào ô "chỉ số mới" (Phương thức 2 & 3).
async function scanBill(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Vui lòng đính kèm file ảnh hoặc PDF hóa đơn.' });
    }

    // Upload lên Cloudinary để lưu trữ vĩnh viễn (bill_file_url)
    const uploadResult = await uploadBuffer(req.file.buffer, {
      folder: 'rental_management/bills',
      resourceType: 'auto',
    });

    // Gọi AI Vision/OCR để đọc chỉ số điện/nước từ chính file vừa upload
    const base64 = req.file.buffer.toString('base64');
    const reading = await extractMeterReading(base64, req.file.mimetype);

    return res.json({
      bill_file_url: uploadResult.secure_url,
      new_electricity: reading.new_electricity,
      new_water: reading.new_water,
      confidence: reading.confidence,
      raw_text: reading.raw_text,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Lỗi khi quét hóa đơn: ' + err.message });
  }
}

// POST /api/invoices  -> Tạo hóa đơn chốt điện nước
// { contract_id, month, year, old_electricity, new_electricity, old_water, new_water,
//   other_fee, due_date, bill_file_url }
async function createInvoice(req, res) {
  try {
    const {
      contract_id, month, year,
      old_electricity, new_electricity, old_water, new_water,
      other_fee, due_date, bill_file_url,
    } = req.body;

    if (!contract_id || !month || !year || new_electricity == null || new_water == null || !due_date) {
      return res.status(400).json({ message: 'Thiếu thông tin bắt buộc để tạo hóa đơn.' });
    }

    // Lấy đơn giá từ contracts để tính total_amount
    const [contractRows] = await pool.query('SELECT * FROM contracts WHERE id = ?', [contract_id]);
    if (contractRows.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy hợp đồng.' });
    }
    const contract = contractRows[0];

    const [roomRows] = await pool.query('SELECT price FROM rooms WHERE id = ?', [contract.room_id]);
    const roomFee = roomRows[0]?.price || 0;

    const elecUsed = Math.max(0, new_electricity - old_electricity);
    const waterUsed = Math.max(0, new_water - old_water);
    const electricityFee = elecUsed * contract.electricity_rate;
    const waterFee = waterUsed * contract.water_rate;
    const totalAmount =
      Number(roomFee) + electricityFee + waterFee + Number(contract.service_fee || 0) + Number(other_fee || 0);

    const [result] = await pool.query(
      `INSERT INTO invoices
        (contract_id, room_id, tenant_id, room_number, tenant_name, month, year,
         old_electricity, new_electricity, old_water, new_water,
         room_fee, electricity_fee, water_fee, other_fee, total_amount,
         payment_status, due_date, bill_file_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'UNPAID', ?, ?)`,
      [
        contract_id, contract.room_id, contract.tenant_id, contract.room_number, contract.tenant_name,
        month, year, old_electricity, new_electricity, old_water, new_water,
        roomFee, electricityFee, waterFee, other_fee || 0, totalAmount, due_date, bill_file_url || null,
      ]
    );
    const invoiceId = result.insertId;

    // Sinh link VietQR tự động
    const addInfo = buildTransferContent(contract.room_number, invoiceId);
    const qrUrl = buildVietQRUrl({ amount: totalAmount, addInfo });

    // NOTE: gửi thông báo kèm mã QR về khách (email/SMS/push) — tích hợp kênh gửi
    // cụ thể (vd. nodemailer, Zalo ZNS, FCM) tùy hạ tầng triển khai thực tế.

    return res.status(201).json({
      id: invoiceId,
      total_amount: totalAmount,
      qr_url: qrUrl,
      transfer_content: addInfo,
      message: 'Tạo hóa đơn thành công, đã sinh mã QR thanh toán.',
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Lỗi máy chủ khi tạo hóa đơn.' });
  }
}

// GET /api/invoices/admin  -> toàn bộ danh sách hóa đơn (hỗ trợ ?status=&month=&year=)
async function getAllInvoices(req, res) {
  try {
    const { status, month, year } = req.query;
    let sql = 'SELECT * FROM invoices WHERE 1=1';
    const params = [];
    if (status) { sql += ' AND payment_status = ?'; params.push(status); }
    if (month) { sql += ' AND month = ?'; params.push(month); }
    if (year) { sql += ' AND year = ?'; params.push(year); }
    sql += ' ORDER BY year DESC, month DESC, room_number ASC';

    const [rows] = await pool.query(sql, params);
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Lỗi máy chủ.' });
  }
}

// GET /api/invoices/tenant  -> hóa đơn của khách thuê đang đăng nhập (req.user.id)
async function getTenantInvoices(req, res) {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM invoices WHERE tenant_id = ? ORDER BY year DESC, month DESC',
      [req.user.id]
    );
    // Kèm QR cho các hóa đơn chưa thanh toán để FE hiển thị nút "Thanh toán ngay"
    const withQR = rows.map((inv) => {
      if (inv.payment_status === 'UNPAID') {
        const addInfo = buildTransferContent(inv.room_number, inv.id);
        return { ...inv, qr_url: buildVietQRUrl({ amount: inv.total_amount, addInfo }), transfer_content: addInfo };
      }
      return inv;
    });
    return res.json(withQR);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Lỗi máy chủ.' });
  }
}

// PUT /api/invoices/:id/pay  -> Đánh dấu hóa đơn đã thanh toán
// Dùng cho: (a) Admin xác nhận thủ công, (b) Webhook ngân hàng gọi khi Auto-Matching nội dung CK
async function payInvoice(req, res) {
  try {
    const [result] = await pool.query(
      `UPDATE invoices SET payment_status = 'PAID' WHERE id = ?`,
      [req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Không tìm thấy hóa đơn.' });
    return res.json({ message: 'Đã cập nhật hóa đơn sang trạng thái Đã thanh toán.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Lỗi máy chủ.' });
  }
}

// POST /api/invoices/trigger-reminders  -> API cho Cronjob (hoặc gọi thủ công để test) kích hoạt gửi nhắc nợ
async function triggerReminders(req, res) {
  try {
    // Bảo vệ endpoint gọi bởi hệ thống (Cronjob ngoài/CI) bằng secret riêng, không dùng JWT người dùng.
    const secret = req.headers['x-cron-secret'];
    if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
      return res.status(401).json({ message: 'Thiếu hoặc sai x-cron-secret.' });
    }
    const summary = await runReminderPass();
    return res.json({ message: 'Đã chạy tiến trình nhắc nợ.', ...summary });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Lỗi máy chủ khi chạy tiến trình nhắc nợ.' });
  }
}

// POST /api/invoices/bank-webhook
// Webhook do ngân hàng/cổng thanh toán bắn về khi có giao dịch chuyển khoản mới.
// Payload tối giản kỳ vọng: { content: "<nội dung chuyển khoản>", amount: <số tiền> }
// Hệ thống parse content để tìm đúng invoice (theo transfer_content sinh từ buildTransferContent),
// đối chiếu số tiền, rồi tự đổi trạng thái hóa đơn thành PAID (Gạch nợ tự động).
async function bankWebhook(req, res) {
  try {
    const secret = req.headers['x-webhook-secret'];
    if (process.env.BANK_WEBHOOK_SECRET && secret !== process.env.BANK_WEBHOOK_SECRET) {
      return res.status(401).json({ message: 'Sai chữ ký webhook.' });
    }

    const { content, amount } = req.body;
    if (!content) return res.status(400).json({ message: 'Thiếu nội dung chuyển khoản.' });

    // Nội dung định danh có dạng SEV{room_number}{invoiceId}, ví dụ: SEVP101 43
    // -> quét toàn bộ hóa đơn UNPAID và so khớp transfer_content được sinh lại.
    const [unpaidInvoices] = await pool.query(`SELECT * FROM invoices WHERE payment_status = 'UNPAID'`);
    const normalizedContent = content.replace(/\s+/g, '').toUpperCase();

    const matched = unpaidInvoices.find((inv) => {
      const expected = buildTransferContent(inv.room_number, inv.id);
      return normalizedContent.includes(expected);
    });

    if (!matched) {
      return res.status(404).json({ message: 'Không khớp được hóa đơn nào với nội dung chuyển khoản.' });
    }
    if (amount != null && Number(amount) < Number(matched.total_amount)) {
      return res.status(409).json({ message: 'Số tiền chuyển khoản nhỏ hơn số tiền hóa đơn, cần đối soát thủ công.' });
    }

    await pool.query(`UPDATE invoices SET payment_status = 'PAID' WHERE id = ?`, [matched.id]);
    return res.json({ message: 'Gạch nợ tự động thành công.', invoice_id: matched.id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Lỗi máy chủ khi xử lý webhook ngân hàng.' });
  }
}

module.exports = {
  scanBill, createInvoice, getAllInvoices, getTenantInvoices, payInvoice, triggerReminders, bankWebhook,
};
