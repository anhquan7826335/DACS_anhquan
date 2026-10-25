# Hệ thống Quản lý Nhà trọ & Tự động hóa Hóa đơn Thanh toán

Dự án gồm 2 phần độc lập:
- `backend/` — Node.js (Express) + MySQL
- `frontend/` — React (Vite) + TailwindCSS + Ant Design

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
- `GEMINI_API_KEY` hoặc `OPENAI_API_KEY` — ít nhất 1 trong 2, dùng cho tính năng AI Vision/OCR (đọc số tiền điện nước trên hóa đơn, phân tích ảnh sự cố). Ưu tiên Gemini nếu có cả 2.
- `APP_TIMEZONE` — múi giờ tính "hôm nay" (mặc định `Asia/Ho_Chi_Minh`)
- `CRON_SECRET`, `BANK_WEBHOOK_SECRET` — chuỗi bí mật tùy chọn để bảo vệ 2 endpoint hệ thống-tới-hệ thống

Tạo database và bảng:

```bash
mysql -u root -p < sql/schema.sql
```

Nếu database đã có dữ liệu cũ, **sao lưu trước** rồi chạy lần lượt 2 migration (idempotent, chạy lại không sao):

```bash
mysql -u root -p < sql/migrations/20261022_daily_rentals.sql   # thuê theo ngày: rental_type, daily_rate, ảnh phòng, bảng booking_requests
mysql -u root -p < sql/migrations/20261022_amount_billing.sql  # hóa đơn theo SỐ TIỀN: bỏ electricity_rate/water_rate/service_fee và các cột *_fee
```

Ảnh đại diện được lưu trên Cloudinary; tài khoản Cloudinary cần được cấu hình trong `CLOUDINARY_*`.

Tạo tài khoản Admin mặc định

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
├── sql/
│   ├── schema.sql              # schema MySQL đầy đủ
│   └── migrations/             # nâng cấp DB đã có dữ liệu (thuê ngày, hóa đơn theo số tiền)
├── src/
│   ├── config/db.js            # MySQL connection pool
│   ├── container.js            # ghép Repository -> Service -> Controller (DI thủ công)
│   ├── middleware/             # auth (JWT + role), upload (multer: media / avatar / ảnh phòng)
│   ├── routes/                 # khai báo REST endpoints
│   ├── controllers/            # nhận request, trả response
│   ├── services/               # nghiệp vụ (Booking, Contract, Invoice, Room, OCR, Payment, Reminder...)
│   ├── repositories/           # truy vấn SQL
│   ├── models/                 # entity
│   ├── utils/                  # date (múi giờ ứng dụng), httpError
│   ├── seed.js                 # tạo tài khoản Admin mặc định
│   ├── app.js                  # cấu hình Express + mount routes
│   └── server.js               # entry point
```

## 4. API đã triển khai đầy đủ

Đúng theo bản mô tả yêu cầu, cộng thêm vài endpoint hỗ trợ (đánh dấu *):

- **Auth**: `POST /api/auth/login`, `POST /api/auth/register`, `GET /api/auth/tenant-lookup*` (ADMIN tra cứu tenant khi tạo hợp đồng)
- **Rooms**: `GET /api/rooms`, `GET /api/rooms/:id*`, `POST /api/rooms`, `PUT /api/rooms/:id`, `DELETE /api/rooms/:id*`, `POST /api/rooms/:id/image*` (ảnh phòng)
- **Users***: `GET /api/users` (lọc `role`, `search`), `PUT /api/users/:id` (sửa hồ sơ / vai trò / đặt lại mật khẩu), `DELETE /api/users/:id`
- **Contracts**: `GET /api/contracts*` (admin, lọc `status`), `POST /api/contracts`, `GET /api/contracts/room/:roomId`, `GET /api/contracts/my*` (tenant xem hợp đồng của mình), `PUT /api/contracts/:id/terminate`
- **Bookings*** (thuê theo ngày): `POST /api/bookings` (khách gửi yêu cầu), `GET /api/bookings/my`, `PUT /api/bookings/:id/cancel`, `GET /api/bookings` (admin), `PUT /api/bookings/:id/approve`, `PUT /api/bookings/:id/reject`
- **Invoices**: `POST /api/invoices/scan-bill`, `POST /api/invoices`, `GET /api/invoices/admin`, `GET /api/invoices/tenant`, `PUT /api/invoices/:id*` (sửa), `DELETE /api/invoices/:id*`, `PUT /api/invoices/:id/pay`, `POST /api/invoices/trigger-reminders`, `POST /api/invoices/bank-webhook*` (Auto-Matching gạch nợ)
- **Tickets**: `POST /api/tickets/analyze-image`, `POST /api/tickets`, `GET /api/tickets`, `PUT /api/tickets/:id*` (cập nhật trạng thái xử lý)

## 5. Lưu ý triển khai thực tế

- **AI Vision**: nếu chưa cấu hình `GEMINI_API_KEY`/`OPENAI_API_KEY`, các endpoint `scan-bill` và `analyze-image` sẽ trả lỗi rõ ràng thay vì crash server.
- **Gửi thông báo nhắc nợ**: hiện tại `cron/reminder.cron.js` chỉ log ra console (`sendNotification`). Cần tích hợp kênh gửi thật (email/SMS/Zalo ZNS/push) tùy hạ tầng triển khai.
- **Webhook ngân hàng**: `bank-webhook` là điểm tích hợp mẫu, cần điều chỉnh theo định dạng payload thực tế của cổng thanh toán/ngân hàng bạn dùng (VD: SePay, Casso, MBBank...).
- **Video sự cố**: AI Vision hiện chỉ phân tích được ảnh tĩnh; với video cần trích khung hình đại diện trước khi gửi cho AI (chưa triển khai trong bản này).


## 6. Luồng thuê phòng theo ngày & hóa đơn theo số tiền

- Khách (TENANT) vào **Thuê phòng**: xem ảnh + giá phòng trống, chọn *ngày bắt đầu* và *số ngày* (tính cả ngày bắt đầu, vd 3 ngày từ 1/1 → 1/1–3/1) rồi gửi yêu cầu (`POST /api/bookings`). Đơn giá ngày = giá tháng / 30.
- Admin mở **Phòng trọ → bấm vào phòng Trống**: thấy các yêu cầu đang chờ, bấm **Duyệt** (tạo hợp đồng `DAILY`, phòng chuyển *Đang thuê*, các yêu cầu khác của phòng tự bị từ chối) hoặc **Từ chối** kèm ghi chú. Danh sách phòng hiện số yêu cầu chờ duyệt.
- Hợp đồng ngày hết hạn tự trả phòng về *Trống*; yêu cầu quá ngày bắt đầu mà chưa duyệt tự chuyển *Hết hạn*.
- Ảnh phòng: admin tải ở tạo phòng / chi tiết phòng (`POST /api/rooms/:id/image`, lưu Cloudinary).
- Hóa đơn: điện, nước, phụ phí đều nhập bằng **VNĐ** (không phải số công tơ). Tổng = tiền phòng + điện + nước + phụ phí. Hóa đơn của hợp đồng ngày tự tính `daily_rate × số ngày trong kỳ`.

## 7. Quản lý (sửa / xóa) và quy tắc an toàn

- Trang **Hóa đơn**: nút **Tạo hóa đơn** (chọn hợp đồng thuê tháng hoặc thuê ngày), mỗi dòng có **Sửa** / **Xóa**. Sửa hóa đơn tính lại tổng ở server; hóa đơn *Đã thanh toán* chỉ sửa số tiền được sau khi chuyển về *Chưa thanh toán*.
- Trang **Phòng trọ**: **Sửa** (số phòng không được trùng; trạng thái chỉ Trống/Bảo trì, phòng đang thuê phải thanh lý hợp đồng trước) và **Xóa** (không xóa phòng đang thuê hoặc phòng từng có hợp đồng).
- Trang **Người dùng** (mới): xem/tìm/lọc, sửa họ tên, email, sđt, vai trò, đặt lại mật khẩu; xóa người chưa có hợp đồng. Không tự xóa hay tự đổi vai trò của mình. Đổi tên/sđt được đồng bộ sang hợp đồng, hóa đơn, yêu cầu thuê, sự cố.
- Xác thực nay đối chiếu DB mỗi request: tài khoản bị xóa bị đăng xuất ngay, đổi vai trò có hiệu lực ngay (không chờ token hết hạn).

## Cập nhật schema thống nhất (v6)

- `backend/sql/schema.sql`: schema mới cho cài đặt MỚI (users / rooms / contracts / invoices / tickets / support_messages).
  - Yêu cầu thuê phòng (daily/monthly) và hợp đồng dùng chung bảng `contracts` (PENDING → ACTIVE → EXPIRED; REJECTED / CANCELLED).
  - Mỗi phòng chỉ có tối đa 1 hợp đồng ACTIVE (ràng buộc UNIQUE trong DB). Hóa đơn: mỗi hợp đồng 1 hóa đơn/kỳ; `total_amount` do DB tự tính; điện/nước chỉ lưu tiền.
- Nâng cấp DB cũ: **sao lưu trước**, rồi chạy lần lượt các file trong `backend/sql/migrations/` (xem README ở đó) — `20261024_unified_schema.sql` là bước cuối, có thể chạy lại an toàn.
- Endpoint mới: `/api/contracts/request|mine|:id/approve|reject|cancel`, `/api/reports/revenue[/export]`, `/api/invoices/tenant/export`, `/api/users/me`, `/api/users/:id/active`, `/api/tickets/my`. Đã bỏ `/api/bookings`.
- Báo cáo doanh thu: chọn khoảng thời gian, tính theo ngày thực thu (`basis=paid`) hoặc theo kỳ hóa đơn (`basis=period`), xem bảng/biểu đồ và xuất Excel.
