import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const body = await req.json();

    let apiMessages = [];
    let isDictionaryQuery = false;

    // ==========================================
    // TRƯỜNG HỢP 1: TÍNH NĂNG TỪ ĐIỂN Ếch xanh (Frontend gửi lên 'message' dạng chuỗi)
    // ==========================================
    if (body.message && !body.messages) {
      isDictionaryQuery = true;
      apiMessages = [
        { 
          role: "system", 
          content: `Bạn là "Ếch xanh", một trợ lý AI thông minh chuyên giảng dạy tiếng Trung trên nền tảng HSK Garden.
          Nhiệm vụ của bạn là PHÂN TÍCH và GIẢI THÍCH CHI TIẾT câu hỏi, từ vựng hoặc ngữ pháp mà học viên nhập vào.
          
          Yêu cầu trình bày:
          1. Phân tích cấu trúc ngữ pháp (nếu có).
          2. Cung cấp pinyin và giải thích rõ ràng, dễ hiểu.
          3. Lấy 1-2 ví dụ minh họa cách sử dụng từ/cấu trúc đó.
          4. Giữ giọng điệu thân thiện, nhiệt tình. Trình bày bằng Markdown sạch sẽ.`
        },
        {
          role: "user",
          content: body.message
        }
      ];
    } 
    // ==========================================
    // TRƯỜNG HỢP 2: TÍNH NĂNG CHAT ROLEPLAY (Frontend gửi lên 'messages' dạng mảng lịch sử)
    // ==========================================
    else if (body.messages) {
      apiMessages = [
        { 
          role: "system", 
          content: `Bạn là người bản xứ Trung Quốc đóng vai trò là bạn chat luyện tập HSK.
          QUY TẮC BẮT BUỘC:
          1. Hãy ép học viên chat bằng tiếng Trung. Nếu họ chat bằng tiếng Việt, hãy dùng tiếng Trung để nhắc nhở họ chuyển sang tiếng Trung.
          2. Phản hồi cực kỳ ngắn gọn, tự nhiên như chat hàng ngày.
          3. BẠN PHẢI TRẢ LỜI THEO ĐÚNG ĐỊNH DẠNG SAU (Không được thêm bất kỳ ký tự nào khác):
          ZH: [Câu tiếng Trung của bạn]
          PY: [Pinyin của câu đó]
          VI: [Dịch nghĩa tiếng Việt của câu đó]` 
        },
        ...body.messages
      ];
    } else {
      return NextResponse.json({ reply: "Dữ liệu gửi lên không hợp lệ." }, { status: 400 });
    }

    // GỌI API GROQ
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama3-8b-8192", // Thay bằng model Groq bạn đang dùng nếu cần (ví dụ: llama-3.1-70b-versatile)
        messages: apiMessages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Lỗi từ Groq API:", data);
      return NextResponse.json({ 
        reply: isDictionaryQuery 
          ? "Đã xảy ra lỗi AI, vui lòng thử lại." 
          : `ZH: (Lỗi AI: ${data.error?.message || "Không xác định"})\nPY: \nVI: ` 
      });
    }

    const aiMessage = data.choices?.[0]?.message?.content;
    
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
    console.error("Lỗi Server API Chat:", error);
    return NextResponse.json({ reply: "Lỗi server nội bộ, không kết nối được AI." }, { status: 500 });
  }
}