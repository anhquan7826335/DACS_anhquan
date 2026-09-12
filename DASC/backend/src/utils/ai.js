const axios = require('axios');
require('dotenv').config();

/**
 * Module tích hợp AI Vision / OCR.
 * Ưu tiên Gemini nếu có GEMINI_API_KEY, nếu không thì dùng OpenAI (GEMINI_API_KEY trống).
 * Cả hai đều nhận ảnh dạng base64 + prompt, trả JSON đã được parse.
 */

function getProvider() {
  if (process.env.GEMINI_API_KEY) return 'gemini';
  if (process.env.OPENAI_API_KEY) return 'openai';
  return null;
}

/**
 * Gọi model vision, ép trả về JSON thuần (không markdown, không giải thích thêm).
 * @param {string} imageBase64 - base64 KHÔNG kèm tiền tố data:...;base64,
 * @param {string} mimeType - vd 'image/jpeg', 'image/png', 'application/pdf'
 * @param {string} prompt - mô tả yêu cầu bóc tách dữ liệu
 */
async function callVisionJSON(imageBase64, mimeType, prompt) {
  const provider = getProvider();
  if (!provider) {
    throw new Error(
      'Chưa cấu hình GEMINI_API_KEY hoặc OPENAI_API_KEY trong .env — không thể gọi AI Vision.'
    );
  }

  const fullPrompt = `${prompt}\nCHỈ trả về một JSON object hợp lệ, không kèm markdown, không có lời giải thích, không có dấu backtick.`;

  if (provider === 'gemini') {
    const model = 'gemini-1.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
    const { data } = await axios.post(url, {
      contents: [
        {
          parts: [
            { text: fullPrompt },
            { inline_data: { mime_type: mimeType, data: imageBase64 } },
          ],
        },
      ],
      generationConfig: { response_mime_type: 'application/json' },
    });
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    return safeParseJSON(text);
  }

  // provider === 'openai'
  const { data } = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: fullPrompt },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
          ],
        },
      ],
    },
    { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` } }
  );
  const text = data.choices?.[0]?.message?.content || '{}';
  return safeParseJSON(text);
}

function safeParseJSON(text) {
  try {
    // phòng trường hợp model vẫn bọc ```json ... ```
    const cleaned = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    throw new Error('AI trả về dữ liệu không đúng định dạng JSON: ' + text.slice(0, 200));
  }
}

/**
 * Bóc tách chỉ số điện/nước từ ảnh công tơ hoặc ảnh/PDF hóa đơn gốc.
 * Trả về: { new_electricity: number|null, new_water: number|null, confidence: string, raw_text: string }
 */
async function extractMeterReading(imageBase64, mimeType) {
  const prompt = `Bạn là hệ thống OCR đọc chỉ số công tơ điện/nước hoặc hóa đơn điện nước tại Việt Nam.
Hãy đọc ảnh/tài liệu được đính kèm và trả về JSON theo đúng schema sau:
{
  "new_electricity": number hoặc null (chỉ số điện mới nhất đọc được, đơn vị kWh),
  "new_water": number hoặc null (chỉ số nước mới nhất đọc được, đơn vị m3),
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "raw_text": "toàn bộ text nhận diện được từ ảnh, để chủ trọ đối chiếu thủ công nếu cần"
}
Nếu ảnh chỉ có 1 trong 2 chỉ số (chỉ điện hoặc chỉ nước), để giá trị còn lại là null.`;
  return callVisionJSON(imageBase64, mimeType, prompt);
}

/**
 * Phân tích ảnh/video sự cố do khách thuê báo cáo.
 * Trả về: { device_type, issue_type, severity: LOW|MEDIUM|HIGH, summary_vi, title }
 */
async function analyzeIssueImage(imageBase64, mimeType) {
  const prompt = `Bạn là kỹ thuật viên bảo trì nhà trọ giàu kinh nghiệm tại Việt Nam.
Hãy phân tích ảnh sự cố thiết bị/hạ tầng được đính kèm và trả về JSON theo schema:
{
  "device_type": "loại thiết bị/hạng mục bị hỏng, ví dụ: Máy lạnh, Vòi nước, Ổ điện, Cửa, Trần nhà...",
  "issue_type": "mô tả ngắn gọn loại sự cố, ví dụ: Rò rỉ nước, Không lên nguồn, Nứt vỡ...",
  "severity": "LOW" hoặc "MEDIUM" hoặc "HIGH" (mức độ khẩn cấp, HIGH nếu có nguy cơ cháy nổ/chập điện/ngập nước),
  "title": "tiêu đề ngắn gọn cho ticket, dưới 60 ký tự",
  "summary_vi": "mô tả chi tiết bằng tiếng Việt những gì quan sát được và đề xuất hướng xử lý"
}`;
  return callVisionJSON(imageBase64, mimeType, prompt);
}

module.exports = { extractMeterReading, analyzeIssueImage, getProvider };
