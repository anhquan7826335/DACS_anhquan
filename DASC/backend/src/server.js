const app = require('./app');
const { testConnection } = require('./config/db');
const { scheduleReminderCron } = require('./cron/reminder.cron');
require('dotenv').config();

const PORT = process.env.PORT || 5000;

(async () => {
  await testConnection();
  scheduleReminderCron();

  app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
    console.log(`   Health check: http://localhost:${PORT}/api/health`);
  });
})();
