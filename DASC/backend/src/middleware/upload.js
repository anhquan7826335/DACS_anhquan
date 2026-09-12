const multer = require('multer');

// Lưu file tạm trong RAM (buffer) rồi đẩy thẳng lên Cloudinary, không ghi ra ổ đĩa server.
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // tối đa 20MB (đủ cho ảnh/PDF/video ngắn)
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf', 'video/mp4', 'video/quicktime'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Định dạng file không được hỗ trợ: ${file.mimetype}`));
    }
  },
});

module.exports = upload;
