import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Thiếu API Key." }, { status: 500 });

    const genAI = new GoogleGenerativeAI(apiKey);
    // Khuyên dùng gemini-1.5-flash hoặc pro để xử lý prompt dài tốt hơn
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); 

    const body = await request.json();
    const { action, level, answers } = body;

    // ==========================================
    // KỊCH BẢN 1: TẠO ĐỀ THI ĐỘNG THEO CHUẨN HANBAN MỚI
    // ==========================================
    if (action === "generate") {
      let examRules = "";
      
      if (level === "HSK Cấp 3") {
        examRules = `
        - ĐỐI TƯỢNG: Trình độ HSK 3 (Từ vựng HSK 1-3).
        - CÂU 1-8 (type: "repeat"): Câu đơn/phức dài 10-18 chữ Hán. Đa dạng cấu trúc (因为…所以, 把, 被, so sánh). Tình huống quen thuộc (quên đồ, tắc đường, kế hoạch).
        - CÂU 9-13 (type: "picture", imageCount: 1): Tình huống đời sống (1-3 nhân vật, rõ hành động).
        - CÂU 14-15 (type: "short"): Câu 14 (Kể/Giới thiệu trải nghiệm cá nhân). Câu 15 (Lựa chọn/Sở thích và giải thích lý do).
        `;
      } else if (level === "HSK Cấp 4") {
        examRules = `
        - ĐỐI TƯỢNG: Trình độ HSK 4 (Từ vựng HSK 1-4).
        - CÂU 1-2 (type: "repeat" - Nghe thuật lại): Mỗi câu là đoạn văn 90-140 chữ Hán. Câu 1 (Câu chuyện đời sống/sự cố nhỏ). Câu 2 (Trải nghiệm có nhiều bước phát triển). Rõ bối cảnh, nhân vật, kết quả.
        - CÂU 3 (type: "picture", imageCount: 3): Chuỗi tranh kể chuyện liên tục (Mở đầu -> Vấn đề -> Giải quyết).
        - CÂU 4-5 (type: "short"): Câu 4 (Tình huống giả định/Kế hoạch giải quyết). Câu 5 (Đánh giá quan điểm/lựa chọn cá nhân). KHÔNG dùng câu hỏi quá đơn giản.
        `;
      } else if (level === "HSK Cấp 5") {
        examRules = `
        - ĐỐI TƯỢNG: Trình độ HSK 5 (Từ vựng HSK 1-5).
        - CÂU 1-2 (type: "repeat" - Nghe thuật lại): Đoạn văn 180-260 chữ Hán. Câu 1 (Trải nghiệm cá nhân sâu sắc). Câu 2 (Sự việc có yếu tố vấn đề/thông tin xã hội).
        - CÂU 3 (type: "picture", imageCount: 4): Chuỗi sự kiện phức tạp (Giới thiệu -> Vấn đề bất ngờ -> Phản ứng -> Kết quả/Bài học).
        - CÂU 4-5 (type: "short"): Câu 4 (Phân tích hiện tượng/ảnh hưởng trong cuộc sống). Câu 5 (Cách hiểu/Phản biện về một nhận định/câu nói). Yêu cầu tư duy nhiều góc độ.
        `;
      } else if (level === "HSK Cấp 6") {
        examRules = `
        - ĐỐI TƯỢNG: Trình độ HSK 6 (Từ vựng HSK 1-6). Đòi hỏi tư duy sâu, logic, phản biện.
        - CÂU 1-2 (type: "repeat" - Nghe thuật lại): Đoạn văn phức tạp, nhiều tầng diễn biến, nguyên nhân sâu xa, hoặc triết lý.
        - CÂU 3 (type: "picture", imageCount: 4): Chuỗi hình trừu tượng hoặc câu chuyện có ngụ ý sâu sắc.
        - CÂU 4-5 (type: "short"): Câu hỏi đa chiều, yêu cầu lập luận, so sánh các góc nhìn, phân tích ưu/nhược điểm và đưa ra kết luận có căn cứ.
        `;
      }

      const prompt = `Bạn là chuyên gia khảo thí HSKK cấp cao. Hãy tạo một đề thi ${level} tuân thủ NGHIÊM NGẶT các quy tắc học thuật sau:
      ${examRules}
      
      LỆNH TỐI CAO (SYSTEM DIRECTIVE): 
      KHÔNG ĐƯỢC sinh ra bất kỳ văn bản, lời chào, hay tài liệu hướng dẫn nào. 
      BẠN CHỈ ĐƯỢC PHÉP TRẢ VỀ DUY NHẤT 1 MẢNG JSON HỢP LỆ.
      
      Định dạng bắt buộc:
      [
        { "type": "repeat", "text": "<câu tiếng Trung>" },
        { "type": "picture", "text": "<Mô tả yêu cầu bằng tiếng Trung>", "imageCount": <số lượng ảnh quy định> },
        { "type": "short", "text": "<câu hỏi mở tiếng Trung>" }
      ]`;

      const result = await model.generateContent(prompt);
      let text = result.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
      return NextResponse.json(JSON.parse(text));
    } 
    
    // ==========================================
    // KỊCH BẢN 2: CHẤM ĐIỂM THEO THANG 4 MỨC ĐỘ
    // ==========================================
    if (action === "grade") {
      let scoringRubric = level === "HSK Cấp 3" ? 
        `Câu 1-8 (5đ/câu), Câu 9-13 (5đ/câu), Câu 14 (15đ), Câu 15 (20đ). Tổng 100đ.` : 
        `Câu 1-2 (10đ/câu), Câu 3 (20đ), Câu 4-5 (30đ/câu). Tổng 100đ.`;

      const promptText = `Bạn là giám khảo HSKK. Hãy nghe các file ghi âm bài thi ${level} và chấm điểm dựa trên THANG ĐÁNH GIÁ 4 MỨC sau:
      - Mức 4 (Tốt - 80-100% điểm tối đa): Đầy đủ, rõ ràng, trôi chảy, logic tốt, từ vựng phong phú.
      - Mức 3 (Khá - 60-79% điểm tối đa): Đúng trọng tâm, có phát triển ý, vài lỗi nhỏ nhưng dễ hiểu.
      - Mức 2 (Hạn chế - 40-59% điểm tối đa): Nội dung ngắn, sót ý, nhiều lỗi ngữ pháp/phát âm, nhiều khoảng dừng.
      - Mức 1 (Chưa đạt - 0-39% điểm tối đa): Sai yêu cầu, quá ngắn, không logic, khó hiểu.

      Barem điểm chuẩn: ${scoringRubric}
      
      LỆNH TỐI CAO: CHỈ TRẢ VỀ 1 ĐỐI TƯỢNG JSON. Định dạng:
      {
        "totalScore": <tổng điểm chính xác>,
        "overallFeedback": "Nhận xét tổng quan (Tiếng Việt)",
        "overallImprovement": "Lời khuyên",
        "details": [
          { "score": <điểm>, "question": "Câu 1", "feedback": "...", "improvement": "..." }
        ]
      }`;

      const parts = [{ text: promptText }];
      answers.forEach((ans, index) => {
        parts.push({ text: `Câu ${index + 1} (${ans.type}): ${ans.question}` });
        if (ans.audioBase64) {
          const base64Data = ans.audioBase64.split(',')[1];
          parts.push({ inlineData: { data: base64Data, mimeType: "audio/webm" } });
        } else {
          parts.push({ text: `(Thí sinh bỏ trống)` });
        }
      });

      const result = await model.generateContent(parts);
      let text = result.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
      return NextResponse.json(JSON.parse(text));
    }

    return NextResponse.json({ error: "Lệnh không hợp lệ" }, { status: 400 });

  } catch (error) {
    console.error("Lỗi API chi tiết:", error);
    return NextResponse.json({ error: "Lỗi kết nối máy chủ AI" }, { status: 500 });
  }
}