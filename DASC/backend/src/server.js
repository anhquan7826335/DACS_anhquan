const app = require('./app');
const { testConnection, reminderEngine } = require('./container');
require('dotenv').config();

const PORT = process.env.PORT || 5000;

(async () => {
  await testConnection();

  if (process.env.ENABLE_REMINDER_CRON === 'true') {
    reminderEngine.schedule(process.env.REMINDER_CRON_TIME || '0 8 * * *');
  } else {
    console.log('⏸️  ReminderEngine đang TẮT (ENABLE_REMINDER_CRON != true).');
  }

  app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
    console.log(`   Health check: http://localhost:${PORT}/api/health`);
  });
})();
