const cloudinary = require('cloudinary').v2;

/**
 * CloudinaryService — Service tích hợp bên thứ 3, quản lý việc upload/lưu trữ media
 * (ảnh/video sự cố, ảnh/PDF hóa đơn gốc). Đóng gói toàn bộ chi tiết SDK Cloudinary,
 * các Controller/Service khác chỉ cần gọi uploadBuffer() mà không cần biết implementation.
 */
class CloudinaryService {
  constructor({ cloudName, apiKey, apiSecret }) {
    cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
    this.client = cloudinary;
  }

  /**
   * Upload buffer (ảnh/video/PDF) lên Cloudinary, trả về { secure_url, public_id, ... }.
   */
  uploadBuffer(buffer, { folder = 'rental_management', resourceType = 'auto' } = {}) {
    return new Promise((resolve, reject) => {
      const stream = this.client.uploader.upload_stream(
        { folder, resource_type: resourceType },
        (error, result) => (error ? reject(error) : resolve(result))
      );
      stream.end(buffer);
    });
  }
}

module.exports = CloudinaryService;
