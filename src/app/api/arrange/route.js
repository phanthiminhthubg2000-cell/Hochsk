import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req) {
  try {
    const { level = "HSK 1", recentSentences = [] } = await req.json();
    const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });

    const prompt = `
      Bạn là giáo viên tiếng Trung. Hãy tạo MỘT câu ngẫu nhiên để học sinh luyện trò chơi SẮP XẾP TỪ VỰNG.
      Yêu cầu:
      1. Từ vựng: Chỉ dùng từ thuộc ${level} trở xuống. Ưu tiên các câu có cấu trúc ngữ pháp rõ ràng.
      2. Độ dài: 5 đến 10 chữ (ngắn hơn để dễ xếp).
      3. Tuyệt đối không trùng với: [${recentSentences.join(" | ")}].
      4. Chỉ trả về JSON thuần túy: {"chinese": "...","pinyin": "...","vietnamese": "..."}
    `;

    let text = (await model.generateContent(prompt)).response.text();
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return NextResponse.json(JSON.parse(text));
  } catch (error) {
    return NextResponse.json({ error: "Lỗi tạo câu Sắp xếp" }, { status: 500 });
  }
}