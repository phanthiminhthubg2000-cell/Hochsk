import { NextResponse } from "next/server";
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || "",
});

let cachedModelId = null;

// TỪ ĐIỂN CẤU HÌNH YÊU CẦU CHO TỪNG CẤP ĐỘ HSK
const LEVEL_CONFIGS = {
  "HSK 1": {
    length: "6 đến 12 chữ Hán",
    topics: "Chào hỏi (xin chào, cảm ơn, tạm biệt), Giới thiệu bản thân (tên, tuổi, quốc tịch, nghề nghiệp), Gia đình (bố, mẹ, nhà), Ăn uống và mua sắm (hỏi giá, ăn uống), Thời gian và sinh hoạt (giờ giấc, ngày tháng)."
  },
  "HSK 2": {
    length: "12 đến 20 chữ Hán",
    topics: "Du lịch (sở thích đi chơi, thời tiết, thăm thành phố), Công việc và học tập (giới thiệu công việc, đồng nghiệp, trường lớp, kỳ thi), Sở thích cá nhân (thể thao, nấu ăn, mua sắm, thú cưng), Cuộc sống hằng ngày (gia đình, bạn bè, thói quen, thời gian biểu)."
  },
  "HSK 3": {
    length: "20 đến 30 chữ Hán",
    topics: "Học tập và công việc (trường lớp, thầy cô, môn học, dự định tương lai), Gia đình và bạn bè (giới thiệu thành viên, tính cách, mối quan hệ), Sở thích và giải trí (thể thao, đọc sách, nghe nhạc, xem phim), Ăn uống và mua sắm (món ăn yêu thích, gọi món, đi siêu thị), Thời tiết và du lịch."
  },
  "HSK 4": {
    length: "30 đến 45 chữ Hán",
    topics: "Giới thiệu bản thân/thói quen sinh hoạt; Công việc và học tập (phỏng vấn, kế hoạch tương lai, kinh nghiệm); Đời sống (lên kế hoạch du lịch, mua sắm, thể thao); Cảm xúc và quan điểm sống (tình bạn, tình yêu, vượt qua nỗi buồn, trải nghiệm)."
  },
  "HSK 5": {
    length: "45 đến 65 chữ Hán",
    topics: "Giáo dục & Phát triển bản thân (cách học, kỹ năng sống, quản lý thời gian); Công việc & Sự nghiệp (môi trường công sở, xu hướng làm việc, cân bằng cuộc sống); Vấn đề xã hội (công nghệ, AI, đô thị hóa, môi trường); Văn hóa & Giá trị truyền thống."
  },
  "HSK 6": {
    length: "65 đến 90 chữ Hán",
    topics: "Văn hóa, Lịch sử nghệ thuật Trung Quốc (di sản, danh nhân, thành ngữ); Triết lý cuộc sống & Tâm lý học (bài học nhân sinh, giá trị tinh thần); Xã hội & Môi trường (đô thị hóa, giáo dục, biến đổi khí hậu); Khoa học, Công nghệ và Kinh tế."
  }
};

export async function POST(req) {
  try {
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: "Chưa cấu hình GROQ_API_KEY" }, { status: 500 });
    }

    const body = await req.json();
    const { level = "HSK 1", recentSentences = [] } = body;
    const shortHistory = recentSentences.slice(-5);

    // Lấy cấu hình độ dài và chủ đề tương ứng với Level người dùng đang chọn
    const config = LEVEL_CONFIGS[level] || LEVEL_CONFIGS["HSK 1"];

    if (!cachedModelId) {
      const modelsPage = await groq.models.list();
      const activeModels = modelsPage.data;
      
      const textModels = activeModels.filter(m => 
          !m.id.includes("/") && 
          !m.id.includes("whisper") && 
          !m.id.includes("guard") 
      );
      
      const preferredModels = textModels.filter(m => m.id.includes("llama-3.1-8b") || m.id.includes("llama-3.3"));
      
      if (preferredModels.length > 0) {
          cachedModelId = preferredModels[0].id;
      } else if (textModels.length > 0) {
          cachedModelId = textModels[0].id;
      } else {
          cachedModelId = "llama-3.1-8b-instant"; 
      }
      console.log("🤖 [Dictation] Đang dùng Model Text:", cachedModelId);
    }

    // PROMPT LINH HOẠT THEO CẤP ĐỘ
    const prompt = `Bạn là một chuyên gia ra đề thi tiếng Trung Quốc (Simplified Chinese) bản xứ.
    Hãy tạo 1 câu (hoặc đoạn văn ngắn) để học sinh luyện nghe chép chính tả. Bạn PHẢI tuân thủ NGHIÊM NGẶT các quy tắc sau:

    1. Cấp độ từ vựng: 100% chữ Hán phải nằm TRONG PHẠM VI từ vựng của ${level}. TUYỆT ĐỐI KHÔNG dùng từ của HSK cao hơn.
    2. Độ dài bắt buộc: Đoạn văn/câu phải có độ dài từ ${config.length}. Không được viết quá ngắn.
    3. Chủ đề nội dung: Chọn NGẪU NHIÊN 1 khía cạnh trong các chủ đề sau để nội dung luôn mới mẻ, thực tế: [${config.topics}].
    4. Cấm trùng lặp: Không được viết lại nội dung có ý nghĩa tương tự các câu này: [${shortHistory.join(",")}].
    5. Ngôn ngữ: Chỉ dùng Tiếng Trung và Tiếng Việt.

    Chỉ trả về DUY NHẤT một đối tượng JSON thuần túy (không bọc trong markdown \`\`\`json, không giải thích):
    {"chinese": "<câu tiếng Trung>", "pinyin": "<phiên âm pinyin>", "vietnamese": "<dịch nghĩa tiếng Việt tự nhiên>"}`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: cachedModelId,
      temperature: 0.8, // Tăng lên 0.8 để AI sáng tạo nhiều ý tưởng đa dạng hơn trong chủ đề
      max_tokens: 1500, // Tăng giới hạn token vì các câu HSK5, 6 sẽ rất dài
      response_format: { type: "json_object" },
    });

    const rawText = chatCompletion.choices[0]?.message?.content || "{}";
    const parsedData = JSON.parse(rawText);
    
    if (!parsedData.chinese || parsedData.chinese.length < 3) {
        throw new Error("AI tạo câu quá ngắn hoặc sai định dạng.");
    }

    return NextResponse.json(parsedData);

  } catch (error) {
    console.error("Lỗi chi tiết từ Groq API (Dictation):", error);
    
    if (error?.message?.includes("terms") || error?.message?.includes("decommissioned") || error?.message?.includes("support") || error?.status === 404 || error?.status === 400) {
        cachedModelId = null; 
    }

    return NextResponse.json(
      { error: error?.message || "Lỗi khi gọi AI" },
      { status: 500 }
    );
  }
}