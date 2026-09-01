import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const body = await req.json();
    const { action } = body;

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "Thiếu GEMINI_API_KEY trong file .env.local" });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // 1. TẠO TRỌN BỘ ĐỀ THI (KHÔNG CÓ GỢI Ý)
    if (action === "generate") {
      const { level } = body;
      let prompt = `Bạn là chuyên gia ra đề thi HSKK. Hãy tạo một bộ đề thi mô phỏng ngắn gọn cho ${level}. Tuyệt đối KHÔNG kèm theo bất kỳ gợi ý nào.
      Trả về đúng định dạng mảng JSON gồm các câu hỏi: [{"type": "loại", "text": "nội dung"}].
      Cấu trúc đề yêu cầu: `;
      
      if (level === "HSK Cấp 3") {
        prompt += `1 câu "repeat" (nghe nhắc lại câu ngắn khoảng 10-15 chữ), 1 câu "picture" (text bắt buộc là: "请看这张图片，用中文描述它。"), 1 câu "short" (câu hỏi giao tiếp ngắn).`;
      } else {
        let length = level === "HSK Cấp 4" ? "60-80" : "100-150";
        prompt = `1 câu "retell" (nghe thuật lại đoạn văn dài khoảng ${length} chữ), 1 câu "picture" (text bắt buộc là: "请看这张图片，用中文描述它。"), 1 câu "short" (câu hỏi nghị luận xã hội).`;
      }

      const result = await model.generateContent(prompt);
      let text = result.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
      return NextResponse.json(JSON.parse(text));
    }

    // 2. CHẤM ĐIỂM TOÀN BÀI (THANG ĐIỂM 100)
    if (action === "grade") {
      const { level, answers } = body;
      const prompt = `Bạn là giám khảo HSKK. Học sinh vừa hoàn thành bài thi ${level}.
      Dưới đây là danh sách câu hỏi và câu trả lời tương ứng của học sinh: ${JSON.stringify(answers)}.
      Hãy chấm điểm toàn bài thi trên thang điểm 100 (đánh giá độ chính xác, ngữ pháp, độ lưu loát và vốn từ).
      Trả về đúng định dạng JSON sau:
      {
        "totalScore": điểm_tổng_trên_100,
        "overallFeedback": "Nhận xét tổng quan về trình độ và xếp loại (Giỏi/Khá/Trung bình/Kém) bằng tiếng Việt",
        "details": [
           { "question": "nội dung câu hỏi gốc", "score": điểm_phần_này_trên_10, "feedback": "Chỉ ra lỗi sai và cách sửa bằng tiếng Việt" }
        ]
      }`;

      const result = await model.generateContent(prompt);
      let text = result.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
      return NextResponse.json(JSON.parse(text));
    }

  } catch (error) {
    console.error("Lỗi HSKK API:", error);
    return NextResponse.json({ error: error.message, totalScore: 0, overallFeedback: "Lỗi hệ thống AI." });
  }
}