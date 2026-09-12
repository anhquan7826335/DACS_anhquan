const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth.routes');
const roomRoutes = require('./routes/room.routes');
const contractRoutes = require('./routes/contract.routes');
const invoiceRoutes = require('./routes/invoice.routes');
const ticketRoutes = require('./routes/ticket.routes');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/tickets', ticketRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: `Không tìm thấy route: ${req.method} ${req.originalUrl}` });
});

// Error handler tập trung (bắt lỗi multer: file quá lớn/sai định dạng, và lỗi ném từ controller qua next(err))
const { MulterError } = require('multer');
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (err instanceof MulterError || /không được hỗ trợ/.test(err.message || '')) {
    return res.status(400).json({ message: err.message });
  }
  res.status(err.status || 500).json({ message: err.message || 'Lỗi máy chủ không xác định.' });
});

module.exports = app;
