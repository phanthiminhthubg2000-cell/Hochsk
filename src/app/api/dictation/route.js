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
    const { level = "HSK 1", recentSentences = [] } = body;
    const shortHistory = recentSentences.slice(-5);

    // THUẬT TOÁN TỰ ĐỘNG TÌM MODEL TEXT AN TOÀN TRÊN GROQ
    if (!cachedModelId) {
      const modelsPage = await groq.models.list();
      const activeModels = modelsPage.data;
      
      const textModels = activeModels.filter(m => !m.id.includes("/") && !m.id.includes("whisper"));
      const preferredModels = textModels.filter(m => m.id.includes("llama-3.1-8b") || m.id.includes("llama"));
      
      if (preferredModels.length > 0) {
          cachedModelId = preferredModels[0].id;
      } else if (textModels.length > 0) {
          cachedModelId = textModels[0].id;
      } else {
          cachedModelId = "llama-3.1-8b-instant"; 
      }
      console.log("🤖 [Dictation] Đang dùng Model Text:", cachedModelId);
    }

    const prompt = `Tạo 1 câu tiếng Trung thông dụng thuộc trình độ ${level} (khoảng 6-15 chữ).
    Không trùng với các câu sau: [${shortHistory.join(",")}].
    Chỉ trả về JSON thuần túy theo định dạng sau, không giải thích gì thêm:
    {"chinese": "<câu tiếng Trung>", "pinyin": "<phiên âm>", "vietnamese": "<nghĩa tiếng Việt>"}`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: cachedModelId,
      temperature: 0.7,
      max_tokens: 800, // ĐÃ TĂNG LÊN 800 ĐỂ AI KHÔNG BỊ NGẮT LỜI
      response_format: { type: "json_object" },
    });

    const rawText = chatCompletion.choices[0]?.message?.content || "{}";
    const parsedData = JSON.parse(rawText);
    
    return NextResponse.json(parsedData);

  } catch (error) {
    console.error("Lỗi chi tiết từ Groq API (Dictation):", error);
    
    if (error?.message?.includes("terms") || error?.message?.includes("decommissioned") || error?.message?.includes("support") || error?.status === 404 || error?.status === 400) {
        cachedModelId = null; 
    }

    return NextResponse.json(
      { error: error?.message || "Lỗi không xác định khi gọi AI" },
      { status: 500 }
    );
  }
}