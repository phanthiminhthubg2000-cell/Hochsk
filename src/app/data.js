// File: src/app/data.js

import cardsData from './cards.json';
import sentencesData from './sentences.json';
import arrangeData from './arrange.json';

// TẠO MỘT BỘ LỌC THÔNG MINH ĐỂ XÓA TRÙNG LẶP
const removeDuplicates = (array, key) => {
  const seen = new Set();
  return array.filter(item => {
    // Lấy giá trị của cột cần kiểm tra (ví dụ: chữ Hán)
    const val = item[key];
    // Nếu bị rỗng hoặc đã từng xuất hiện rồi -> Bỏ qua (không hiển thị)
    if (!val || seen.has(val)) return false; 
    // Nếu là từ mới -> Ghi nhớ vào bộ lọc và cho phép hiển thị
    seen.add(val);
    return true;
  });
};

// BƯỚC 1: LỌC SẠCH DỮ LIỆU TRƯỚC (Dựa vào chữ Hán)
// Đối với thẻ từ vựng: lọc theo cột "front"
const uniqueCards = removeDuplicates(cardsData, 'front');

// Đối với bài dịch và sắp xếp: lọc theo cột "chinese"
const uniqueSentences = removeDuplicates(sentencesData, 'chinese');
const uniqueArrangements = removeDuplicates(arrangeData, 'chinese');


// BƯỚC 2: CẤP THẺ ID CHO DANH SÁCH ĐÃ ĐƯỢC LỌC SẠCH
export const localCards = uniqueCards.map((item, index) => ({ 
  ...item, 
  id: index + 1 
}));

export const localSentences = uniqueSentences.map((item, index) => ({ 
  ...item, 
  id: index + 1 
}));

export const localArrangements = uniqueArrangements.map((item, index) => ({ 
  ...item, 
  id: index + 1 
}));