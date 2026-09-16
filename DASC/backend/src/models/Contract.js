/**
 * Model: Contract — Entity ánh xạ từ bảng `contracts`.
 * Lưu đơn giá điện/nước thỏa thuận cố định tại thời điểm ký (price_electricity, price_water)
 * để làm căn cứ tính hóa đơn hàng tháng, không phụ thuộc vào giá thị trường thay đổi sau này.
 */
class Contract {
  constructor({
    id, room_id, tenant_id, room_number, tenant_name, tenant_phone, tenant_cccd,
    deposit, electricity_rate, water_rate, service_fee, start_date, end_date, status, created_at,
  }) {
    this.id = id;
    this.room_id = room_id;
    this.room_number = room_number;
    this.tenant_id = tenant_id;
    this.tenant_name = tenant_name;
    this.tenant_phone = tenant_phone;
    this.tenant_cccd = tenant_cccd;
    this.deposit = deposit;
    this.price_electricity = electricity_rate;
    this.price_water = water_rate;
    this.service_fee = service_fee;
    this.start_date = start_date;
    this.end_date = end_date;
    this.status = status; // 'ACTIVE' | 'EXPIRED'
    this.created_at = created_at;
  }

  static fromRow(row) {
    return row ? new Contract(row) : null;
  }

  isActive() {
    return this.status === 'ACTIVE';
  }
}

module.exports = Contract;
