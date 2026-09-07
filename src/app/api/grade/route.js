import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Thiếu API Key." }, { status: 500 });

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-3.8-flash" });

    const body = await request.json();
    const { action, level, answers } = body;

    // ==========================================
    // KỊCH BẢN 1: TẠO ĐỀ THI ĐÚNG CẤU TRÚC
    // ==========================================
    if (action === "generate") {
      let examStructure = "";
      if (level === "HSK Cấp 3") {
        examStructure = `Tạo ĐÚNG 15 câu: 8 câu nhắc lại (ngắn gọn), 5 câu miêu tả tranh, 2 câu trả lời câu hỏi.`;
      } else if (level === "HSK Cấp 4") {
        examStructure = `Tạo ĐÚNG 7 câu: 2 câu nhắc lại, 3 câu miêu tả tranh (có tính liên kết), 2 câu trả lời câu hỏi.`;
      } else if (level === "HSK Cấp 5") {
        examStructure = `Tạo ĐÚNG 7 câu: 2 câu nhắc lại, 3 câu miêu tả tranh logic, 2 câu trả lời câu hỏi dài.`;
      } else if (level === "HSK Cấp 6") {
        examStructure = `Tạo ĐÚNG 8 câu: 2 câu nhắc lại, 4 câu miêu tả tranh logic, 2 câu trả lời câu hỏi tư duy sâu.`;
      }

      const prompt = `Bạn là chuyên gia khảo thí HSKK. Hãy tạo một đề thi ${level}.
      YÊU CẦU: Từ vựng và ngữ pháp PHẢI NẰM NGHIÊM NGẶT TRONG GIỚI HẠN của ${level}.
      CẤU TRÚC BẮT BUỘC: ${examStructure}
      
      TRẢ VỀ CHỈ MỘT MẢNG JSON HỢP LỆ, không có markdown.
      Định dạng bắt buộc:
      [
        { "type": "repeat", "text": "câu tiếng Trung..." },
        { "type": "picture", "text": "miêu tả..." },
        { "type": "short", "text": "câu hỏi mở..." }
      ]`;

      const result = await model.generateContent(prompt);
      let text = result.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
      return NextResponse.json(JSON.parse(text));
    } 
    
    // ==========================================
    // KỊCH BẢN 2: CHẤM ĐIỂM THANG 100 KÈM CẢI THIỆN
    // ==========================================
    if (action === "grade") {
      const promptText = `Bạn là giám khảo HSKK. Hãy nghe các file ghi âm bài thi ${level} của thí sinh và chấm điểm.
      Thí sinh không được gõ chữ, bài làm hoàn toàn là file âm thanh (đã được đính kèm).
      
      YÊU CẦU CHẤM ĐIỂM NGHIÊM NGẶT:
      1. Chấm điểm tổng trên thang điểm 100.
      2. Đưa ra nhận xét chi tiết (Feedback) và hướng dẫn cách cải thiện (Improvement).
      
      TRẢ VỀ CHỈ MỘT OBJECT JSON HỢP LỆ, không có markdown. Định dạng:
      {
        "totalScore": 85,
        "overallFeedback": "Nhận xét tổng quan bài làm (Tiếng Việt)...",
        "overallImprovement": "Cách cải thiện tổng thể để đạt điểm cao hơn...",
        "details": [
          { 
            "score": 15, 
            "question": "Câu 1", 
            "feedback": "Nhận xét chi tiết file ghi âm này...",
            "improvement": "Cách sửa lỗi phát âm/ngữ pháp..."
          }
        ]
      }`;

      const parts = [{ text: promptText }];
      answers.forEach((ans, index) => {
        parts.push({ text: `Câu ${index + 1} (${ans.type}): ${ans.question}` });
        if (ans.audioBase64) {
          const base64Data = ans.audioBase64.split(',')[1];
          parts.push({
            inlineData: { data: base64Data, mimeType: "audio/webm" }
          });
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