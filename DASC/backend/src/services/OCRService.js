const axios = require('axios');

/**
 * OCRService — Service tích hợp Gemini / OpenAI Vision API.
 * Ưu tiên Gemini nếu có GEMINI_API_KEY, fallback sang OpenAI nếu có OPENAI_API_KEY.
 * Dùng cho 2 use-case: (1) đọc SỐ TIỀN điện/nước từ ảnh/PDF hóa đơn, (2) phân tích ảnh/video sự cố kỹ thuật.
 */
class OCRService {
  constructor({ geminiApiKey, openaiApiKey } = {}) {
    this.geminiApiKey = geminiApiKey;
    this.openaiApiKey = openaiApiKey;
    // Giới hạn token đầu ra của trợ lý. Model dạng "thinking" tính cả token suy luận vào đây nên cần để rộng.
    this.maxOutputTokens = Number(process.env.AI_MAX_OUTPUT_TOKENS) || 4096;
  }

  getProvider() {
    if (this.geminiApiKey) return 'gemini';
    if (this.openaiApiKey) return 'openai';
    return null;
  }

  getGeminiModel() {
    return process.env.GEMINI_MODEL || 'gemini-3.6-flash';
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
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.getGeminiModel()}:generateContent?key=${this.geminiApiKey}`;
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

  async askAssistant(question, history = [], context = {}) {
    const provider = this.getProvider();
    if (!provider) {
      throw new Error('Chưa cấu hình GEMINI_API_KEY hoặc OPENAI_API_KEY — không thể gọi trợ lý.');
    }

    const historyText = history.length === 0
      ? 'Chưa có lịch sử trò chuyện.'
      : history.map((item) => `Người dùng: ${item.question}\nTrợ lý: ${item.answer}`).join('\n');
    const prompt = `Bạn là trợ lý hỗ trợ quản lý nhà trọ tại Việt Nam.
Chỉ trả lời các câu hỏi liên quan đến thuê phòng, hợp đồng, hóa đơn, thanh toán, nội quy,
bảo trì và báo sự cố. Trả lời bằng tiếng Việt, ngắn gọn, thực tế và dễ hiểu.
Không tự bịa thông tin tài khoản, số tiền, ngày hạn hoặc chính sách cụ thể nếu không có trong ngữ cảnh.
Nếu câu hỏi cần chủ trọ xác nhận, hãy nói rõ người dùng nên liên hệ chủ trọ.
Zalo chủ trọ: 0374250112, email chủ trọ: lquankk@gmail.com
Thông tin người dùng hiện tại: ${JSON.stringify(context)}
Lịch sử gần đây:
${historyText}

Câu hỏi mới: ${question}`;

    const fallback = 'Xin lỗi, trợ lý chưa có câu trả lời.';
    if (provider === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.getGeminiModel()}:generateContent?key=${this.geminiApiKey}`;
      const { data } = await axios.post(url, {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: this.maxOutputTokens },
      });
      const candidate = data.candidates?.[0];
      if (candidate?.finishReason === 'MAX_TOKENS') {
        console.warn(`[AI] Gemini bị cắt do chạm giới hạn ${this.maxOutputTokens} token (tăng AI_MAX_OUTPUT_TOKENS nếu cần).`);
      }
      // Ghép mọi phần text (model có thể trả nhiều part), bỏ các part "thought" nếu có.
      const text = (candidate?.content?.parts || [])
        .filter((part) => !part.thought && typeof part.text === 'string')
        .map((part) => part.text)
        .join('')
        .trim();
      return text || fallback;
    }

    const { data } = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      { model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], max_tokens: this.maxOutputTokens },
      { headers: { Authorization: `Bearer ${this.openaiApiKey}` } }
    );
    if (data.choices?.[0]?.finish_reason === 'length') {
      console.warn(`[AI] OpenAI bị cắt do chạm giới hạn ${this.maxOutputTokens} token (tăng AI_MAX_OUTPUT_TOKENS nếu cần).`);
    }
    return data.choices?.[0]?.message?.content?.trim() || fallback;
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
   * Bóc tách SỐ TIỀN điện/nước phải thanh toán từ ảnh/PDF hóa đơn điện nước gốc.
   */
  async extractBillAmounts(imageBase64, mimeType) {
    const prompt = `Bạn là hệ thống OCR đọc HÓA ĐƠN TIỀN ĐIỆN / TIỀN NƯỚC tại Việt Nam.
Hãy đọc ảnh/tài liệu được đính kèm và trả về JSON theo đúng schema sau:
{
  "electricity_amount": số tiền điện phải thanh toán (VNĐ, số nguyên, không có dấu chấm/phẩy ngăn cách) hoặc null,
  "water_amount": số tiền nước phải thanh toán (VNĐ, số nguyên, không có dấu chấm/phẩy ngăn cách) hoặc null,
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "raw_text": "toàn bộ text nhận diện được từ ảnh, để chủ trọ đối chiếu thủ công nếu cần"
}
Chỉ lấy SỐ TIỀN phải thanh toán (tổng cộng, đã gồm thuế/phí nếu có). KHÔNG lấy chỉ số công tơ hay lượng tiêu thụ (kWh, m3).
Nếu ảnh chỉ có 1 trong 2 loại hóa đơn, hoặc không thấy số tiền, để giá trị tương ứng là null.`;
    return this._callVisionJSON(imageBase64, mimeType, prompt);
  }

  /**
   * Phân tích ảnh sự cố do khách thuê báo cáo.
   * Không chỉ trích xuất dữ liệu để điền form (device_type, severity...) mà còn đóng vai trò
   * "trợ lý kỹ thuật" thực sự: đưa ra hướng dẫn xử lý tạm thời an toàn cho khách thuê ngay lập tức,
   * trong lúc chờ chủ trọ/thợ tới sửa — đây là phần "help" thực sự cho người dùng.
   */
  async analyzeIssueImage(imageBase64, mimeType) {
    const prompt = `Bạn là kỹ thuật viên bảo trì nhà trọ giàu kinh nghiệm tại Việt Nam, đang tư vấn trực tiếp
cho một khách thuê không rành kỹ thuật. Họ vừa gửi ảnh sự cố và cần được GIÚP ĐỠ ngay, không chỉ là phân loại.

Hãy phân tích ảnh sự cố thiết bị/hạ tầng và trả về JSON theo đúng schema sau:
{
  "device_type": "loại thiết bị/hạng mục bị hỏng, ví dụ: Máy lạnh, Vòi nước, Ổ điện, Cửa, Trần nhà...",
  "issue_type": "mô tả ngắn gọn loại sự cố, ví dụ: Rò rỉ nước, Không lên nguồn, Nứt vỡ...",
  "severity": "LOW" hoặc "MEDIUM" hoặc "HIGH" (HIGH nếu có nguy cơ cháy nổ/chập điện/ngập nước/mất an toàn),
  "title": "tiêu đề ngắn gọn cho ticket, dưới 60 ký tự",
  "summary_vi": "mô tả chi tiết bằng tiếng Việt những gì quan sát được từ ảnh",
  "is_safety_risk": true hoặc false (true nếu khách thuê có thể gặp nguy hiểm nếu tiếp tục sử dụng/không xử lý ngay),
  "immediate_actions": [
    "Danh sách 2-4 bước CỤ THỂ khách thuê có thể tự làm NGAY bây giờ để giảm thiểu rủi ro hoặc hạn chế hư hỏng lan rộng,
     trong lúc chờ thợ tới. Ví dụ: 'Tắt cầu dao khu vực này ngay lập tức', 'Đặt xô hứng nước dưới chỗ rò rỉ',
     'Không chạm vào thiết bị khi tay còn ướt'. Nếu sự cố không có gì khách tự làm được, để mảng rỗng []."
  ],
  "should_call_landlord_urgently": true hoặc false (true nếu đây là tình huống khẩn cấp cần gọi ngay chủ trọ thay vì chỉ gửi ticket)
}

QUAN TRỌNG: "immediate_actions" phải là hướng dẫn AN TOÀN, không yêu cầu khách thuê tự sửa chữa điện nước
phức tạp hoặc tháo lắp thiết bị — chỉ là các bước tạm thời để giảm thiệt hại/rủi ro trong lúc chờ xử lý chuyên nghiệp.`;
    return this._callVisionJSON(imageBase64, mimeType, prompt);
  }
}

module.exports = OCRService;
