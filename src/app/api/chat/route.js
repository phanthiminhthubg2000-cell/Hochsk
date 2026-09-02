import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { messages } = await req.json();

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b", 
        messages: [
          { 
            role: "system", 
            content: `Bạn là người bản xứ Trung Quốc đóng vai trò là bạn chat luyện tập HSK.
            QUY TẮC BẮT BUỘC:
            1. Hãy ép học viên chat bằng tiếng Trung. Nếu họ chat bằng tiếng Việt hoặc ngôn ngữ khác, hãy dùng tiếng Trung để nhắc nhở họ chuyển sang tiếng Trung.
            2. Phản hồi cực kỳ ngắn gọn, tự nhiên như chat hàng ngày.
            3. BẠN PHẢI TRẢ LỜI THEO ĐÚNG ĐỊNH DẠNG SAU (Không được thêm bất kỳ ký tự nào khác bên ngoài):
            ZH: [Câu tiếng Trung của bạn]
            PY: [Pinyin của câu đó]
            VI: [Dịch nghĩa tiếng Việt của câu đó]` 
          },
          ...messages
        ]
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Lỗi từ Groq API:", data);
      return NextResponse.json({ reply: `ZH: (Lỗi AI: ${data.error?.message || "Không xác định"})\nPY: \nVI: ` });
    }

    const aiMessage = data.choices?.[0]?.message?.content;
    
    if (!aiMessage) {
      return NextResponse.json({ reply: "ZH: (AI trả về rỗng. Hãy thử lại!)\nPY: \nVI: " });
    }

    return NextResponse.json({ reply: aiMessage });
    
  } catch (error) {
    console.error("Lỗi Server API Chat:", error);
    return NextResponse.json({ reply: "ZH: (Lỗi server nội bộ, không kết nối được AI.)\nPY: \nVI: " });
  }
}