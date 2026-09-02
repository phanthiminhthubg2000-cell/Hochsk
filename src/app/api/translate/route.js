import { NextResponse } from "next/server";
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || "",
});

let cachedModelId = null;

export async function POST(req) {
  try {
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: "Chưa cấu hình GROQ_API_KEY" }, { status: 500 });
    }

    const body = await req.json();
    const { action, level = "HSK 1", vietnamese, chinese, userInput, recentSentences = [] } = body;
    const shortHistory = recentSentences.slice(-5);

    // THUẬT TOÁN TỰ ĐỘNG TÌM MODEL TEXT AN TOÀN TRÊN GROQ
    if (!cachedModelId) {
      const modelsPage = await groq.models.list();
      const activeModels = modelsPage.data;
      
      // Lọc bỏ model bên thứ 3 (chứa dấu "/") và các model âm thanh (whisper)
      const textModels = activeModels.filter(m => !m.id.includes("/") && !m.id.includes("whisper"));
      
      // Ưu tiên dòng Llama 3.1
      const preferredModels = textModels.filter(m => m.id.includes("llama-3.1-8b"));
      
      if (preferredModels.length > 0) {
          cachedModelId = preferredModels[0].id;
      } else if (textModels.length > 0) {
          cachedModelId = textModels[0].id;
      } else {
          cachedModelId = "llama-3.1-8b-instant"; // Cứu cánh cuối cùng
      }
      console.log("🤖 [Translate] Đang dùng Model Text:", cachedModelId);
    }

    let prompt = "";
    let temperature = 0.7;

    if (action === "generate") {
        prompt = `Bạn là một chuyên gia ngôn ngữ. 
        Bước 1: Tạo 1 câu giao tiếp tiếng Trung thông dụng (Từ vựng ${level}, 6-15 chữ).
        Bước 2: Dịch câu đó sang tiếng Việt thật TỰ NHIÊN, thuần Việt, đúng văn phong giao tiếp hàng ngày. TUYỆT ĐỐI KHÔNG dịch máy móc từng từ (word-by-word) hay dùng từ ngữ ngô nghê.
        Không trùng với: [${shortHistory.join(",")}].
        Chỉ trả về định dạng JSON: {"vietnamese":"<câu tiếng Việt tự nhiên>","chinese":"<câu tiếng Trung>","pinyin":"<phiên âm pinyin>"}`;
    } 
    else if (action === "grade") {
        temperature = 0.2; 
        prompt = `Học sinh vừa dịch câu tiếng Việt sang tiếng Trung.
        - Câu gốc: "${vietnamese}"
        - Đáp án chuẩn: "${chinese}"
        - Học sinh dịch: "${userInput}"
        Nhiệm vụ: Chấm xem học sinh dịch có ĐÚNG NGỮ NGHĨA và NGỮ PHÁP không. (Người bản xứ hiểu và tự nhiên là được, không cần giống 100% đáp án chuẩn).
        Chỉ trả về JSON thuần túy: {"isCorrect": true/false, "message": "Lời nhận xét ngắn gọn bằng tiếng Việt (Khen ngợi hoặc chỉ ra lỗi sai để sửa)"}`;
    } else {
        return NextResponse.json({ error: "Thiếu tham số action (generate/grade)" }, { status: 400 });
    }

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: cachedModelId,
      temperature: temperature,
      max_tokens: 800, // Đã tăng từ 200 lên 800 để tránh lỗi đứt gãy JSON
      response_format: { type: "json_object" },
    });

    const rawText = chatCompletion.choices[0]?.message?.content || "{}";
    const parsedData = JSON.parse(rawText);
    
    return NextResponse.json(parsedData);

  } catch (error) {
    console.error("Lỗi chi tiết từ Groq API (Translate):", error);
    
    // Reset cache nếu model gặp lỗi
    if (error?.message?.includes("terms") || error?.message?.includes("decommissioned") || error?.message?.includes("support") || error?.status === 404 || error?.status === 400) {
        cachedModelId = null; 
    }

    return NextResponse.json(
      { error: error?.message || "Lỗi không xác định khi gọi AI" },
      { status: 500 }
    );
  }
}