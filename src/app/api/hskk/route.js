import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// Thuật toán Fisher-Yates xáo trộn ngẫu nhiên
const shuffleArray = (array) => {
  if (!Array.isArray(array)) return [];
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
    // LOGIC BỐC ĐỀ THI (GENERATE) - KHÔNG DÙNG AI
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

        // XỬ LÝ CẤU TRÚC JSON MỚI: Bóc tách mảng từ thuộc tính .questions nếu nó là Object
        const getQuestionsArray = (data) => {
          if (Array.isArray(data)) return data;
          if (data && Array.isArray(data.questions)) return data.questions;
          return [];
        };

        const repeatArray = getQuestionsArray(repeatData);
        const pictureArray = getQuestionsArray(pictureData);
        const shortArray = getQuestionsArray(shortData);

        // Bọc chuỗi văn bản thuần túy vào Object, đồng thời chuẩn hóa đường dẫn ảnh sang /hskk/hskk3/
        const formatQuestion = (q, type) => {
          let formatted = typeof q === 'string' ? { text: q, type } : { ...q, type };

          if (type === 'picture') {
            let imgPath = formatted.image || (formatted.images && formatted.images[0]) || "";
            
            // Xử lý chuẩn hóa đường dẫn để khớp với thư mục public/hskk/hskk3/
            if (imgPath.includes('/hskk/hskk3/')) {
              // Đã đúng định dạng
            } else if (imgPath.includes('/hskk3/')) {
              imgPath = imgPath.replace('/hskk3/', '/hskk/hskk3/');
            } else if (imgPath.includes('/hskk/')) {
              imgPath = imgPath.replace('/hskk/', '/hskk/hskk3/');
            } else if (imgPath && !imgPath.startsWith('/')) {
              imgPath = `/hskk/hskk3/${imgPath}`;
            } else if (!imgPath) {
              imgPath = "/hskk/hskk3/hsk3_pic_001.jpg"; // Fallback an toàn nếu thiếu ảnh
            }
            
            formatted.images = [imgPath];
            formatted.image = imgPath;
          }

          return formatted;
        };

        // Chuẩn HSKK 3: Bốc ngẫu nhiên 8 câu nhắc lại, 5 câu tranh, 2 câu trả lời ngắn
        const selectedRepeat = shuffleArray(repeatArray).slice(0, 8).map(q => formatQuestion(q, 'repeat'));
        const selectedPicture = shuffleArray(pictureArray).slice(0, 5).map(q => formatQuestion(q, 'picture'));
        const selectedShort = shuffleArray(shortArray).slice(0, 2).map(q => formatQuestion(q, 'short'));

        // Gộp lại thành 1 đề thi hoàn chỉnh
        const fullExam = [...selectedRepeat, ...selectedPicture, ...selectedShort];
        return NextResponse.json(fullExam);

      } catch (fileError) {
        console.error("Lỗi không tìm thấy file JSON:", fileError);
        return NextResponse.json({ error: "Không tìm thấy dữ liệu đề thi JSON." }, { status: 404 });
      }
    }

    return NextResponse.json({ error: "Hành động không hợp lệ" }, { status: 400 });

  } catch (error) {
    console.error("Lỗi Server API HSKK:", error);
    return NextResponse.json({ error: "Lỗi hệ thống: " + error.message }, { status: 500 });
  }
}