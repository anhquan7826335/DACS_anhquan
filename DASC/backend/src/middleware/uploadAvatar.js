const multer = require('multer');

const uploadAvatar = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      const err = new Error('Ảnh đại diện chỉ hỗ trợ định dạng JPG, PNG hoặc WEBP.');
      err.status = 400;
      return callback(err);
    }
    callback(null, true);
  },
});

module.exports = uploadAvatar;
