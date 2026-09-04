import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Khởi tạo Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Thuật toán Fisher-Yates xáo trộn ngẫu nhiên
const shuffleArray = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export async function POST(req) {
  try {
    const body = await req.json();

    // ==========================================
    // 1. LOGIC BỐC ĐỀ THI (GENERATE)
    // ==========================================
    if (body.action === "generate") {
      const dataDir = path.join(process.cwd(), 'src', 'app', 'data', 'hskk', 'hskk3');

      try {
        const [repeatRaw, pictureRaw, shortRaw] = await Promise.all([
          fs.readFile(path.join(dataDir, 'repeat.json'), 'utf-8'),
          fs.readFile(path.join(dataDir, 'picture.json'), 'utf-8'),
          fs.readFile(path.join(dataDir, 'short.json'), 'utf-8')
        ]);

        const repeatData = JSON.parse(repeatRaw);
        const pictureData = JSON.parse(pictureRaw);
        const shortData = JSON.parse(shortRaw);

        // Bọc chuỗi văn bản thuần túy vào Object để Frontend hiển thị được
        const formatQuestion = (q, type) => {
          if (typeof q === 'string') return { text: q, type };
          return { ...q, type };
        };

        // Chuẩn HSKK 3: 8 câu nhắc lại, 5 câu tranh, 2 câu trả lời ngắn
        const selectedRepeat = shuffleArray(repeatData).slice(0, 8).map(q => formatQuestion(q, 'repeat'));
        const selectedPicture = shuffleArray(pictureData).slice(0, 5).map(q => formatQuestion(q, 'picture'));
        const selectedShort = shuffleArray(shortData).slice(0, 2).map(q => formatQuestion(q, 'short'));

        const fullExam = [...selectedRepeat, ...selectedPicture, ...selectedShort];
        return NextResponse.json(fullExam);

      } catch (fileError) {
        console.error("Lỗi không tìm thấy file JSON:", fileError);
        return NextResponse.json({ error: "Không tìm thấy dữ liệu đề thi JSON." }, { status: 404 });
      }
    }

    // ==========================================
    // 2. LOGIC CHẤM ĐIỂM BẰNG GEMINI (GRADE)
    // ==========================================
    if (body.action === "grade") {
      const { level, answers } = body;

      if (!process.env.GEMINI_API_KEY) {
        return NextResponse.json({ error: "Chưa cấu hình GEMINI_API_KEY trong .env.local" }, { status: 500 });
      }

      const model = genAI.getGenerativeModel({
        model: "gemini-3.6-flash",
        generationConfig: { responseMimeType: "application/json" }
      });

      // Tạo prompt chuẩn khảo thí HSKK, ép AI phải chấm điểm thực tế
      const promptText = `
Bạn là giám khảo chấm thi khẩu ngữ tiếng Trung HSKK (${level}).
Dưới đây là danh sách các câu hỏi và các file ghi âm bài làm của thí sinh tương ứng theo thứ tự.
Tiêu chí chấm thi:
1. Phần Repeat (Nghe nhắc lại): Độ chính xác về từ vựng, thanh điệu (thanh 1, 2, 3, 4, khinh thanh) và ngữ điệu.
2. Phần Picture (Nhìn tranh nói) & Short (Trả lời câu hỏi): Độ lưu loát, dùng từ vựng đúng ngữ cảnh, ngữ pháp câu, nói đủ ý.

YÊU CẦU BẮT BUỘC: 
- Lắng nghe kỹ từng file âm thanh để chấm điểm thực tế. Tự động trừ điểm nếu thí sinh ngập ngừng, phát âm sai hoặc không trả lời.
- Tuyệt đối không sao chép số điểm ví dụ.
- Chỉ trả về kết quả theo ĐÚNG định dạng JSON sau (không thêm markdown, không thêm text thừa):
{
  "totalScore": <Tổng điểm tính toán thực tế từ 0 đến 100>,
  "overallFeedback": "<Đánh giá tổng quan điểm mạnh và điểm cần cải thiện bằng tiếng Việt>",
  "details": [
    {
      "question": "<Nội dung câu hỏi>",
      "score": <Điểm thực tế của câu này>,
      "feedback": "<Nhận xét chi tiết về phát âm/nội dung câu này bằng tiếng Việt>"
    }
  ]
}
`;

      const promptParts = [{ text: promptText }];

      // Đưa từng câu hỏi kèm file audio tương ứng vào payload gửi Gemini
      answers.forEach((ans, index) => {
        promptParts.push({
          text: `\n--- Câu hỏi ${index + 1} (${ans.type}): "${ans.question}" ---`
        });

        if (ans.audioBase64 && ans.audioBase64.includes(",")) {
          const base64Data = ans.audioBase64.split(",")[1];
          promptParts.push({
            inlineData: {
              mimeType: "audio/webm",
              data: base64Data
            }
          });
        } else {
          promptParts.push({ text: "[Thí sinh không ghi âm hoặc không có âm thanh cho câu này]" });
        }
      });

      const result = await model.generateContent(promptParts);
      const responseText = result.response.text();
      const parsedResult = JSON.parse(responseText);

      return NextResponse.json(parsedResult);
    }

    return NextResponse.json({ error: "Hành động không hợp lệ" }, { status: 400 });

  } catch (error) {
    console.error("Lỗi Server API HSKK:", error);
    return NextResponse.json({ error: "Lỗi hệ thống khi chấm điểm bằng AI: " + error.message }, { status: 500 });
  }
}