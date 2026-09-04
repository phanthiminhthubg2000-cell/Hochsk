import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { targetWord, userSentence } = await req.json();

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-3.6-flash"
    });

    const prompt = `
      Bạn là một giáo viên tiếng Trung.
      Nhiệm vụ: Kiểm tra xem học sinh đặt câu có đúng không.
      - Từ vựng bắt buộc phải có mặt trong câu: "${targetWord}"
      - Câu học sinh viết: "${userSentence}"

      Quy tắc chấm:
      1. Câu phải chứa từ vựng bắt buộc.
      2. Câu phải đúng ngữ pháp tiếng Trung cơ bản và có ý nghĩa hợp lý. Học sinh có thể viết những câu đơn giản hằng ngày, hãy chấm nương tay nếu nó đúng ngữ pháp.

      Trả về ĐÚNG MỘT OBJECT JSON, tuyệt đối KHÔNG bọc trong thẻ markdown (\`\`\`json):
      {
        "isPass": true hoặc false,
        "feedback": "Nhận xét chi tiết bằng tiếng Việt",
        "suggestion": "Gợi ý sửa lại nếu sai, nếu đúng thì để rỗng"
      }
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    
    // BỘ LỌC AN TOÀN: Dọn dẹp thẻ markdown nếu AI vô tình sinh ra
    let text = response.text().trim();
    text = text.replace(/^```json/i, '').replace(/^```/i, '').replace(/```$/i, '').trim();
    
    const data = JSON.parse(text);

    return NextResponse.json(data);
  } catch (error) {
    console.error("Lỗi AI chấm câu:", error);
    return NextResponse.json({ error: "Lỗi kết nối AI hoặc định dạng JSON sai, vui lòng thử lại." }, { status: 500 });
  }
}