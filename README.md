# Student Accommodation / Rental Management System

## 🎯 Mục tiêu
Hệ thống quản lý nhà trọ và tự động hóa hóa đơn thanh toán, hướng đến:
- **Tự động hóa tối đa**: giảm thiểu nhập liệu thủ công cho chủ trọ và khách thuê.
- **UX tối giản**: thao tác nhanh, trực quan, ưu tiên hiển thị theo số phòng.
- **Hiệu năng cao**: sử dụng CSDL phi chuẩn hóa, tránh JOIN để tối ưu tốc độ API.

---

## 🏗️ Kiến trúc & Công nghệ
- **Mô hình**: Client - Server (Decoupled, RESTful APIs).
- **Frontend**: React (Vite) + TailwindCSS + Ant Design/Shadcn UI + axios.
  - Tích hợp `html2pdf.js` để xuất hợp đồng PDF.
- **Backend**: Node.js (Express) + cors, dotenv, JWT (jsonwebtoken), bcryptjs, mysql2/promise.
- **Database**: MySQL 8.0+ (5 bảng phi chuẩn hóa).
- **Third-party Services**:
  - VietQR API: Sinh QR thanh toán tự động.
  - Cloudinary API: Lưu trữ ảnh/video sự cố, hóa đơn điện nước.
  - Gemini / OpenAI API: AI Vision & OCR đọc chỉ số điện nước, phân tích sự cố.

---

## 🗄️ Thiết kế CSDL (Phi chuẩn hóa)
### 5 bảng chính
1. **users**: Quản lý tài khoản (Admin/Tenant).
2. **rooms**: Phòng trọ (room_number, status, tenant_name...).
3. **contracts**: Hợp đồng thuê (đơn giá cố định, thời hạn).
4. **invoices**: Hóa đơn (chỉ số điện/nước, QR thanh toán, nhắc nợ).
5. **tickets**: Báo cáo sự cố (ảnh/video, severity, status).

> Lưu ý: Dữ liệu dư thừa có kiểm soát (room_number, tenant_name...) để hiển thị trực tiếp, tránh JOIN.

---

## 🖥️ UX Spec
### Admin (Chủ trọ)
- Quản lý theo **room_number**.
- Chốt điện nước 3 cách:
  1. Nhập tay chỉ số.
  2. Chụp ảnh công tơ/hóa đơn.
  3. Upload file ảnh/PDF hóa đơn gốc.
- **AI/OCR** tự động đọc chỉ số từ ảnh/PDF.
- **Reminder Engine**:
  - Cronjob 08:00 AM hằng ngày.
  - Nhắc hạn trước 7d, 5d.
  - Nhắc quá hạn 3d, 5d, sau đó nhắc mỗi ngày cho đến khi PAID.
- **Auto-Matching**: Webhook ngân hàng tự động đổi trạng thái hóa đơn sang PAID.

### Tenant (Khách thuê)
- **Thanh toán 1-Click**: mở hóa đơn → bấm "Thanh toán ngay" → deep link sang App Ngân hàng.
- **Báo sự cố AI Vision**: chụp ảnh/video → AI phân tích thiết bị, mức độ khẩn cấp → tự điền biểu mẫu.

---

## 🔑 Business Logic
1. **Tạo hợp đồng mới**: Insert vào `contracts`, update `rooms`.
2. **Chốt số & tạo hóa đơn**: OCR đọc chỉ số, tính toán, sinh QR thanh toán.
3. **Reminder Engine**: Cronjob gửi nhắc hạn/nhắc nợ theo lịch.
4. **AI phân tích sự cố**: Upload Cloudinary → gọi Gemini/OpenAI Vision → lưu vào `tickets`.

---

## 📡 RESTful API
### Auth
- `POST /api/auth/login`
- `POST /api/auth/register`

### Rooms
- `GET /api/rooms`
- `POST /api/rooms`
- `PUT /api/rooms/:id`

### Contracts
- `POST /api/contracts`
- `GET /api/contracts/room/:roomId`
- `PUT /api/contracts/:id/terminate`

### Invoices
- `POST /api/invoices/scan-bill`
- `POST /api/invoices`
- `GET /api/invoices/admin`
- `GET /api/invoices/tenant`
- `PUT /api/invoices/:id/pay`
- `POST /api/invoices/trigger-reminders`

### Tickets
- `POST /api/tickets/analyze-image`
- `POST /api/tickets`
- `GET /api/tickets`

---

## 🚀 Roadmap Triển khai
1. **Database & Auth**: Tạo bảng MySQL, cấu hình Express + JWT.
2. **Core APIs**: CRUD cho Rooms, Contracts, Invoices, Tickets.
3. **Frontend Dashboard**: UI quản lý phòng, modal chốt điện nước, tích hợp VietQR.
4. **Reminder Engine & AI Vision**: Cronjob nhắc nợ, OCR hóa đơn, AI phân tích sự cố.
5. **Testing & Seed Data**: Kiểm thử luồng khép kín (Phòng → Hợp đồng → Hóa đơn → QR → Nhắc nợ → Thanh toán → Báo sự cố).

---

## 📌 Ghi chú cho Dev
- Ưu tiên hiển thị **room_number** trên giao diện.
- CSDL phi chuẩn hóa: chấp nhận dư thừa để tối ưu tốc độ.
- Cronjob & Webhook ngân hàng là thành phần quan trọng để tự động hóa.
