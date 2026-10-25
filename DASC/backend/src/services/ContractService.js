const { httpError } = require('../utils/httpError');
const { todayInAppTz, nowInAppTz, isValidDate, addDays, addMonths } = require('../utils/date');

const STATUSES = ['PENDING', 'ACTIVE', 'EXPIRED', 'REJECTED', 'CANCELLED'];

function money(v, label) {
  const n = Number(v);
  if (v === '' || v === null || !Number.isInteger(n) || n < 0) throw httpError(400, `${label} phải là số nguyên không âm (VNĐ).`);
  return n;
}

/**
 * ContractService — Hợp đồng và yêu cầu thuê phòng (thuê NGÀY hoặc THÁNG) dùng chung một bảng `contracts`:
 *   PENDING (khách gửi yêu cầu) -> ACTIVE (admin duyệt / admin tạo trực tiếp) -> EXPIRED (hết hạn / thanh lý)
 *   PENDING -> REJECTED (admin từ chối) | CANCELLED (khách hủy)
 * Mỗi phòng chỉ có tối đa 1 hợp đồng ACTIVE (ràng buộc UNIQUE trong DB + khóa dòng phòng khi thao tác).
 */
class ContractService {
  constructor(contractRepository, roomRepository, userRepository) {
    this.contractRepository = contractRepository;
    this.roomRepository = roomRepository;
    this.userRepository = userRepository;
  }

  _housekeeping() {
    return this.roomRepository.housekeeping(todayInAppTz(), nowInAppTz());
  }

  async _tx(fn) {
    const conn = await this.contractRepository.getConnection();
    try {
      await conn.beginTransaction();
      const result = await fn(conn);
      await conn.commit();
      return result;
    } catch (err) {
      await conn.rollback();
      if (err && err.code === 'ER_DUP_ENTRY') throw httpError(409, 'Phòng này đã có hợp đồng đang hiệu lực.');
      throw err;
    } finally {
      conn.release();
    }
  }

  /** Tính ngày kết thúc: DAILY = số ngày (1..365), MONTHLY = số tháng (1..36). */
  _computeEnd(rental_type, start_date, { days, months }) {
    if (!isValidDate(start_date)) throw httpError(400, 'Ngày bắt đầu không hợp lệ.');
    if (rental_type === 'DAILY') {
      const d = Number(days);
      if (!Number.isInteger(d) || d < 1 || d > 365) throw httpError(400, 'Số ngày thuê phải từ 1 đến 365.');
      return addDays(start_date, d - 1);
    }
    const m = Number(months);
    if (!Number.isInteger(m) || m < 1 || m > 36) throw httpError(400, 'Số tháng thuê phải từ 1 đến 36.');
    return addDays(addMonths(start_date, m), -1);
  }

  /** Admin tạo hợp đồng trực tiếp (có hiệu lực ngay). */
  async create(data = {}) {
    const { room_id, tenant_id } = data;
    const rental_type = data.rental_type || 'MONTHLY';
    if (!['MONTHLY', 'DAILY'].includes(rental_type)) throw httpError(400, 'Loại thuê không hợp lệ.');
    if (!room_id || !tenant_id || !data.start_date) throw httpError(400, 'Thiếu thông tin bắt buộc để tạo hợp đồng.');
    const deposit = data.deposit == null || data.deposit === '' ? 0 : money(data.deposit, 'Tiền cọc');
    if (!isValidDate(data.start_date)) throw httpError(400, 'Ngày bắt đầu không hợp lệ.');
    let end_date = data.end_date;
    if (end_date) {
      if (!isValidDate(end_date)) throw httpError(400, 'Ngày kết thúc không hợp lệ.');
    } else {
      end_date = this._computeEnd(rental_type, data.start_date, data);
    }
    if (end_date < data.start_date) throw httpError(400, 'Ngày kết thúc không được trước ngày bắt đầu.');

    await this._housekeeping();
    const tenant = await this.userRepository.findById(tenant_id);
    if (!tenant || tenant.role !== 'TENANT') throw httpError(404, 'Không tìm thấy khách thuê.');

    return this._tx(async (conn) => {
      const room = await this.roomRepository.findByIdForUpdate(conn, room_id);
      if (!room) throw httpError(404, 'Không tìm thấy phòng.');
      if (room.status !== 'EMPTY') {
        throw httpError(409, `Phòng ${room.room_number} hiện ${room.status === 'RENTED' ? 'đang có người thuê' : 'đang bảo trì'}.`);
      }
      const monthly_fee = data.monthly_fee != null && data.monthly_fee !== '' ? money(data.monthly_fee, 'Tiền thuê tháng') : Number(room.price);
      const daily_fee = data.daily_fee != null && data.daily_fee !== '' ? money(data.daily_fee, 'Tiền thuê ngày') : Number(room.daily_rate);
      const now = nowInAppTz();
      const id = await this.contractRepository.insertWithConnection(conn, {
        tenant_id, room_id, monthly_fee, daily_fee, deposit, start_date: data.start_date, end_date,
        rental_type, status: 'ACTIVE', decided_at: now,
      });
      await conn.query(`UPDATE rooms SET status = 'RENTED' WHERE id = ?`, [room_id]);
      await this.contractRepository.rejectOtherPending(conn, room_id, id, 'Phòng đã được cho thuê', now);
      return id;
    });
  }

  /** Khách gửi yêu cầu thuê phòng trống (chờ admin duyệt). */
  async request(tenantId, data = {}) {
    const { room_id, start_date } = data;
    const rental_type = data.rental_type;
    if (!room_id || !start_date || !['MONTHLY', 'DAILY'].includes(rental_type)) {
      throw httpError(400, 'Vui lòng chọn phòng, hình thức thuê và ngày bắt đầu.');
    }
    const end_date = this._computeEnd(rental_type, start_date, data);
    if (start_date < todayInAppTz()) throw httpError(400, 'Ngày bắt đầu không được ở quá khứ.');

    await this._housekeeping();
    const room = await this.roomRepository.findById(room_id);
    if (!room) throw httpError(404, 'Không tìm thấy phòng.');
    if (room.status !== 'EMPTY') throw httpError(409, 'Phòng này hiện không còn trống.');
    if (await this.contractRepository.findPendingByTenantAndRoom(tenantId, room_id)) {
      throw httpError(409, 'Bạn đã gửi yêu cầu thuê phòng này và đang chờ duyệt.');
    }
    return this._tx(async (conn) => this.contractRepository.insertWithConnection(conn, {
      tenant_id: tenantId, room_id, monthly_fee: room.price, daily_fee: room.daily_rate, deposit: 0,
      start_date, end_date, rental_type, status: 'PENDING',
    }));
  }

  async listMine(tenantId) {
    await this._housekeeping();
    return this.contractRepository.findByTenant(tenantId);
  }

  async cancel(id, tenantId) {
    await this._housekeeping();
    const affected = await this.contractRepository.cancel(id, tenantId, nowInAppTz());
    if (!affected) throw httpError(409, 'Chỉ hủy được yêu cầu của bạn khi còn ở trạng thái chờ duyệt.');
  }

  /** Admin duyệt yêu cầu: phòng phải còn trống, ngày bắt đầu chưa qua. */
  async approve(id, body = {}) {
    await this._housekeeping();
    return this._tx(async (conn) => {
      const peek = await this.contractRepository.findByIdForUpdate(conn, id);
      if (!peek) throw httpError(404, 'Không tìm thấy yêu cầu.');
      const room = await this.roomRepository.findByIdForUpdate(conn, peek.room_id);
      const c = await this.contractRepository.findByIdForUpdate(conn, id);
      if (c.status !== 'PENDING') throw httpError(409, 'Yêu cầu này đã được xử lý.');
      if (c.start_date < todayInAppTz()) throw httpError(409, 'Ngày bắt đầu đã qua, hãy từ chối yêu cầu này.');
      if (room.status !== 'EMPTY') throw httpError(409, 'Phòng hiện không còn trống.');
      const deposit = body.deposit == null || body.deposit === '' ? Number(c.deposit) : money(body.deposit, 'Tiền cọc');
      const now = nowInAppTz();
      await this.contractRepository.markApproved(conn, c.id, deposit, now);
      await conn.query(`UPDATE rooms SET status = 'RENTED' WHERE id = ?`, [c.room_id]);
      await this.contractRepository.rejectOtherPending(conn, c.room_id, c.id, 'Phòng đã được cho thuê', now);
    });
  }

  async reject(id, note) {
    const n = String(note || '').trim().slice(0, 255) || 'Chủ trọ từ chối yêu cầu';
    const affected = await this.contractRepository.reject(id, n, nowInAppTz());
    if (!affected) {
      if (!(await this.contractRepository.findById(id))) throw httpError(404, 'Không tìm thấy yêu cầu.');
      throw httpError(409, 'Yêu cầu này đã được xử lý.');
    }
  }

  async list(filters = {}) {
    await this._housekeeping();
    return this.contractRepository.findAll({
      status: STATUSES.includes(filters.status) ? filters.status : undefined,
      rental_type: ['MONTHLY', 'DAILY'].includes(filters.rental_type) ? filters.rental_type : undefined,
      room_id: filters.room_id ? Number(filters.room_id) : undefined,
      tenant_id: filters.tenant_id ? Number(filters.tenant_id) : undefined,
    });
  }

  async getActiveByRoom(roomId) {
    await this._housekeeping();
    const contract = await this.contractRepository.findActiveByRoom(roomId);
    if (!contract) throw httpError(404, 'Phòng chưa có hợp đồng đang hiệu lực.');
    return contract;
  }

  async getActiveByTenant(tenantId) {
    await this._housekeeping();
    const contract = await this.contractRepository.findActiveByTenant(tenantId);
    if (!contract) throw httpError(404, 'Bạn hiện không có hợp đồng thuê nào đang hiệu lực.');
    return contract;
  }

  /** Sửa hợp đồng đang hiệu lực hoặc yêu cầu chờ duyệt: tiền cọc, thời hạn, đơn giá. */
  async update(id, body = {}) {
    const contract = await this.contractRepository.findById(id);
    if (!contract) throw httpError(404, 'Không tìm thấy hợp đồng.');
    if (!['ACTIVE', 'PENDING'].includes(contract.status)) throw httpError(409, 'Hợp đồng đã kết thúc nên không thể sửa.');

    const patch = {};
    if (body.deposit !== undefined) patch.deposit = money(body.deposit, 'Tiền cọc');
    if (body.monthly_fee !== undefined) patch.monthly_fee = money(body.monthly_fee, 'Tiền thuê tháng');
    const daily = body.daily_fee !== undefined ? body.daily_fee : body.daily_rate;
    if (daily !== undefined) patch.daily_fee = money(daily, 'Tiền thuê ngày');
    if (body.start_date !== undefined) {
      if (!isValidDate(body.start_date)) throw httpError(400, 'Ngày bắt đầu không hợp lệ.');
      patch.start_date = body.start_date;
    }
    if (body.end_date !== undefined) {
      if (!isValidDate(body.end_date)) throw httpError(400, 'Ngày kết thúc không hợp lệ.');
      patch.end_date = body.end_date;
    }
    if (Object.keys(patch).length === 0) throw httpError(400, 'Không có thông tin nào để cập nhật.');
    if ((patch.end_date ?? contract.end_date) < (patch.start_date ?? contract.start_date)) {
      throw httpError(400, 'Ngày kết thúc không được trước ngày bắt đầu.');
    }
    await this.contractRepository.update(contract.id, patch);
  }

  /** Xóa hợp đồng/yêu cầu. Đã có hóa đơn thì không xóa. Hợp đồng ACTIVE: phòng trả về Trống. */
  async remove(id) {
    return this._tx(async (conn) => {
      const c = await this.contractRepository.findByIdForUpdate(conn, id);
      if (!c) throw httpError(404, 'Không tìm thấy hợp đồng.');
      if (await this.contractRepository.countInvoicesWithConnection(conn, c.id) > 0) {
        throw httpError(409, 'Hợp đồng đã có hóa đơn nên không thể xóa. Hãy thanh lý hợp đồng thay vì xóa.');
      }
      await conn.query('DELETE FROM contracts WHERE id = ?', [c.id]);
      if (c.status === 'ACTIVE') await conn.query(`UPDATE rooms SET status = 'EMPTY' WHERE id = ?`, [c.room_id]);
    });
  }

  async terminate(id) {
    return this._tx(async (conn) => {
      const c = await this.contractRepository.findByIdForUpdate(conn, id);
      if (!c) throw httpError(404, 'Không tìm thấy hợp đồng.');
      if (c.status !== 'ACTIVE') throw httpError(409, 'Hợp đồng này đã kết thúc trước đó.');
      await this.contractRepository.setStatusWithConnection(conn, c.id, 'EXPIRED');
      await conn.query(`UPDATE rooms SET status = 'EMPTY' WHERE id = ?`, [c.room_id]);
    });
  }
}

module.exports = ContractService;
