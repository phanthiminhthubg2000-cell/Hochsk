import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

export async function POST(req) {
  try {
    if (!apiKey) {
      return NextResponse.json({ error: "Chưa cấu hình GEMINI_API_KEY" }, { status: 500 });
    }

    const { level = "HSK 1", recentSentences = [] } = await req.json();
    const shortHistory = recentSentences.slice(-5);

    // CHỈ SỬ DỤNG GEMINI 3.7 FLASH - Đã được xác nhận có sẵn trong tài khoản của bạn
    const model = genAI.getGenerativeModel({ 
      model: "gemini-3.7-flash",
      generationConfig: {
          responseMimeType: "application/json",
          maxOutputTokens: 150,
          temperature: 0.7
      }
    });

    const prompt = `Tạo 1 câu giao tiếp tiếng Trung luyện nghe chép (Từ vựng ${level}, 6-12 chữ). Không trùng với: [${shortHistory.join(",")}]. Chỉ trả về chuỗi JSON thuần túy: {"chinese":"","pinyin":"","vietnamese":""}`;

    const result = await model.generateContent(prompt);
    let rawText = result.response.text();

    // Làm sạch chuỗi JSON đề phòng AI bọc markdown
    rawText = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
    
    // Thuật toán bóc tách đúng object JSON
    const startIndex = rawText.indexOf('{');
    const endIndex = rawText.lastIndexOf('}') + 1;
    if (startIndex !== -1 && endIndex !== -1) {
        rawText = rawText.slice(startIndex, endIndex);
    }

    try {
      const parsedData = JSON.parse(rawText);
      return NextResponse.json(parsedData);
    } catch (parseErr) {
      console.error("Lỗi JSON Parse:", rawText);
      return NextResponse.json({ error: "Lỗi định dạng dữ liệu từ AI" }, { status: 500 });
    }

  } catch (error) {
    console.error("Lỗi chi tiết từ Gemini API:", error);
    return NextResponse.json(
      { error: error?.message || "Lỗi không xác định khi gọi AI" },
      { status: 500 }
    );
  }
}