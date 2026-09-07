import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function POST(req) {
  try {
    const body = await req.json();
    const { vietnamese, targetChinese, userTranslation } = body;

    const model = genAI.getGenerativeModel({ model: "gemini-3.8-flash" });

    // Prompt yêu cầu trả về định dạng JSON nghiêm ngặt
    const prompt = `
      Bạn là một chuyên gia ngôn ngữ tiếng Trung (HSK) nhiệt tình và thân thiện.
      Nhiệm vụ của bạn là chấm điểm câu dịch của học viên.
      
      Câu gốc tiếng Việt: "${vietnamese}"
      Đáp án mẫu (để tham khảo): "${targetChinese}"
      Câu học viên dịch: "${userTranslation}"

      Hãy đánh giá câu của học viên và trả về ĐÚNG ĐỊNH DẠNG JSON sau (không thêm bất kỳ text nào khác ngoài JSON):
      {
        "score": (số từ 0 đến 100),
        "feedback": "(nhận xét ngắn gọn, chỉ ra lỗi sai ngữ pháp, từ vựng hoặc khen ngợi nếu đúng)",
        "suggestion": "(nếu câu chưa hay, hãy gợi ý cách nói tự nhiên hơn giống người bản xứ, hoặc để trống nếu đã quá hoàn hảo)"
      }
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Lọc lấy chuỗi JSON trong trường hợp AI trả về text thừa dính vào
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Invalid JSON response from AI");
    }

    const aiData = JSON.parse(jsonMatch[0]);

    return NextResponse.json({
      score: aiData.score || 0,
      feedback: aiData.feedback || "Không có phản hồi.",
      suggestion: aiData.suggestion || ""
    });

  } catch (error) {
    console.error("Lỗi AI Evaluation:", error);
    return NextResponse.json({ error: "Lỗi nội bộ khi chấm điểm." }, { status: 500 });
  }
}