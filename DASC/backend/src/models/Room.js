/**
 * Model: Room — Entity ánh xạ từ bảng `rooms`.
 */
class Room {
  constructor({ id, room_number, floor, price, area, status, description, current_contract_id, tenant_name, end_date }) {
    this.id = id;
    this.room_number = room_number;
    this.floor = floor;
    this.price = price; // base_price
    this.area = area;
    this.status = status; // 'EMPTY' | 'RENTED' | 'MAINTENANCE'
    this.description = description;
    this.current_contract_id = current_contract_id;
    this.current_tenant_name = tenant_name;
    this.end_date = end_date;
  }

  static fromRow(row) {
    return row ? new Room(row) : null;
  }

  isAvailable() {
    return this.status === 'EMPTY';
  }
}

module.exports = Room;
