class SupportService {
  constructor(supportRepository, ocrService) {
    this.supportRepository = supportRepository;
    this.ocrService = ocrService;
  }

  async history(userId) {
    return this.supportRepository.findRecentByUser(userId);
  }

  async ask(user, question) {
    const normalizedQuestion = String(question || '').trim();
    if (!normalizedQuestion) {
      const error = new Error('Vui lòng nhập câu hỏi.');
      error.status = 400;
      throw error;
    }
    if (normalizedQuestion.length > 2000) {
      const error = new Error('Câu hỏi không được dài quá 2.000 ký tự.');
      error.status = 400;
      throw error;
    }

    const history = await this.supportRepository.findRecentByUser(user.id);
    const answer = await this.ocrService.askAssistant(normalizedQuestion, history, {
      full_name: user.full_name,
      role: user.role,
    });
    const id = await this.supportRepository.create({
      user_id: user.id,
      question: normalizedQuestion,
      answer,
    });
    return { id, question: normalizedQuestion, answer, created_at: new Date().toISOString() };
  }
}

module.exports = SupportService;