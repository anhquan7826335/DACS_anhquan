import dayjs from 'dayjs';

/** 1234567 -> "1.234.567 đ" */
export const vnd = (value) => `${Number(value || 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} đ`;

/** "2026-01-01" -> "01/01/2026" */
export const fmtDate = (value) => (value ? dayjs(value).format('DD/MM/YYYY') : '-');

/** Công thức đơn giá thuê ngày giống backend: giá tháng / 30, làm tròn 2 chữ số. */
export const dailyRateOf = (monthlyPrice) => Math.round((Number(monthlyPrice) / 30) * 100) / 100;

/** Props cho InputNumber nhập tiền VNĐ: hiển thị 1,234,567 */
export const moneyInputProps = {
  min: 0,
  precision: 0,
  style: { width: '100%' },
  formatter: (v) => `${v ?? ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, ','),
  parser: (v) => (v ? v.replace(/[^\d]/g, '') : ''),
};

/** Trạng thái hợp đồng / yêu cầu thuê (bảng contracts). */
export const contractStatus = {
  PENDING: { color: 'gold', label: 'Chờ duyệt' },
  ACTIVE: { color: 'green', label: 'Đang hiệu lực' },
  EXPIRED: { color: 'default', label: 'Đã kết thúc' },
  REJECTED: { color: 'red', label: 'Bị từ chối' },
  CANCELLED: { color: 'default', label: 'Đã hủy' },
};

export const rentalTypeLabel = { MONTHLY: 'Theo tháng', DAILY: 'Theo ngày' };

/** Tải file nhị phân (xlsx) từ API qua axios rồi lưu về máy. */
export async function downloadFile(api, url, params, fallbackName) {
  const res = await api.get(url, { params, responseType: 'blob' });
  const cd = res.headers['content-disposition'] || '';
  const name = /filename="?([^";]+)"?/.exec(cd)?.[1] || fallbackName;
  const href = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}
