/**
 * Model: Ticket — Entity ánh xạ từ bảng `tickets` (báo cáo sự cố kỹ thuật).
 */
class Ticket {
  constructor({
    id, room_id, tenant_id, room_number, tenant_name, title, description,
    image_url, device_type, severity, status, created_at,
  }) {
    this.id = id;
    this.room_id = room_id;
    this.room_number = room_number;
    this.tenant_id = tenant_id;
    this.tenant_name = tenant_name;
    this.title = title;
    this.description = description;
    this.media_url = image_url;
    this.device_type = device_type || null; // do AI Vision (OCRService) trả về, không lưu cột riêng trong DB hiện tại
    this.severity = severity; // 'LOW' | 'MEDIUM' | 'HIGH'
    this.status = status; // 'PENDING' | 'IN_PROGRESS' | 'RESOLVED'
    this.created_at = created_at;
  }

  static fromRow(row) {
    return row ? new Ticket(row) : null;
  }

  isUrgent() {
    return this.severity === 'HIGH';
  }
}

module.exports = Ticket;
