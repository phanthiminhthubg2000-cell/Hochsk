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

    // THUẬT TOÁN TÌM MODEL TEXT AN TOÀN (Đã chặn model kiểm duyệt llama-guard)
    if (!cachedModelId) {
      const modelsPage = await groq.models.list();
      const activeModels = modelsPage.data;
      
      const textModels = activeModels.filter(m => 
          !m.id.includes("/") && 
          !m.id.includes("whisper") && 
          !m.id.includes("guard") // Chặn model kiểm duyệt bảo mật (thủ phạm sinh chữ lạ)
      );
      
      const preferredModels = textModels.filter(m => m.id.includes("llama-3.1"));
      
      if (preferredModels.length > 0) {
          cachedModelId = preferredModels[0].id;
      } else if (textModels.length > 0) {
          cachedModelId = textModels[0].id;
      } else {
          cachedModelId = "llama-3.1-8b-instant"; 
      }
      console.log("🤖 [Dictation] Đang dùng Model Text:", cachedModelId);
    }

    // PROMPT NGHIÊM NGẶT ÉP AI DÙNG TIẾNG TRUNG
    const prompt = `Bạn là một giáo viên ngôn ngữ chuyên nghiệp.
    Nhiệm vụ: Tạo 1 câu giao tiếp bằng Tiếng Trung Quốc (Simplified Chinese) thông dụng, trình độ ${level} (khoảng 6-15 chữ).
    TUYỆT ĐỐI KHÔNG sử dụng bất kỳ ngôn ngữ nào khác ngoài Tiếng Trung và Tiếng Việt.
    Không trùng với các câu sau: [${shortHistory.join(",")}].
    Chỉ trả về một đối tượng JSON thuần túy theo cấu trúc chính xác sau:
    {"chinese": "<câu tiếng Trung Quốc>", "pinyin": "<phiên âm Pinyin chuẩn>", "vietnamese": "<nghĩa tiếng Việt tự nhiên>"}`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: cachedModelId,
      temperature: 0.6, // Giảm độ sáng tạo để AI tập trung làm đúng ngôn ngữ
      max_tokens: 800,
      response_format: { type: "json_object" },
    });

    const rawText = chatCompletion.choices[0]?.message?.content || "{}";
    const parsedData = JSON.parse(rawText);
    
    // Kiểm tra an toàn trước khi trả về: Nếu AI không sinh ra tiếng Trung (thiếu trường chinese), báo lỗi để app gọi lại
    if (!parsedData.chinese) {
        throw new Error("AI trả về sai ngôn ngữ, đang tạo lại...");
    }

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