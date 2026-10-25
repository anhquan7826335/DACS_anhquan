/**
 * Model: Contract — Entity ánh xạ từ bảng `contracts`.
 * rental_type: 'MONTHLY' (thuê tháng, admin tạo) | 'DAILY' (thuê ngày, sinh ra khi admin duyệt yêu cầu).
 * Hợp đồng không còn đơn giá điện/nước: tiền điện nước nhập thẳng (VNĐ) khi tạo hóa đơn.
 */
class Contract {
  constructor({
    id, room_id, tenant_id, room_number, tenant_name, tenant_phone,
    deposit, start_date, end_date, status, rental_type, daily_rate, created_at,
  }) {
    this.id = id;
    this.room_id = room_id;
    this.room_number = room_number;
    this.tenant_id = tenant_id;
    this.tenant_name = tenant_name;
    this.tenant_phone = tenant_phone;
    this.deposit = deposit;
    this.start_date = start_date;
    this.end_date = end_date;
    this.status = status; // 'ACTIVE' | 'EXPIRED'
    this.rental_type = rental_type;
    this.daily_rate = daily_rate;
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
