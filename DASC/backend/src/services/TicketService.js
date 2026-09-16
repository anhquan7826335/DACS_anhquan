/**
 * TicketService — business logic cho module Báo cáo sự cố.
 * Điều phối OCRService (phân tích ảnh) và CloudinaryService (lưu media).
 */
class TicketService {
  constructor(ticketRepository, roomRepository, cloudinaryService, ocrService) {
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
      };
    } else {
      const base64 = fileBuffer.toString('base64');
      analysis = await this.ocrService.analyzeIssueImage(base64, mimeType);
    }

    return { image_url: uploadResult.secure_url, ...analysis };
  }

  async create(data) {
    const { room_id, title } = data;
    if (!room_id || !title) {
      const err = new Error('Thiếu Số phòng hoặc Tiêu đề sự cố.');
      err.status = 400;
      throw err;
    }
    const room = await this.roomRepository.findById(room_id);
    if (!room) { const e = new Error('Không tìm thấy phòng.'); e.status = 404; throw e; }

    return this.ticketRepository.create({
      room_id, tenant_id: data.tenant_id, room_number: room.room_number, tenant_name: data.tenant_name,
      title, description: data.description, image_url: data.image_url, severity: data.severity,
    });
  }

  async list(filters) {
    return this.ticketRepository.findAll(filters);
  }

  async updateStatus(id, status) {
    if (!['PENDING', 'IN_PROGRESS', 'RESOLVED'].includes(status)) {
      const err = new Error('Trạng thái không hợp lệ.');
      err.status = 400;
      throw err;
    }
    const affected = await this.ticketRepository.updateStatus(id, status);
    if (affected === 0) { const e = new Error('Không tìm thấy ticket.'); e.status = 404; throw e; }
  }
}

module.exports = TicketService;
