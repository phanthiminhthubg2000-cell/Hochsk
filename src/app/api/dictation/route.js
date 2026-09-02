import { NextResponse } from "next/server";
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || "",
});

// Biến lưu trữ model đã tìm được (giúp không phải tìm lại nhiều lần gây chậm API)
let cachedModelId = null;

export async function POST(req) {
  try {
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: "Chưa cấu hình GROQ_API_KEY" }, { status: 500 });
    }

    const { level = "HSK 1", recentSentences = [] } = await req.json();
    const shortHistory = recentSentences.slice(-5);

    // THUẬT TOÁN TỰ ĐỘNG TÌM MODEL KHẢ DỤNG
    if (!cachedModelId) {
      const modelsPage = await groq.models.list();
      const activeModels = modelsPage.data;
      
      // Lọc tìm các model chứa chữ "llama" và có dung lượng nhẹ (8b) để tối ưu tốc độ
      const llamaModels = activeModels.filter(m => m.id.includes("llama") && m.id.includes("8b"));
      
      if (llamaModels.length > 0) {
          cachedModelId = llamaModels[0].id; // Lấy model Llama khả dụng đầu tiên
      } else if (activeModels.length > 0) {
          cachedModelId = activeModels[0].id; // Nếu không có Llama, lấy đại model bất kỳ đang hoạt động
      } else {
          throw new Error("Không tìm thấy model nào khả dụng trên Groq.");
      }
      console.log("🤖 Hệ thống đã tự động chọn Model:", cachedModelId);
    }

    const prompt = `Tạo 1 câu giao tiếp tiếng Trung luyện nghe chép (Từ vựng ${level}, 6-12 chữ). Không trùng với: [${shortHistory.join(",")}]. Chỉ trả về JSON thuần túy theo cấu trúc: {"chinese":"...","pinyin":"...","vietnamese":"..."}`;

    // Truyền biến model tự động tìm được vào đây
    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: cachedModelId,
      temperature: 0.7,
      max_tokens: 150,
      response_format: { type: "json_object" },
    });

    const rawText = chatCompletion.choices[0]?.message?.content || "{}";
    
    const parsedData = JSON.parse(rawText);
    return NextResponse.json(parsedData);

  } catch (error) {
    console.error("Lỗi chi tiết từ Groq API:", error);
    
    // Nếu lỗi do model tự động bị hỏng, xóa cache để lần sau tìm lại
    if (error?.message?.includes("decommissioned") || error?.status === 404) {
        cachedModelId = null; 
    }

    return NextResponse.json(
      { error: error?.message || "Lỗi không xác định khi gọi AI" },
      { status: 500 }
    );
  }
}