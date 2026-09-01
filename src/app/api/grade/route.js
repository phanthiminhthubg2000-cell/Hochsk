import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { vietnamese, userTranslation } = await req.json();

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ isCorrect: false, feedback: "Thiếu GEMINI_API_KEY trong .env.local" });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // Sử dụng model 2.0-flash mới nhất, miễn phí và hỗ trợ đầy đủ
    const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });

    const prompt = `
    Bạn là giáo viên tiếng Trung.
    Câu tiếng Việt: "${vietnamese}"
    Học sinh dịch: "${userTranslation}"
    
    Hãy chấm điểm. Trả về đúng định dạng JSON:
    {"isCorrect": true/false, "feedback": "Nhận xét ngắn bằng tiếng Việt"}
    `;

    const result = await model.generateContent(prompt);
    let text = result.response.text();
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    
    const data = JSON.parse(text);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Lỗi AI:", error);
    return NextResponse.json({ isCorrect: false, feedback: "Lỗi AI: " + error.message });
  }
}