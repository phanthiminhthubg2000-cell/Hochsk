import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { questions } = await req.json();

    if (!process.env.GEMINI_API_KEY) {
      console.error("Lỗi: Không tìm thấy GEMINI_API_KEY trong file .env.local");
      return NextResponse.json({ error: "Missing API Key" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // FIX 1: Sử dụng đúng phiên bản model gemini-1.5-flash hiện hành
    const model = genAI.getGenerativeModel({ 
      model: "gemini-3.8-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const systemPrompt = `Bạn là giám khảo chấm thi dịch Việt-Trung HSK có 10 năm kinh nghiệm. 
NHIỆM VỤ: Chấm điểm danh sách các câu dịch của thí sinh.

NGUYÊN TẮC CỐT LÕI:
1. Đánh giá dựa trên "lõi ngữ nghĩa". Chấp nhận từ đồng nghĩa (高兴/开心, 觉得/认为...), trật tự câu khác hoặc cấu trúc ngữ pháp tương đương, miễn là đúng nghĩa gốc.
2. KHÔNG trừ điểm (hoặc trừ rất nhẹ) nếu thiếu dấu câu, thiếu trợ từ (啊, 呢, 吧) không làm thay đổi ý nghĩa.
3. PHẢI TRỪ NẶNG nếu: sai nghĩa, đảo ngược ý, nhầm từ làm đổi hẳn nghĩa (như 对于/多于), thiếu thành phần cốt lõi.

THANG ĐIỂM (Tối đa 10 điểm):
- 9-10: Đúng nghĩa hoàn toàn, tự nhiên (dùng từ đồng nghĩa vẫn tính max điểm).
- 7-8: Đúng nghĩa, lỗi ngữ pháp nhỏ không đổi nghĩa.
- 5-6: Đúng nghĩa cơ bản, có 2-3 lỗi ngữ pháp hoặc thiếu chi tiết phụ.
- 3-4: Đạt một phần ý chính, lỗi làm mơ hồ nghĩa.
- 1-2: Sai nghĩa đáng kể, làm đổi nghĩa câu.
- 0: Không hiểu được hoặc bỏ trống.

ĐẦU VÀO: Một mảng JSON chứa các object: { "id": "...", "vietnamese": "...", "target": "...", "userAns": "..." }
ĐẦU RA BẮT BUỘC: Một mảng JSON (cùng độ dài và đúng id với đầu vào), mỗi object có format:
{
  "id": "...",
  "score": (số nguyên từ 0 đến 10),
  "feedback": "(Giải thích ngắn gọn lỗi sai, hoặc khen nếu dùng từ đồng nghĩa hay)",
  "status": "(chỉ chọn 1 trong 3: 'correct', 'partial', 'wrong')"
}`;

    const prompt = `${systemPrompt}\n\nĐầu vào cần chấm: ${JSON.stringify(questions)}`;
    const result = await model.generateContent(prompt);
    
    let aiResponseText = result.response.text();
    
    // FIX 2: Cắt bỏ các thẻ markdown (nếu có) trước khi parse để tránh sập server
    aiResponseText = aiResponseText.replace(/```json/g, "").replace(/```/g, "").trim();
    
    const evaluationData = JSON.parse(aiResponseText);

    return NextResponse.json(evaluationData);
  } catch (error) {
    console.error("Lỗi AI Evaluation chi tiết:", error);
    // Trả về error message cụ thể ra console để dễ debug
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}