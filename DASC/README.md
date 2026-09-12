# Hệ thống Quản lý Nhà trọ & Tự động hóa Hóa đơn Thanh toán

Dự án gồm 2 phần độc lập:
- `backend/` — Node.js (Express) + MySQL
- `frontend/` — React (Vite) + TailwindCSS + Ant Design

Đã được test end-to-end thực tế (login → tạo phòng → tạo hợp đồng → tạo hóa
đơn → sinh VietQR → webhook ngân hàng tự gạch nợ → báo sự cố) trên MySQL/MariaDB thật.

## 1. Cài đặt Backend

```bash
cd backend
npm install
cp .env.example .env
```

Sửa file `.env`:
- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` — thông tin MySQL của bạn
- `JWT_SECRET` — chuỗi bí mật bất kỳ, càng dài càng tốt
- `VIETQR_*` — thông tin tài khoản ngân hàng nhận tiền (không cần API key, dùng dịch vụ ảnh QR tĩnh của VietQR)
- `CLOUDINARY_*` — lấy từ dashboard Cloudinary (dùng lưu ảnh/PDF hóa đơn, ảnh/video sự cố)
- `GEMINI_API_KEY` hoặc `OPENAI_API_KEY` — ít nhất 1 trong 2, dùng cho tính năng AI Vision/OCR (đọc chỉ số điện nước, phân tích ảnh sự cố). Ưu tiên Gemini nếu có cả 2.
- `CRON_SECRET`, `BANK_WEBHOOK_SECRET` — chuỗi bí mật tùy chọn để bảo vệ 2 endpoint hệ thống-tới-hệ thống

Tạo database và bảng:

```bash
mysql -u root -p < sql/schema.sql
```

Tạo tài khoản Admin mặc định (email: `admin@nhatro.local`, mật khẩu: `Admin@123`):

```bash
npm run seed
```

Chạy server:

```bash
npm run dev     # dev, tự reload khi sửa code
# hoặc
npm start       # production
```

Server chạy tại `http://localhost:5000`, kiểm tra: `GET http://localhost:5000/api/health`.

## 2. Cài đặt Frontend

```bash
cd frontend
npm install
npm run dev
```

Mặc định chạy tại `http://localhost:5173`, đã cấu hình proxy `/api/*` → `http://localhost:5000` (xem `vite.config.js`).

Đăng nhập bằng tài khoản Admin đã seed ở trên, hoặc bấm "Khách thuê đăng ký" để tạo tài khoản Tenant.

## 3. Cấu trúc thư mục Backend

```
backend/
├── sql/schema.sql              # 5 bảng phi chuẩn hóa
├── src/
│   ├── config/db.js            # MySQL connection pool
│   ├── middleware/
│   │   ├── auth.js             # JWT authenticate + authorize theo role
│   │   └── upload.js           # multer (memory storage cho Cloudinary)
│   ├── utils/
│   │   ├── vietqr.js           # sinh URL ảnh QR VietQR + nội dung định danh
│   │   ├── cloudinary.js       # upload ảnh/PDF/video
│   │   └── ai.js               # gọi Gemini/OpenAI Vision, OCR & phân tích sự cố
│   ├── controllers/            # logic nghiệp vụ cho từng module
│   ├── routes/                 # khai báo REST endpoints
│   ├── cron/reminder.cron.js   # Auto-Reminder Engine (chạy 08:00 hàng ngày)
│   ├── seed.js                 # tạo tài khoản Admin mặc định
│   ├── app.js                  # cấu hình Express + mount routes
│   └── server.js               # entry point
```

## 4. API đã triển khai đầy đủ

Đúng theo bản mô tả yêu cầu, cộng thêm vài endpoint hỗ trợ (đánh dấu *):

- **Auth**: `POST /api/auth/login`, `POST /api/auth/register`, `GET /api/auth/tenant-lookup*` (ADMIN tra cứu tenant khi tạo hợp đồng)
- **Rooms**: `GET /api/rooms`, `GET /api/rooms/:id*`, `POST /api/rooms`, `PUT /api/rooms/:id`
- **Contracts**: `POST /api/contracts`, `GET /api/contracts/room/:roomId`, `GET /api/contracts/my*` (tenant xem hợp đồng của mình), `PUT /api/contracts/:id/terminate`
- **Invoices**: `POST /api/invoices/scan-bill`, `POST /api/invoices`, `GET /api/invoices/admin`, `GET /api/invoices/tenant`, `PUT /api/invoices/:id/pay`, `POST /api/invoices/trigger-reminders`, `POST /api/invoices/bank-webhook*` (Auto-Matching gạch nợ)
- **Tickets**: `POST /api/tickets/analyze-image`, `POST /api/tickets`, `GET /api/tickets`, `PUT /api/tickets/:id*` (cập nhật trạng thái xử lý)

## 5. Lưu ý triển khai thực tế

- **AI Vision**: nếu chưa cấu hình `GEMINI_API_KEY`/`OPENAI_API_KEY`, các endpoint `scan-bill` và `analyze-image` sẽ trả lỗi rõ ràng thay vì crash server.
- **Gửi thông báo nhắc nợ**: hiện tại `cron/reminder.cron.js` chỉ log ra console (`sendNotification`). Cần tích hợp kênh gửi thật (email/SMS/Zalo ZNS/push) tùy hạ tầng triển khai.
- **Webhook ngân hàng**: `bank-webhook` là điểm tích hợp mẫu, cần điều chỉnh theo định dạng payload thực tế của cổng thanh toán/ngân hàng bạn dùng (VD: SePay, Casso, MBBank...).
- **Video sự cố**: AI Vision hiện chỉ phân tích được ảnh tĩnh; với video cần trích khung hình đại diện trước khi gửi cho AI (chưa triển khai trong bản này).
