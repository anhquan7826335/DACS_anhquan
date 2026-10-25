/**
 * Model: Invoice — Entity ánh xạ từ bảng `invoices`.
 * Mọi cột tiền đều tính bằng VNĐ: tiền điện/nước là SỐ TIỀN (không phải chỉ số công tơ).
 * Chứa sẵn phương thức tính tiền (thuộc phạm vi entity — công thức tính không đổi
 * bất kể ai gọi), khác với InvoiceService là nơi điều phối luồng nghiệp vụ.
 */
class Invoice {
  constructor({
    id, contract_id, room_id, tenant_id, room_number, tenant_name, month, year,
    room_fee, electricity, water, other_fee, total_amount,
    payment_status, paid_at, payment_method, transaction_ref, due_date, bill_file_url,
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
    this.room_fee = room_fee;
    this.electricity = electricity; // tiền điện (VNĐ)
    this.water = water; // tiền nước (VNĐ)
    this.other_fee = other_fee; // phụ phí (VNĐ)
    this.total_amount = total_amount;
    this.payment_status = payment_status; // 'UNPAID' | 'PAID'
    this.paid_at = paid_at;
    this.payment_method = payment_method;
    this.transaction_ref = transaction_ref;
    this.due_date = due_date;
    this.bill_file_url = bill_file_url;
    this.last_reminder_sent_at = last_reminder_sent_at;
    this.reminder_count = reminder_count;
    this.created_at = created_at;
  }

  static fromRow(row) {
    return row ? new Invoice(row) : null;
  }

  /**
   * Tổng hóa đơn = tiền phòng + tiền điện + tiền nước + phụ phí (tất cả VNĐ).
   */
  static calculate({ roomPrice, electricity = 0, water = 0, otherFee = 0 }) {
    const roomFee = Number(roomPrice);
    const totalAmount = roomFee + electricity + water + otherFee;
    return { roomFee, electricity, water, otherFee, totalAmount };
  }

  isPaid() {
    return this.payment_status === 'PAID';
  }

  isOverdue(today = new Date()) {
    return !this.isPaid() && new Date(this.due_date) < today;
  }
}

module.exports = Invoice;
