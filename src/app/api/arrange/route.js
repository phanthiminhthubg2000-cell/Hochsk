import { NextResponse } from "next/server";
import { getRandomTopic } from "../../../topic-engine/topicPool";

export async function POST(req) {
  try {
    const { level = "HSK 1", recentSituations = [] } = await req.json();

    // Code tự động chọn chủ đề từ kho, loại trừ các tình huống vừa học gần đây
    const selectedTopic = getRandomTopic(recentSituations);

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
            content: `Bạn là giáo viên tiếng Trung. Hãy tạo MỘT câu luyện sắp xếp từ vựng dựa trên bối cảnh cho trước.
            
            THÔNG TIN BẮT BUỘC:
            - Cấp độ: ${level}
            - Nhóm chủ đề: ${selectedTopic.group}
            - Chủ đề: ${selectedTopic.topic}
            - Tình huống thực tế: ${selectedTopic.situation}
            
            YÊU CẦU KỸ THUẬT:
            1. Độ dài câu: Từ 5 đến 10 chữ Hán.
            2. Nội dung câu phải phản ánh chính xác tình huống: "${selectedTopic.situation}".
            3. Dịch nghĩa tiếng Việt cực kỳ tự nhiên, mượt mà.

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
            content: `Hãy tạo một câu sắp xếp cho cấp độ ${level} theo tình huống: ${selectedTopic.situation}`
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
    
    // Gửi kèm theo trường "situation" để Frontend lưu vết chống lặp
    return NextResponse.json({ ...parsedData, situation: selectedTopic.situation });
    
  } catch (error) {
    console.error("Lỗi API Arrange Chi Tiết:", error);
    return NextResponse.json({ error: "Lỗi tạo câu Sắp xếp từ phía AI" }, { status: 500 });
  }
}