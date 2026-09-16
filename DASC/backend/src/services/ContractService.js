/**
 * ContractService — business logic cho module Hợp đồng.
 * Chịu trách nhiệm điều phối transaction giữa Room và Contract (tạo hợp đồng phải
 * đồng thời cập nhật trạng thái phòng — cần đảm bảo tính toàn vẹn dữ liệu).
 */
class ContractService {
  constructor(contractRepository, roomRepository, userRepository) {
    this.contractRepository = contractRepository;
    this.roomRepository = roomRepository;
    this.userRepository = userRepository;
  }

  async create(data) {
    const { room_id, tenant_id, deposit, electricity_rate, water_rate, start_date, end_date } = data;
    if (!room_id || !tenant_id || !deposit || !electricity_rate || !water_rate || !start_date || !end_date) {
      const err = new Error('Thiếu thông tin bắt buộc để tạo hợp đồng.');
      err.status = 400;
      throw err;
    }

    const conn = await this.contractRepository.getConnection();
    try {
      await conn.beginTransaction();

      const room = await this.roomRepository.findByIdForUpdate(conn, room_id);
      if (!room) { const e = new Error('Không tìm thấy phòng.'); e.status = 404; throw e; }
      if (room.status === 'RENTED') {
        const e = new Error(`Phòng ${room.room_number} hiện đang có người thuê.`);
        e.status = 409;
        throw e;
      }

      const tenantRow = await this.userRepository.findById(tenant_id);
      if (!tenantRow) { const e = new Error('Không tìm thấy khách thuê.'); e.status = 404; throw e; }

      const contractId = await this.contractRepository.createWithConnection(conn, {
        room_id, tenant_id, room_number: room.room_number, tenant_name: tenantRow.full_name,
        tenant_phone: data.tenant_phone || tenantRow.phone, tenant_cccd: data.tenant_cccd || tenantRow.cccd,
        deposit, electricity_rate, water_rate, service_fee: data.service_fee || 0, start_date, end_date,
      });

      await conn.query(
        `UPDATE rooms SET status = 'RENTED', current_contract_id = ?, tenant_name = ?, end_date = ? WHERE id = ?`,
        [contractId, tenantRow.full_name, end_date, room_id]
      );

      await conn.commit();
      return contractId;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  async getActiveByRoom(roomId) {
    const contract = await this.contractRepository.findActiveByRoom(roomId);
    if (!contract) {
      const err = new Error('Phòng chưa có hợp đồng đang hiệu lực.');
      err.status = 404;
      throw err;
    }
    return contract;
  }

  async getActiveByTenant(tenantId) {
    const contract = await this.contractRepository.findActiveByTenant(tenantId);
    if (!contract) {
      const err = new Error('Bạn hiện không có hợp đồng thuê nào đang hiệu lực.');
      err.status = 404;
      throw err;
    }
    return contract;
  }

  async terminate(contractId) {
    const conn = await this.contractRepository.getConnection();
    try {
      await conn.beginTransaction();

      const contract = await this.contractRepository.findByIdForUpdate(conn, contractId);
      if (!contract) { const e = new Error('Không tìm thấy hợp đồng.'); e.status = 404; throw e; }

      await this.contractRepository.setStatusWithConnection(conn, contract.id, 'EXPIRED');
      await conn.query(
        `UPDATE rooms SET status = 'EMPTY', current_contract_id = NULL, tenant_name = NULL, end_date = NULL WHERE id = ?`,
        [contract.room_id]
      );

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
}

module.exports = ContractService;
