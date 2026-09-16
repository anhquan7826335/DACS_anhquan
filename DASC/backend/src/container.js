require('dotenv').config();
const { pool, testConnection } = require('./config/db');

// ---- Repositories (Data Access Layer) ----
const UserRepository = require('./repositories/UserRepository');
const RoomRepository = require('./repositories/RoomRepository');
const ContractRepository = require('./repositories/ContractRepository');
const InvoiceRepository = require('./repositories/InvoiceRepository');
const TicketRepository = require('./repositories/TicketRepository');

// ---- Integration Services ----
const OCRService = require('./services/OCRService');
const CloudinaryService = require('./services/CloudinaryService');
const PaymentService = require('./services/PaymentService');
const ReminderEngine = require('./services/ReminderEngine');

// ---- Business Services ----
const AuthService = require('./services/AuthService');
const RoomService = require('./services/RoomService');
const ContractService = require('./services/ContractService');
const InvoiceService = require('./services/InvoiceService');
const TicketService = require('./services/TicketService');

// ---- Controllers ----
const AuthController = require('./controllers/AuthController');
const RoomController = require('./controllers/RoomController');
const ContractController = require('./controllers/ContractController');
const InvoiceController = require('./controllers/InvoiceController');
const TicketController = require('./controllers/TicketController');

/**
 * Container — "Composition Root" của toàn ứng dụng: nơi duy nhất khởi tạo
 * và ghép nối (dependency injection thủ công) mọi Repository -> Service -> Controller.
 * Routes chỉ import controller đã được ghép sẵn từ đây, không tự `new` bất cứ đâu khác.
 */
const userRepository = new UserRepository(pool);
const roomRepository = new RoomRepository(pool);
const contractRepository = new ContractRepository(pool);
const invoiceRepository = new InvoiceRepository(pool);
const ticketRepository = new TicketRepository(pool);

const ocrService = new OCRService({
  geminiApiKey: process.env.GEMINI_API_KEY,
  openaiApiKey: process.env.OPENAI_API_KEY,
});

const cloudinaryService = new CloudinaryService({
  cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  apiKey: process.env.CLOUDINARY_API_KEY,
  apiSecret: process.env.CLOUDINARY_API_SECRET,
});

const paymentService = new PaymentService(
  {
    bankCode: process.env.VIETQR_BANK_CODE,
    accountNo: process.env.VIETQR_ACCOUNT_NO,
    accountName: process.env.VIETQR_ACCOUNT_NAME,
    template: process.env.VIETQR_TEMPLATE,
  },
  invoiceRepository
);

const reminderEngine = new ReminderEngine(invoiceRepository);

const authService = new AuthService(userRepository, {
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN,
});
const roomService = new RoomService(roomRepository);
const contractService = new ContractService(contractRepository, roomRepository, userRepository);
const invoiceService = new InvoiceService(
  invoiceRepository, contractRepository, roomRepository, cloudinaryService, ocrService, paymentService
);
const ticketService = new TicketService(ticketRepository, roomRepository, cloudinaryService, ocrService);

const authController = new AuthController(authService);
const roomController = new RoomController(roomService);
const contractController = new ContractController(contractService);
const invoiceController = new InvoiceController(
  invoiceService, reminderEngine, process.env.CRON_SECRET, process.env.BANK_WEBHOOK_SECRET
);
const ticketController = new TicketController(ticketService);

module.exports = {
  pool,
  testConnection,
  reminderEngine,
  controllers: { authController, roomController, contractController, invoiceController, ticketController },
};
