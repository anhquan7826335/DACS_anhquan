# Hệ thống Quản lý Nhà trọ & Tự động hóa Hóa đơn Thanh toán

## 🎯 Mục tiêu
Hệ thống quản lý nhà trọ và tự động hóa hóa đơn thanh toán, hướng đến:
- **Tự động hóa tối đa**: giảm nhập liệu thủ công cho chủ trọ và khách thuê (AI đọc hóa đơn, QR thanh toán, gạch nợ tự động, nhắc nợ theo lịch).
- **UX tối giản**: thao tác nhanh, trực quan, ưu tiên hiển thị theo số phòng.
- **Dữ liệu toàn vẹn**: CSDL chuẩn hóa, ràng buộc ngay trong DB (khóa ngoại, CHECK, UNIQUE, cột tự tính) để không thể sinh dữ liệu sai.

---

## 🏗️ Kiến trúc & Công nghệ
- **Mô hình**: Client - Server (tách rời, RESTful API).
- **Frontend** (`frontend/`): React (Vite) + Ant Design + TailwindCSS + axios + Recharts (biểu đồ doanh thu).
- **Backend** (`backend/`): Node.js (Express) theo tầng *Routes → Controllers → Services → Repositories → Models*, ghép thành phần thủ công ở `container.js` (Dependency Injection).
  - Thư viện: cors, dotenv, jsonwebtoken, bcryptjs, mysql2/promise, multer, node-cron, exceljs.
- **Database**: MySQL 8.0+ (chuẩn hóa, 6 bảng).
- **Third-party Services**:
  - VietQR: sinh QR thanh toán cho từng hóa đơn.
  - Cloudinary: lưu ảnh phòng, ảnh đại diện, ảnh/video sự cố, file hóa đơn gốc.
  - Gemini / OpenAI: AI Vision/OCR đọc số tiền trên hóa đơn điện nước, phân tích ảnh sự cố, trợ lý hỗ trợ.

---

## 🗄️ Thiết kế CSDL
### 6 bảng
1. **users**: tài khoản Admin/Tenant (`role`, `is_active` để khóa tài khoản).
2. **rooms**: phòng trọ (`room_number`, `floor`, `monthly_price`, `daily_price` tùy chọn, `status`).
3. **contracts**: hợp đồng **và** yêu cầu thuê phòng, dùng chung một bảng.
   - `rental_type`: `MONTHLY` | `DAILY`.
   - `status`: `PENDING` (chờ duyệt) → `ACTIVE` → `EXPIRED`; hoặc `REJECTED` / `CANCELLED`.
   - Mỗi phòng chỉ có **tối đa 1 hợp đồng ACTIVE** (cột sinh `active_room_id` + UNIQUE).
4. **invoices**: hóa đơn theo hợp đồng và kỳ (tháng/năm).
   - Điện, nước, phụ phí đều là **số tiền (VNĐ)**, không lưu chỉ số công tơ.
   - `total_amount` là cột **tự tính** = tiền phòng + điện + nước + phụ phí.
   - Mỗi hợp đồng chỉ có **1 hóa đơn cho mỗi kỳ**; có `paid_at`, `payment_method`, `transaction_ref` (chống gạch nợ trùng).
5. **tickets**: báo cáo sự cố (ảnh/video, `severity`, `status`, `admin_note`, `resolved_at`).
6. **support_messages**: lịch sử hội thoại với trợ lý hỗ trợ.

> Tên khách, số phòng, số điện thoại **không** được sao chép sang bảng khác mà lấy qua JOIN, nên đổi hồ sơ là cập nhật ở mọi nơi.

---

## 🖥️ Chức năng
### Admin (Chủ trọ)
- Đăng ký/đăng nhập, phân quyền theo vai trò, xem và cập nhật thông tin cá nhân, đổi mật khẩu, ảnh đại diện.
- **Phòng trọ**: thêm / sửa / xóa, ảnh phòng, giá tháng và giá thuê ngày (để trống = giá tháng / 30).
- **Hợp đồng**: tạo trực tiếp (thuê tháng hoặc ngày), **duyệt / từ chối** yêu cầu thuê của khách (nhập tiền cọc khi duyệt), sửa, thanh lý, xóa.
- **Hóa đơn**: tạo (nhập tay hoặc quét ảnh/PDF hóa đơn gốc bằng AI), sửa, xóa, đánh dấu đã thanh toán.
- **Tài khoản**: tìm/lọc, sửa hồ sơ/vai trò, đặt lại mật khẩu, **khóa/mở khóa**, xóa.
- **Sự cố**: xem theo mức độ/trạng thái, cập nhật trạng thái, ghi chú phản hồi cho khách.
- **Doanh thu**: chọn khoảng thời gian, xem bằng **bảng** hoặc **biểu đồ** (cột/đường), theo tháng hoặc ngày, theo phòng; xuất **Excel**.
  - `basis=paid`: tính theo **ngày thực thu** (`paid_at`).
  - `basis=period`: tính theo **kỳ hóa đơn** (phát sinh), kèm số chưa thu.
- **Reminder Engine**: cron 08:00 hằng ngày, nhắc trước hạn 7 ngày và 5 ngày; quá hạn 3 ngày, 5 ngày, sau đó mỗi ngày đến khi PAID.
- **Auto-Matching**: webhook ngân hàng đối soát nội dung chuyển khoản và tự đổi hóa đơn sang PAID.

### Tenant (Khách thuê)
- Đăng ký/đăng nhập, xem và cập nhật thông tin cá nhân (họ tên, email, số điện thoại).
- Xem **phòng trống** và gửi yêu cầu thuê **theo ngày** (1–365 ngày) hoặc **theo tháng** (1–36 tháng); theo dõi/hủy yêu cầu ở mục *Hợp đồng của tôi*.
- Xem hóa đơn và hợp đồng của bản thân; **thanh toán 1-click** bằng QR VietQR.
- **Xuất file hóa đơn (.xlsx)** theo khoảng tháng tự chọn.
- **Báo sự cố bằng AI Vision**: chụp ảnh/video → AI phân tích thiết bị, mức độ khẩn cấp → tự điền biểu mẫu; chỉ báo được cho phòng mình đang thuê.

---

## 🔑 Quy tắc nghiệp vụ
1. **Thuê phòng**: khách gửi yêu cầu (`PENDING`) → admin duyệt (`ACTIVE`, phòng sang *Đang thuê*, các yêu cầu khác của phòng tự bị từ chối) hoặc từ chối. Các thao tác này chạy trong transaction có khóa dòng để tránh hai người cùng duyệt một phòng.
2. **Tự dọn trạng thái**: hợp đồng thuê ngày quá hạn → `EXPIRED`, phòng về *Trống*; yêu cầu quá ngày bắt đầu mà chưa duyệt → `EXPIRED`.
3. **Tạo hóa đơn**: hợp đồng tháng lấy `monthly_fee`, điện/nước/phụ phí nhập bằng VNĐ; hợp đồng ngày tự tính `daily_fee × số ngày trong kỳ`. Kỳ phải nằm trong thời gian thuê; trùng kỳ → báo lỗi 409.
4. **Thanh toán**: hóa đơn PAID ghi `paid_at` và phương thức; chuyển về UNPAID thì xóa các thông tin này. Webhook ngân hàng ghi `transaction_ref` duy nhất để không gạch nợ hai lần.
5. **Quy tắc xóa**: không xóa phòng đang thuê hoặc từng có hợp đồng; không xóa hợp đồng đã có hóa đơn (hãy thanh lý); không xóa người đã có hợp đồng (hãy khóa tài khoản).
6. **Xác thực**: JWT, mỗi request đối chiếu DB nên tài khoản bị xóa/khóa mất hiệu lực ngay, đổi vai trò có hiệu lực ngay.

---

## 📡 RESTful API
Dấu `*` = chỉ Admin; `†` = chỉ Tenant; không dấu = đăng nhập là dùng được.

### Auth
- `POST /api/auth/login`, `POST /api/auth/register`, `POST /api/auth/logout`
- `POST /api/auth/change-password`, `PUT /api/auth/avatar`
- `GET /api/auth/tenant-lookup` *

### Users
- `GET /api/users/me`, `PUT /api/users/me` (xem / sửa thông tin cá nhân)
- `GET /api/users` *, `PUT /api/users/:id` *, `PUT /api/users/:id/active` * (khóa/mở khóa), `DELETE /api/users/:id` *

### Rooms
- `GET /api/rooms`, `GET /api/rooms/:id` (khách chỉ thấy phòng trống)
- `POST /api/rooms` *, `PUT /api/rooms/:id` *, `DELETE /api/rooms/:id` *, `POST /api/rooms/:id/image` *

### Contracts
- `POST /api/contracts` *, `GET /api/contracts` * (lọc `status`, `rental_type`, `room_id`, `tenant_id`)
- `GET /api/contracts/room/:roomId` *
- `PUT /api/contracts/:id` *, `DELETE /api/contracts/:id` *
- `PUT /api/contracts/:id/approve` *, `PUT /api/contracts/:id/reject` *, `PUT /api/contracts/:id/terminate` *
- `POST /api/contracts/request` †, `GET /api/contracts/mine` †, `GET /api/contracts/my` † (hợp đồng đang hiệu lực), `PUT /api/contracts/:id/cancel` †

### Invoices
- `POST /api/invoices/scan-bill` *, `POST /api/invoices` *, `GET /api/invoices/admin` *
- `PUT /api/invoices/:id` *, `DELETE /api/invoices/:id` *, `PUT /api/invoices/:id/pay` *
- `GET /api/invoices/tenant` † (lọc `from`, `to` dạng `YYYY-MM`), `GET /api/invoices/tenant/export` † (Excel)
- `POST /api/invoices/trigger-reminders` (header `x-cron-secret`), `POST /api/invoices/bank-webhook` (header `x-webhook-secret`)

### Reports
- `GET /api/reports/revenue` * (`from`, `to`, `basis=paid|period`, `group=day|month`)
- `GET /api/reports/revenue/export` * (Excel)

### Tickets
- `POST /api/tickets/analyze-image`, `POST /api/tickets` †, `GET /api/tickets/my` †
- `GET /api/tickets` *, `PUT /api/tickets/:id` * (`status`, `admin_note`)

### Support
- `GET /api/support`, `POST /api/support` (trợ lý hỗ trợ AI)

---

## ⚙️ Cài đặt

### 1. Backend
```bash
cd backend
npm install
cp .env.example .env
```


**Cài mới** — tạo database rồi nạp schema:
```bash
mysql -u root -p --default-character-set=utf8mb4 <ten_database> < sql/schema.sql
```


Tạo tài khoản Admin mặc định
```bash
npm run seed
```

Chạy server:
```bash
npm run dev     # dev, tự reload
npm start       # production
```
Server chạy tại `http://localhost:5000`; kiểm tra `GET /api/health`.

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```
Chạy tại `http://localhost:5173`, proxy `/api/*` → `http://localhost:5000` (xem `vite.config.js`). Đăng nhập bằng Admin đã seed, hoặc đăng ký tài khoản Khách thuê.

---

## 📁 Cấu trúc Backend
```
backend/
├── sql/
│   ├── schema.sql              # schema đầy đủ cho cài mới
│   └── migrations/             # nâng cấp DB đã có dữ liệu
└── src/
    ├── config/db.js            # MySQL connection pool
    ├── container.js            # ghép Repository → Service → Controller
    ├── middleware/             # auth (JWT + role + khóa tài khoản), upload (multer)
    ├── routes/                 # khai báo REST endpoints
    ├── controllers/            # nhận request, trả response
    ├── services/               # nghiệp vụ: Contract, Invoice, Room, User, Report, OCR, Payment, Reminder...
    ├── repositories/           # truy vấn SQL
    ├── models/                 # entity
    ├── utils/                  # date (múi giờ ứng dụng), httpError, validators
    ├── seed.js                 # tạo Admin mặc định
    ├── app.js                  # cấu hình Express + mount routes
    └── server.js               # entry point
```

---

## 🚀 Roadmap Triển khai
1. **Database & Auth**: bảng MySQL, Express + JWT, phân quyền.
2. **Core APIs**: CRUD Rooms, Contracts (kèm yêu cầu thuê), Invoices, Tickets, Users.
3. **Frontend**: dashboard Admin, trang thuê phòng và hóa đơn cho Tenant, QR VietQR.
4. **Tự động hóa & AI**: Reminder Engine, webhook gạch nợ, OCR hóa đơn, AI phân tích sự cố.
5. **Báo cáo**: doanh thu theo khoảng thời gian (bảng/biểu đồ), xuất Excel.
6. **Kiểm thử**: luồng khép kín *Phòng → Yêu cầu thuê → Duyệt → Hóa đơn → QR → Thanh toán → Báo cáo → Báo sự cố*.

---

## 📌 Lưu ý triển khai
- **AI Vision**: nếu chưa cấu hình API key, `scan-bill` và `analyze-image` trả lỗi rõ ràng, không làm sập server. Với video sự cố, AI hiện chưa phân tích (chỉ lưu).
- **Nhắc nợ**: hiện chỉ ghi log ra console; cần nối kênh gửi thật (email/SMS/Zalo) khi triển khai.
- **Webhook ngân hàng**: là điểm tích hợp mẫu; chỉnh theo định dạng payload thực tế của cổng bạn dùng (SePay, Casso...). Payload có `transaction_ref` thì hệ thống chống ghi nhận trùng.
- **Múi giờ**: ngày "hôm nay", hạn hợp đồng ngày và `paid_at` tính theo `APP_TIMEZONE`.