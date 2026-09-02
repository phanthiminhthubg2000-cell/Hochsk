import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Thiếu API Key." }, { status: 500 });

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });

    const body = await request.json();
    const { action, level, answers } = body;

    // ==========================================
    // KỊCH BẢN 1: TẠO ĐỀ THI
    // ==========================================
    if (action === "generate") {
      let examStructure = "";
      if (level === "HSK Cấp 3") {
        examStructure = `Tạo ĐÚNG 15 câu: 8 câu type "repeat" (nhắc lại ngắn gọn), 5 câu type "picture" (miêu tả 1 tranh độc lập, bắt buộc imageCount: 1), 2 câu type "short" (trả lời câu hỏi).`;
      } else if (level === "HSK Cấp 4") {
        examStructure = `Tạo ĐÚNG 5 câu: 2 câu type "repeat" (nhắc lại), 1 câu type "picture" (kể chuyện liên kết qua 3 bức tranh, bắt buộc imageCount: 3), 2 câu type "short" (trả lời câu hỏi).`;
      } else if (level === "HSK Cấp 5") {
        examStructure = `Tạo ĐÚNG 5 câu: 2 câu type "repeat", 1 câu type "picture" (tư duy logic qua 3 bức tranh, bắt buộc imageCount: 3), 2 câu type "short".`;
      } else if (level === "HSK Cấp 6") {
        examStructure = `Tạo ĐÚNG 5 câu: 2 câu type "repeat", 1 câu type "picture" (tư duy sâu qua 4 bức tranh logic, bắt buộc imageCount: 4), 2 câu type "short".`;
      }

      const prompt = `Bạn là chuyên gia khảo thí HSKK. Hãy tạo một đề thi ${level}.
      YÊU CẦU: Từ vựng và ngữ pháp PHẢI NẰM NGHIÊM NGẶT TRONG GIỚI HẠN của ${level}.
      CẤU TRÚC BẮT BUỘC: ${examStructure}
      
      TRẢ VỀ CHỈ MỘT MẢNG JSON HỢP LỆ, không có markdown.
      Định dạng bắt buộc:
      [
        { "type": "repeat", "text": "câu tiếng Trung..." },
        { "type": "picture", "text": "Yêu cầu...", "imageCount": 3 },
        { "type": "short", "text": "câu hỏi mở..." }
      ]`;

      const result = await model.generateContent(prompt);
      let text = result.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
      return NextResponse.json(JSON.parse(text));
    } 
    
    // ==========================================
    // KỊCH BẢN 2: CHẤM ĐIỂM THEO ĐÚNG BAREM
    // ==========================================
    if (action === "grade") {
      let scoringRubric = "";
      
      if (level === "HSK Cấp 3") {
        scoringRubric = `
        - 8 câu đầu (Nhắc lại): Tối đa 5 điểm / 1 câu.
        - 5 câu tiếp theo (Nhìn tranh): Tối đa 5 điểm / 1 câu.
        - 2 câu cuối (Trả lời): Câu thứ nhất (câu 14) tối đa 15 điểm, Câu thứ hai (câu 15) tối đa 20 điểm.
        `;
      } else {
        scoringRubric = `
        - 2 câu đầu (Nhắc lại): Tối đa 10 điểm / 1 câu.
        - 1 câu giữa (Nhìn tranh): Tối đa 20 điểm.
        - 2 câu cuối (Trả lời): Tối đa 30 điểm / 1 câu.
        `;
      }

      const promptText = `Bạn là giám khảo HSKK. Hãy nghe các file ghi âm bài thi ${level} của thí sinh và chấm điểm.
      Thí sinh không được gõ chữ, bài làm hoàn toàn là file âm thanh.
      
      HỆ THỐNG TÍNH ĐIỂM BẮT BUỘC (Tổng 100 điểm):
      ${scoringRubric}
      
      YÊU CẦU CHẤM ĐIỂM NGHIÊM NGẶT:
      1. Cho điểm (score) từng câu DỰA TRÊN ĐÚNG MỨC ĐIỂM TỐI ĐA quy định ở trên. Tuyệt đối không cho quá điểm tối đa của câu đó.
      2. Biến "totalScore" BẮT BUỘC phải bằng TỔNG CỘNG ĐIỂM của tất cả các câu trong phần "details".
      3. Đưa ra nhận xét chi tiết và cách cải thiện cho từng câu.
      
      TRẢ VỀ CHỈ MỘT OBJECT JSON HỢP LỆ, không có markdown. Định dạng mẫu:
      {
        "totalScore": 85,
        "overallFeedback": "Nhận xét tổng quan bài làm (Tiếng Việt)...",
        "overallImprovement": "Cách cải thiện tổng thể...",
        "details": [
          { "score": 5, "question": "Câu 1", "feedback": "Nhận xét...", "improvement": "Cách sửa..." }
        ]
      }`;

      const parts = [{ text: promptText }];
      answers.forEach((ans, index) => {
        parts.push({ text: `Câu ${index + 1} (${ans.type}): ${ans.question}` });
        if (ans.audioBase64) {
          const base64Data = ans.audioBase64.split(',')[1];
          parts.push({ inlineData: { data: base64Data, mimeType: "audio/webm" } });
        } else {
          parts.push({ text: `(Thí sinh không có file ghi âm)` });
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