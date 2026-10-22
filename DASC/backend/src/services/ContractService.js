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

    await this.roomRepository.expireEndedDailyRentals();
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
        tenant_phone: data.tenant_phone || tenantRow.phone,
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

  async createDaily(data) {
    const { room_id, tenant_id, start_date, end_date } = data;
    if (!room_id || !tenant_id || !isValidDate(start_date) || !isValidDate(end_date)) {
      const err = new Error('Vui lòng chọn phòng và thời gian thuê hợp lệ.');
      err.status = 400;
      throw err;
    }
    if (start_date < todayDate() || end_date < start_date) {
      const err = new Error('Ngày thuê phải bắt đầu từ hôm nay và ngày kết thúc không được trước ngày bắt đầu.');
      err.status = 400;
      throw err;
    }

    await this.roomRepository.expireEndedDailyRentals();
    const conn = await this.contractRepository.getConnection();
    try {
      await conn.beginTransaction();

      const room = await this.roomRepository.findByIdForUpdate(conn, room_id);
      if (!room) { const e = new Error('Không tìm thấy phòng.'); e.status = 404; throw e; }
      if (room.status !== 'EMPTY') {
        const e = new Error(`Phòng ${room.room_number} hiện không còn trống.`);
        e.status = 409;
        throw e;
      }

      const tenant = await this.userRepository.findById(tenant_id);
      if (!tenant || tenant.role !== 'TENANT') {
        const e = new Error('Không tìm thấy tài khoản khách thuê hợp lệ.');
        e.status = 404;
        throw e;
      }

      const dailyRate = Number(room.price) / 30;
      const days = countDaysInclusive(start_date, end_date);
      const totalRent = Math.round(dailyRate * days);
      const contractId = await this.contractRepository.createDailyWithConnection(conn, {
        room_id, tenant_id, room_number: room.room_number, tenant_name: tenant.full_name,
        tenant_phone: tenant.phone, start_date, end_date, daily_rate: dailyRate,
      });

      await conn.query(
        `UPDATE rooms SET status = 'RENTED', current_contract_id = ?, tenant_name = ?, end_date = ? WHERE id = ?`,
        [contractId, tenant.full_name, end_date, room_id]
      );

      await conn.commit();
      return { id: contractId, daily_rate: dailyRate, days, total_rent: totalRent };
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
    await this.roomRepository.expireEndedDailyRentals();
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

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function countDaysInclusive(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  return Math.floor((end - start) / 86400000) + 1;
}

module.exports = ContractService;
