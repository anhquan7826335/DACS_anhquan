/**
 * Model: Invoice — Entity ánh xạ từ bảng `invoices`.
 * Chứa sẵn phương thức tính tiền (thuộc phạm vi entity — công thức tính không đổi
 * bất kể ai gọi), khác với InvoiceService là nơi điều phối luồng nghiệp vụ
 * (lấy đơn giá từ Contract, gọi PaymentService sinh QR, lưu DB...).
 */
class Invoice {
  constructor({
    id, contract_id, room_id, tenant_id, room_number, tenant_name, month, year,
    old_electricity, new_electricity, old_water, new_water,
    room_fee, electricity_fee, water_fee, other_fee, total_amount,
    payment_status, due_date, bill_file_url, qr_code_url,
    last_reminder_sent_at, reminder_count, created_at,
  }) {
    this.id = id;
    this.contract_id = contract_id;
    this.room_id = room_id;
    this.tenant_id = tenant_id;
    this.room_number = room_number;
    this.tenant_name = tenant_name;
    this.month = month;
    this.year = year;
    this.old_elec = old_electricity;
    this.new_elec = new_electricity;
    this.old_water = old_water;
    this.new_water = new_water;
    this.room_fee = room_fee;
    this.electricity_fee = electricity_fee;
    this.water_fee = water_fee;
    this.other_fee = other_fee;
    this.total_amount = total_amount;
    this.payment_status = payment_status; // 'UNPAID' | 'PAID'
    this.due_date = due_date;
    this.bill_file_url = bill_file_url;
    this.qr_code_url = qr_code_url || null;
    this.last_reminder_sent_at = last_reminder_sent_at;
    this.reminder_count = reminder_count;
    this.created_at = created_at;
  }

  static fromRow(row) {
    return row ? new Invoice(row) : null;
  }

  /**
   * Tính toán chi tiết hóa đơn dựa trên đơn giá lấy từ Contract + giá phòng lấy từ Room.
   * Trả về object đã tính sẵn, dùng để tạo Invoice mới (chưa insert DB).
   */
  static calculate({ oldElec, newElec, oldWater, newWater, roomPrice, electricityRate, waterRate, serviceFee = 0, otherFee = 0 }) {
    const elecUsed = Math.max(0, newElec - oldElec);
    const waterUsed = Math.max(0, newWater - oldWater);
    const electricityFee = elecUsed * electricityRate;
    const waterFee = waterUsed * waterRate;
    const totalAmount = Number(roomPrice) + electricityFee + waterFee + Number(serviceFee) + Number(otherFee);
    return { elecUsed, waterUsed, electricityFee, waterFee, roomFee: roomPrice, totalAmount };
  }

  isPaid() {
    return this.payment_status === 'PAID';
  }

  isOverdue(today = new Date()) {
    return !this.isPaid() && new Date(this.due_date) < today;
  }
}

module.exports = Invoice;
