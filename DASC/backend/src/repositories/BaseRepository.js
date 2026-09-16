/**
 * BaseRepository — lớp cha cho toàn bộ tầng Repository (Data Access Layer).
 * Đóng gói (encapsulation) connection pool và cung cấp các helper dùng chung.
 * Mỗi repository con (UserRepository, RoomRepository, ...) kế thừa (extends)
 * lớp này để tái sử dụng logic truy vấn cơ bản.
 */
class BaseRepository {
  constructor(pool) {
    if (!pool) throw new Error('BaseRepository yêu cầu truyền vào connection pool.');
    this.pool = pool;
  }

  /**
   * Chạy 1 câu SQL đơn giản (không cần transaction) và trả về rows.
   */
  async query(sql, params = []) {
    const [rows] = await this.pool.query(sql, params);
    return rows;
  }

  /**
   * Lấy 1 connection riêng để tự quản lý transaction (beginTransaction/commit/rollback)
   * — dùng trong các repository cần thao tác nhiều bảng cùng lúc (VD: ContractRepository).
   */
  async getConnection() {
    return this.pool.getConnection();
  }
}

module.exports = BaseRepository;
