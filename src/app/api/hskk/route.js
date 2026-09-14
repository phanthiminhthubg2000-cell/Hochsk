import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

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

    if (body.action === "generate") {
      // Xác định thư mục dữ liệu dựa theo cấp độ học viên chọn (Mặc định hskk3 nếu không truyền)
      const levelFolder = body.level === "HSK Cấp 4" ? "hskk4" : "hskk3";
      const dataDir = path.join(process.cwd(), 'src', 'app', 'data', 'hskk', levelFolder);

      try {
        const [repeatRaw, pictureRaw, shortRaw] = await Promise.all([
          fs.readFile(path.join(dataDir, 'repeat.json'), 'utf-8'),
          fs.readFile(path.join(dataDir, 'picture.json'), 'utf-8'),
          fs.readFile(path.join(dataDir, 'short.json'), 'utf-8')
        ]);

        const repeatData = JSON.parse(repeatRaw);
        const pictureData = JSON.parse(pictureRaw);
        const shortData = JSON.parse(shortRaw);

        const getQuestionsArray = (data) => {
          if (Array.isArray(data)) return data;
          if (data && Array.isArray(data.questions)) return data.questions;
          return [];
        };

        const repeatArray = getQuestionsArray(repeatData);
        const pictureArray = getQuestionsArray(pictureData);
        const shortArray = getQuestionsArray(shortData);

        const formatQuestion = (q, type, lvlFolder) => {
          let formatted = typeof q === 'string' ? { text: q, type } : { ...q, type };

          if (type === 'picture') {
            let imgPath = formatted.image || (formatted.images && formatted.images[0]) || "";
            
            if (imgPath.includes(`/hskk/${lvlFolder}/`)) {
              // Đã đúng định dạng
            } else if (imgPath.includes(`/${lvlFolder}/`)) {
              imgPath = imgPath.replace(`/${lvlFolder}/`, `/hskk/${lvlFolder}/`);
            } else if (imgPath.includes('/hskk/')) {
              imgPath = imgPath.replace('/hskk/', `/hskk/${lvlFolder}/`);
            } else if (imgPath && !imgPath.startsWith('/')) {
              imgPath = `/hskk/${lvlFolder}/${imgPath}`;
            } else if (!imgPath) {
              imgPath = `/hskk/${lvlFolder}/hsk4_pic_001.jpg`;
            }
            
            formatted.images = [imgPath];
            formatted.image = imgPath;
          }

          return formatted;
        };

        // Cấu hình số lượng câu hỏi theo cấp độ
        let selectedRepeat, selectedPicture, selectedShort;
        if (levelFolder === "hskk4") {
          // HSKK 4: Tùy chỉnh số lượng câu theo chuẩn đề thi cấp 4
          selectedRepeat = shuffleArray(repeatArray).slice(0, 10).map(q => formatQuestion(q, 'repeat', levelFolder));
          selectedPicture = shuffleArray(pictureArray).slice(0, 2).map(q => formatQuestion(q, 'picture', levelFolder));
          selectedShort = shuffleArray(shortArray).slice(0, 2).map(q => formatQuestion(q, 'short', levelFolder));
        } else {
          // HSKK 3
          selectedRepeat = shuffleArray(repeatArray).slice(0, 8).map(q => formatQuestion(q, 'repeat', levelFolder));
          selectedPicture = shuffleArray(pictureArray).slice(0, 5).map(q => formatQuestion(q, 'picture', levelFolder));
          selectedShort = shuffleArray(shortArray).slice(0, 2).map(q => formatQuestion(q, 'short', levelFolder));
        }

        const fullExam = [...selectedRepeat, ...selectedPicture, ...selectedShort];
        return NextResponse.json(fullExam);

      } catch (fileError) {
        console.error("Lỗi không tìm thấy file JSON:", fileError);
        return NextResponse.json({ error: "Không tìm thấy dữ liệu đề thi JSON của cấp độ này." }, { status: 404 });
      }
    }

    return NextResponse.json({ error: "Hành động không hợp lệ" }, { status: 400 });

  } catch (error) {
    console.error("Lỗi Server API HSKK:", error);
    return NextResponse.json({ error: "Lỗi hệ thống: " + error.message }, { status: 500 });
  }
}