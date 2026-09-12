import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Khởi tạo Gemini AI bằng Key bạn đã cài sẵn trong .env.local
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req) {
  try {
    const body = await req.json();

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ reply: "Lỗi: Chưa cấu hình GEMINI_API_KEY trong .env.local" }, { status: 500 });
    }

    let isDictionaryQuery = false;
    let systemPrompt = "";
    let geminiContents = [];

    // ==========================================
    // TRƯỜNG HỢP 1: TÍNH NĂNG TỪ ĐIỂN Ếch xanh
    // ==========================================
    if (body.message && !body.messages) {
      isDictionaryQuery = true;
      systemPrompt = `Bạn là "Ếch xanh", một trợ lý AI thông minh chuyên giảng dạy tiếng Trung trên nền tảng HSK Garden.
      Nhiệm vụ của bạn là PHÂN TÍCH và GIẢI THÍCH CHI TIẾT câu hỏi, từ vựng hoặc ngữ pháp mà học viên nhập vào.
      
      Yêu cầu trình bày:
      1. Phân tích cấu trúc ngữ pháp (nếu có).
      2. Cung cấp pinyin và giải thích rõ ràng, dễ hiểu.
      3. Lấy 1-2 ví dụ minh họa cách sử dụng từ/cấu trúc đó.
      4. Giữ giọng điệu thân thiện, nhiệt tình. Trình bày bằng Markdown sạch sẽ.`;

      geminiContents = [
        { role: "user", parts: [{ text: body.message }] }
      ];
    } 
    // ==========================================
    // TRƯỜNG HỢP 2: TÍNH NĂNG CHAT ROLEPLAY (Phim trường)
    // ==========================================
    else if (body.messages) {
      // BẮT BỆNH Ở ĐÂY: Trích xuất chủ đề (topic) do giao diện gửi lên để AI không bị quên
      const providedTopic = body.topic || "";
      const frontendSystemMessages = body.messages
        .filter(msg => msg.role === 'system')
        .map(msg => msg.content)
        .join("\n");
        
      const topicContext = providedTopic || frontendSystemMessages;

      systemPrompt = `Bạn là người bản xứ Trung Quốc đóng vai trò là bạn chat luyện tập HSK.
      ${topicContext ? `\nCHÚ Ý - CHỦ ĐỀ TRÒ CHUYỆN BẮT BUỘC CỦA BẠN LÀ: ${topicContext}\nHãy chủ động dẫn dắt, hỏi đáp và tập trung hoàn toàn vào chủ đề này.` : ''}
      
      QUY TẮC BẮT BUỘC:
      1. Hãy ép học viên chat bằng tiếng Trung. Nếu họ chat bằng tiếng Việt, hãy dùng tiếng Trung để nhắc nhở họ chuyển sang tiếng Trung.
      2. Phản hồi cực kỳ ngắn gọn, tự nhiên như chat hàng ngày. Tuyệt đối không lan man ngoài chủ đề.
      3. BẠN PHẢI TRẢ LỜI THEO ĐÚNG ĐỊNH DẠNG SAU (Không được thêm bất kỳ ký tự nào khác):
      ZH: [Câu tiếng Trung của bạn]
      PY: [Pinyin của câu đó]
      VI: [Dịch nghĩa tiếng Việt của câu đó]`;

      // Chuyển đổi định dạng lịch sử chat chuẩn bị gửi cho Gemini (bỏ đi dòng system cũ để tránh lỗi)
      geminiContents = body.messages
        .filter(msg => msg.role !== 'system')
        .map(msg => ({
          role: msg.role === 'assistant' ? 'model' : 'user', 
          parts: [{ text: msg.content }]
        }));
    } else {
      return NextResponse.json({ reply: "Dữ liệu gửi lên không hợp lệ." }, { status: 400 });
    }

    // ==========================================
    // GỌI API GEMINI 
    // ==========================================
    const model = genAI.getGenerativeModel({
      model: "gemini-3.6-flash",
      systemInstruction: systemPrompt
    });

    const result = await model.generateContent({ contents: geminiContents });
    const aiMessage = result.response.text();
    
    if (!aiMessage) {
      return NextResponse.json({ 
        reply: isDictionaryQuery 
          ? "AI trả về kết quả rỗng." 
          : "ZH: (AI trả về rỗng. Hãy thử lại!)\nPY: \nVI: " 
      });
    }

    // TRẢ KẾT QUẢ VỀ FRONTEND
    return NextResponse.json({ reply: aiMessage });
    
  } catch (error) {
    console.error("Lỗi Server API Chat (Gemini):", error);
    return NextResponse.json({ 
      reply: body?.message 
        ? "Lỗi server nội bộ, không kết nối được AI Gemini." 
        : "ZH: (Lỗi kết nối Gemini AI)\nPY: \nVI: " 
    }, { status: 500 });
  }
}