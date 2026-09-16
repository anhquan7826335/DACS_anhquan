const axios = require('axios');

/**
 * OCRService — Service tích hợp Gemini / OpenAI Vision API.
 * Ưu tiên Gemini nếu có GEMINI_API_KEY, fallback sang OpenAI nếu có OPENAI_API_KEY.
 * Dùng cho 2 use-case: (1) đọc chỉ số điện/nước từ ảnh/PDF, (2) phân tích ảnh/video sự cố kỹ thuật.
 */
class OCRService {
  constructor({ geminiApiKey, openaiApiKey } = {}) {
    this.geminiApiKey = geminiApiKey;
    this.openaiApiKey = openaiApiKey;
  }

  getProvider() {
    if (this.geminiApiKey) return 'gemini';
    if (this.openaiApiKey) return 'openai';
    return null;
  }

  /**
   * Gọi model Vision, ép trả JSON thuần.
   * @private
   */
  async _callVisionJSON(imageBase64, mimeType, prompt) {
    const provider = this.getProvider();
    if (!provider) {
      throw new Error('Chưa cấu hình GEMINI_API_KEY hoặc OPENAI_API_KEY — không thể gọi OCRService.');
    }

    const fullPrompt = `${prompt}\nCHỈ trả về một JSON object hợp lệ, không kèm markdown, không có lời giải thích, không có dấu backtick.`;

    if (provider === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.geminiApiKey}`;
      const { data } = await axios.post(url, {
        contents: [{ parts: [{ text: fullPrompt }, { inline_data: { mime_type: mimeType, data: imageBase64 } }] }],
        generationConfig: { response_mime_type: 'application/json' },
      });
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      return this._safeParseJSON(text);
    }

    const { data } = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: fullPrompt },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
          ],
        }],
      },
      { headers: { Authorization: `Bearer ${this.openaiApiKey}` } }
    );
    const text = data.choices?.[0]?.message?.content || '{}';
    return this._safeParseJSON(text);
  }

  /** @private */
  _safeParseJSON(text) {
    try {
      return JSON.parse(text.replace(/```json|```/g, '').trim());
    } catch {
      throw new Error('AI trả về dữ liệu không đúng định dạng JSON: ' + text.slice(0, 200));
    }
  }

  /**
   * Bóc tách chỉ số điện/nước từ ảnh công tơ hoặc ảnh/PDF hóa đơn gốc.
   */
  async extractMeterReading(imageBase64, mimeType) {
    const prompt = `Bạn là hệ thống OCR đọc chỉ số công tơ điện/nước hoặc hóa đơn điện nước tại Việt Nam.
Hãy đọc ảnh/tài liệu được đính kèm và trả về JSON theo đúng schema sau:
{
  "new_electricity": number hoặc null,
  "new_water": number hoặc null,
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "raw_text": "toàn bộ text nhận diện được từ ảnh, để chủ trọ đối chiếu thủ công nếu cần"
}
Nếu ảnh chỉ có 1 trong 2 chỉ số, để giá trị còn lại là null.`;
    return this._callVisionJSON(imageBase64, mimeType, prompt);
  }

  /**
   * Phân tích ảnh sự cố do khách thuê báo cáo -> trả về device_type, severity, mô tả gợi ý.
   */
  async analyzeIssueImage(imageBase64, mimeType) {
    const prompt = `Bạn là kỹ thuật viên bảo trì nhà trọ giàu kinh nghiệm tại Việt Nam.
Hãy phân tích ảnh sự cố thiết bị/hạ tầng và trả về JSON theo schema:
{
  "device_type": "loại thiết bị/hạng mục bị hỏng",
  "issue_type": "mô tả ngắn gọn loại sự cố",
  "severity": "LOW" hoặc "MEDIUM" hoặc "HIGH",
  "title": "tiêu đề ngắn gọn cho ticket, dưới 60 ký tự",
  "summary_vi": "mô tả chi tiết bằng tiếng Việt và đề xuất hướng xử lý"
}`;
    return this._callVisionJSON(imageBase64, mimeType, prompt);
  }
}

module.exports = OCRService;
