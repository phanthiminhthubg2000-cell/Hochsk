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
      
      const preferredModels = textModels.filter(m => m.id.includes("llama-3.3") || m.id.includes("70b"));
      
      if (preferredModels.length > 0) {
          cachedModelId = preferredModels[0].id;
      } else if (textModels.length > 0) {
          cachedModelId = textModels[0].id;
      } else {
          cachedModelId = "llama-3.1-8b-instant"; 
      }
    }

    const systemPrompt = `You are a strict Chinese sentence generator. 
    FATAL RULE 1: The "chinese" field MUST contain EXACTLY AND ONLY Simplified Chinese characters (简体中文) and standard Chinese punctuation. ABSOLUTELY NO English letters or other scripts.
    FATAL RULE 2: The "vietnamese" field MUST be written in highly natural, fluent, and modern Vietnamese. Do not use awkward machine translations.
    Output valid JSON only.`;

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
      temperature: 0.2, 
      max_tokens: 1500,
      response_format: { type: "json_object" },
    });

    const rawText = chatCompletion.choices[0]?.message?.content || "{}";
    const parsedData = JSON.parse(rawText);
    
    if (!parsedData.chinese) {
        throw new Error("AI không tạo được câu hỏi. Đang thử lại...");
    }

    const hasChinese = /[\u4e00-\u9fa5]/.test(parsedData.chinese);
    const hasInvalidChars = /[a-zA-Z]/.test(parsedData.chinese);

    if (!hasChinese || hasInvalidChars) {
        cachedModelId = null; 
        throw new Error("AI vi phạm luật ngôn ngữ. Vui lòng thử lại.");
    }

    return NextResponse.json(parsedData);

  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Lỗi khi gọi AI" },
      { status: 500 }
    );
  }
}