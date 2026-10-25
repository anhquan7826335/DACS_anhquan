const multer = require('multer');

// Ảnh phòng: lưu tạm trong RAM rồi đẩy lên Cloudinary. Tối đa 5MB, chỉ JPG/PNG/WEBP.
const uploadRoomImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      const err = new Error('Ảnh phòng chỉ hỗ trợ định dạng JPG, PNG hoặc WEBP.');
      err.status = 400;
      return callback(err);
    }
    callback(null, true);
  },
});

module.exports = uploadRoomImage;
