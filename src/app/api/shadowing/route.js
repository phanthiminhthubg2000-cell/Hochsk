import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Thiếu API Key." }, { status: 500 });

    const genAI = new GoogleGenerativeAI(apiKey);
    // Sử dụng model bạn yêu cầu
    const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });

    const body = await request.json();
    const { targetText, audioBase64 } = body;

    const promptText = `Bạn là chuyên gia phát âm tiếng Trung. Hãy nghe file ghi âm của người học và so sánh với từ/câu gốc sau: "${targetText}".
    
    YÊU CẦU:
    1. Chấm điểm phát âm, thanh điệu trên thang điểm 100.
    2. Chỉ ra lỗi sai (nếu có) và cách khắc phục.
    
    TRẢ VỀ MỘT OBJECT JSON HỢP LỆ (Không dùng markdown):
    {
      "score": 85,
      "feedback": "Phát âm tốt, nhưng thanh 4 của từ thứ hai chưa đủ mạnh. Hãy đọc dứt khoát hơn."
    }`;

    const parts = [
      { text: promptText },
      { inlineData: { data: audioBase64.split(',')[1], mimeType: "audio/webm" } }
    ];

    const result = await model.generateContent(parts);
    let text = result.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
    
    return NextResponse.json(JSON.parse(text));
  } catch (error) {
    console.error("Lỗi Shadowing API:", error);
    return NextResponse.json({ error: "Lỗi chấm điểm AI" }, { status: 500 });
  }
}