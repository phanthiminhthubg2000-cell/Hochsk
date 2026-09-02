import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { level = "HSK 1", recentSentences = [] } = await req.json();

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b",
        messages: [
          {
            role: "system",
            content: `Bạn là giáo viên tiếng Trung. Hãy tạo MỘT câu ngẫu nhiên để học sinh luyện trò chơi SẮP XẾP TỪ VỰNG.
            
            YÊU CẦU:
            1. Cấp độ: Chỉ dùng từ vựng thuộc cấp độ được yêu cầu. Ưu tiên các câu giao tiếp cơ bản, cấu trúc rõ ràng.
            2. Độ dài: Từ 5 đến 10 chữ.
            3. Không tạo lại các câu sau đây: [${recentSentences.join(" | ")}].
            4. DỊCH THUẬT: Dịch sang tiếng Việt cực kỳ tự nhiên, mượt mà.

            QUY TẮC BẮT BUỘC: Bạn PHẢI trả về ĐÚNG định dạng JSON thuần túy, tuyệt đối không kèm theo bất kỳ văn bản giải thích hay markdown nào khác ngoài JSON.
            Cấu trúc JSON bắt buộc:
            {
              "chinese": "今天我很高兴见到您",
              "pinyin": "jīn tiān wǒ hěn gāo xìng jiàn dào nín",
              "vietnamese": "Hôm nay tôi rất vui khi được gặp bạn."
            }`
          },
          {
            role: "user",
            content: `Hãy tạo một câu sắp xếp cho cấp độ: ${level}`
          }
        ]
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Lỗi từ Groq API:", data);
      return NextResponse.json({ error: "Lỗi từ Groq API" }, { status: 500 });
    }

    let text = data.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error("AI trả về rỗng");
    }

    // Làm sạch chuỗi JSON phòng hờ AI bọc trong markdown
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    
    const jsonStartIndex = text.indexOf('{');
    const jsonEndIndex = text.lastIndexOf('}');
    
    if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
      text = text.substring(jsonStartIndex, jsonEndIndex + 1);
    }

    const parsedData = JSON.parse(text);
    return NextResponse.json(parsedData);
    
  } catch (error) {
    console.error("Lỗi API Arrange Chi Tiết:", error);
    return NextResponse.json({ error: "Lỗi tạo câu Sắp xếp từ phía AI" }, { status: 500 });
  }
}