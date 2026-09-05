import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req) {
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return new Response(JSON.stringify({ answer: "Vui lòng nhập câu hỏi." }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Khởi tạo Gemini với API Key từ file .env.local
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });

    // Đóng vai giáo viên tiếng Trung để AI trả lời đúng trọng tâm
    const systemInstruction = `Bạn là một giáo viên tiếng Trung xuất sắc tại Hành Trình HSK. 
    Học viên đang hỏi bạn: "${prompt}".
    Hãy giải đáp thật ngắn gọn, dễ hiểu, thân thiện. Luôn kèm theo ví dụ minh họa (gồm Chữ Hán, Pinyin và nghĩa Tiếng Việt). 
    Sử dụng emoji phù hợp để bài giảng sinh động.`;

    const result = await model.generateContent(systemInstruction);
    const text = result.response.text();

    // Trả kết quả về cho Frontend
    return new Response(JSON.stringify({ answer: text }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Lỗi từ AI API:", error);
    return new Response(JSON.stringify({ answer: "Hệ thống AI đang bận hoặc gặp sự cố kết nối. Vui lòng thử lại sau nhé!" }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}