import { NextResponse } from "next/server";
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || "",
});

let cachedModelId = null;

const LEVEL_CONFIGS = {
  "HSK 1": { length: "6 đến 12 chữ", topics: "Chào hỏi, giới thiệu bản thân, gia đình, ăn uống, thời gian." },
  "HSK 2": { length: "12 đến 20 chữ", topics: "Du lịch, công việc, học tập, sở thích, cuộc sống hằng ngày." },
  "HSK 3": { length: "20 đến 30 chữ", topics: "Trường lớp, bạn bè, giải trí, mua sắm, thời tiết." },
  "HSK 4": { length: "30 đến 45 chữ", topics: "Phỏng vấn, kế hoạch, thể thao, tình bạn, quan điểm sống." },
  "HSK 5": { length: "45 đến 65 chữ", topics: "Phương pháp học, áp lực công sở, mạng xã hội, văn hóa truyền thống." },
  "HSK 6": { length: "65 đến 90 chữ", topics: "Lịch sử nghệ thuật, triết lý nhân sinh, xã hội số, công nghệ và kinh tế." }
};

export async function POST(req) {
  try {
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: "Chưa cấu hình GROQ_API_KEY" }, { status: 500 });
    }

    const body = await req.json();
    const { level = "HSK 1", recentSentences = [] } = body;
    const shortHistory = recentSentences.slice(-5);
    const config = LEVEL_CONFIGS[level] || LEVEL_CONFIGS["HSK 1"];

    if (!cachedModelId) {
      const modelsPage = await groq.models.list();
      const activeModels = modelsPage.data;
      
      const textModels = activeModels.filter(m => 
          !m.id.includes("/") && 
          !m.id.includes("whisper") && 
          !m.id.includes("guard") 
      );
      
      // Ưu tiên dòng 70B nếu có vì nó thông minh hơn, ít bị ảo giác. Nếu không có thì dùng 8B.
      const preferredModels = textModels.filter(m => m.id.includes("llama-3.3") || m.id.includes("70b"));
      
      if (preferredModels.length > 0) {
          cachedModelId = preferredModels[0].id;
      } else if (textModels.length > 0) {
          cachedModelId = textModels[0].id;
      } else {
          cachedModelId = "llama-3.1-8b-instant"; 
      }
      console.log("🤖 [Dictation] Đang dùng Model Text:", cachedModelId);
    }

    // SYSTEM PROMPT: Lệnh tối cao bằng tiếng Anh ép AI không được dùng ngôn ngữ khác
    const systemPrompt = `You are a professional Chinese language examiner. You MUST output your response strictly in JSON format. The 'chinese' field MUST contain ONLY Simplified Chinese characters (简体中文). NEVER output Arabic, Hindi, or any other language in the 'chinese' field. The 'vietnamese' field MUST be in Vietnamese.`;

    // USER PROMPT: Đề bài chi tiết bằng tiếng Việt
    const userPrompt = `Tạo 1 câu/đoạn văn tiếng Trung để luyện nghe chép chính tả.
    1. Cấp độ: Chỉ dùng từ vựng ${level}.
    2. Độ dài bắt buộc: ${config.length} Hán.
    3. Chủ đề: Chọn 1 trong các ý sau: [${config.topics}].
    4. Không lặp lại ý của: [${shortHistory.join(",")}].
    
    Định dạng JSON duy nhất trả về:
    {"chinese": "<chữ Hán giản thể>", "pinyin": "<phiên âm>", "vietnamese": "<nghĩa tiếng Việt>"}`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      model: cachedModelId,
      temperature: 0.3, // Đã giảm từ 0.8 xuống 0.3 để AI ngoan ngoãn, không bị "say" sinh chữ lạ
      max_tokens: 1500,
      response_format: { type: "json_object" },
    });

    const rawText = chatCompletion.choices[0]?.message?.content || "{}";
    const parsedData = JSON.parse(rawText);
    
    // Rào chắn cuối cùng: Check xem có đúng tiếng Trung không (chứa ít nhất 1 chữ Hán)
    const chineseRegex = /[\u4e00-\u9fa5]/;
    if (!parsedData.chinese || !chineseRegex.test(parsedData.chinese)) {
        throw new Error("AI không trả về tiếng Trung hợp lệ.");
    }

    return NextResponse.json(parsedData);

  } catch (error) {
    console.error("Lỗi chi tiết từ Groq API (Dictation):", error);
    
    if (error?.message?.includes("terms") || error?.message?.includes("decommissioned") || error?.status === 404 || error?.status === 400) {
        cachedModelId = null; 
    }

    return NextResponse.json(
      { error: error?.message || "Lỗi khi gọi AI" },
      { status: 500 }
    );
  }
}