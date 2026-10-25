const { nowInAppTz } = require('../utils/date');

/**
 * TicketService — business logic cho module Báo cáo sự cố.
 * Điều phối OCRService (phân tích ảnh) và CloudinaryService (lưu media).
 */
class TicketService {
  constructor(ticketRepository, roomRepository, cloudinaryService, ocrService, contractRepository) {
    this.contractRepository = contractRepository;
    this.ticketRepository = ticketRepository;
    this.roomRepository = roomRepository;
    this.cloudinaryService = cloudinaryService;
    this.ocrService = ocrService;
  }

  /**
   * Upload ảnh/video sự cố lên Cloudinary, nếu là ảnh thì nhờ AI Vision (OCRService)
   * phân tích thiết bị hỏng, mức độ khẩn cấp để tự động điền biểu mẫu (Auto-fill).
   */
  async analyzeImage(fileBuffer, mimeType) {
    const isVideo = mimeType.startsWith('video/');
    const uploadResult = await this.cloudinaryService.uploadBuffer(fileBuffer, {
      folder: 'rental_management/tickets',
      resourceType: isVideo ? 'video' : 'image',
    });

    let analysis;
    if (isVideo) {
      analysis = {
        device_type: 'Chưa xác định (video)',
        issue_type: 'Cần xem thủ công',
        severity: 'MEDIUM',
        title: 'Sự cố báo cáo qua video',
        summary_vi: 'Video đã được lưu trữ, vui lòng xem trực tiếp để đánh giá vì AI Vision hiện chỉ hỗ trợ phân tích ảnh tĩnh.',
        is_safety_risk: false,
        immediate_actions: [],
        should_call_landlord_urgently: false,
      };
    } else {
      const base64 = fileBuffer.toString('base64');
      analysis = await this.ocrService.analyzeIssueImage(base64, mimeType);
    }

    return { image_url: uploadResult.secure_url, ...analysis };
  }

  async create(data) {
    const { room_id } = data;
    const title = data.title || 'Báo cáo sự cố';
    if (!room_id || !title) {
      const err = new Error('Thiếu Số phòng hoặc Tiêu đề sự cố.');
      err.status = 400;
      throw err;
    }
    const room = await this.roomRepository.findById(room_id);
    if (!room) { const e = new Error('Không tìm thấy phòng.'); e.status = 404; throw e; }

    const mine = await this.contractRepository.findAll({ tenant_id: data.tenant_id, status: 'ACTIVE' });
    if (!mine.some((c) => Number(c.room_id) === Number(room_id))) {
      const e = new Error('Bạn chỉ có thể báo sự cố cho phòng mình đang thuê.');
      e.status = 403;
      throw e;
    }

    return this.ticketRepository.create({
      room_id, tenant_id: data.tenant_id,
      title: String(title).slice(0, 255), description: data.description, image_url: data.image_url,
      severity: ['LOW', 'MEDIUM', 'HIGH'].includes(data.severity) ? data.severity : 'MEDIUM',
    });
  }

  async list(filters) {
    return this.ticketRepository.findAll(filters);
  }

  async listMine(tenantId) {
    return this.ticketRepository.findByTenant(tenantId);
  }

  /** Admin xử lý sự cố: đổi trạng thái và/hoặc ghi chú phản hồi. */
  async handle(id, { status, admin_note } = {}) {
    const t = await this.ticketRepository.findById(id);
    if (!t) { const e = new Error('Không tìm thấy ticket.'); e.status = 404; throw e; }
    const next = status === undefined ? t.status : status;
    if (!['PENDING', 'IN_PROGRESS', 'RESOLVED'].includes(next)) {
      const err = new Error('Trạng thái không hợp lệ.');
      err.status = 400;
      throw err;
    }
    let note = t.admin_note;
    if (admin_note !== undefined) {
      note = String(admin_note || '').trim().slice(0, 255) || null;
    }
    let resolved_at = t.resolved_at;
    if (next === 'RESOLVED' && t.status !== 'RESOLVED') resolved_at = nowInAppTz();
    if (next !== 'RESOLVED') resolved_at = null;
    await this.ticketRepository.updateHandling(id, { status: next, admin_note: note, resolved_at });
  }
}

module.exports = TicketService;
