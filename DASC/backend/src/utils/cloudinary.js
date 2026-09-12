const cloudinary = require('cloudinary').v2;
require('dotenv').config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload buffer (ảnh/video sự cố, ảnh/PDF hóa đơn điện nước) lên Cloudinary.
 * resourceType: 'image' | 'video' | 'auto' (auto tự nhận diện, dùng cho PDF/ảnh lẫn lộn)
 */
function uploadBuffer(buffer, { folder = 'rental_management', resourceType = 'auto' } = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType },
      (error, result) => {
        if (error) return reject(error);
        resolve(result); // result.secure_url, result.public_id, ...
      }
    );
    stream.end(buffer);
  });
}

module.exports = { cloudinary, uploadBuffer };
