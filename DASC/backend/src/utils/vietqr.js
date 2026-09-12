require('dotenv').config();

/**
 * Sinh URL ảnh QR VietQR (dùng dịch vụ ảnh QR tĩnh của VietQR - không cần API key):
 * https://img.vietqr.io/image/{BANK_CODE}-{ACCOUNT_NO}-{TEMPLATE}.png?amount=...&addInfo=...&accountName=...
 *
 * Nội dung chuyển khoản (addInfo) nên đặt theo mã định danh hóa đơn để hệ thống
 * Auto-Matching (webhook ngân hàng) có thể gạch nợ tự động, ví dụ: "SEV101" (SE + room_number)
 * hoặc "HD{invoiceId}".
 */
function buildVietQRUrl({ amount, addInfo }) {
  const bank = process.env.VIETQR_BANK_CODE;
  const account = process.env.VIETQR_ACCOUNT_NO;
  const accountName = process.env.VIETQR_ACCOUNT_NAME;
  const template = process.env.VIETQR_TEMPLATE || 'compact2';

  const params = new URLSearchParams({
    amount: String(Math.round(amount)),
    addInfo: addInfo,
    accountName: accountName || '',
  });

  return `https://img.vietqr.io/image/${bank}-${account}-${template}.png?${params.toString()}`;
}

/**
 * Sinh nội dung chuyển khoản định danh theo phòng, dùng cho webhook auto-matching.
 * Ví dụ: room_number = "P101" => "SEV P101" -> chuẩn hóa "SEVP101"
 */
function buildTransferContent(roomNumber, invoiceId) {
  return `SEV${roomNumber}${invoiceId}`.replace(/\s+/g, '').toUpperCase();
}

module.exports = { buildVietQRUrl, buildTransferContent };
