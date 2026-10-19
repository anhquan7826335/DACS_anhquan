const BaseRepository = require('./BaseRepository');

class SupportRepository extends BaseRepository {
  async create({ user_id, question, answer }) {
    const result = await this.query(
      'INSERT INTO support_messages (user_id, question, answer) VALUES (?, ?, ?)',
      [user_id, question, answer]
    );
    return result.insertId;
  }

  async findRecentByUser(userId, limit = 20) {
    const rows = await this.query(
      'SELECT id, question, answer, created_at FROM support_messages WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?',
      [userId, limit]
    );
    return rows.reverse();
  }
}

module.exports = SupportRepository;