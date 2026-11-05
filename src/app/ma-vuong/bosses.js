// Ma Vương mỗi cảnh giới — kiểm tra tổng hợp có thanh HP (v2 · giai đoạn C)
// hue: xoay màu ảnh /tt/mavuong.jpg để mỗi Ma Vương một sắc
export const BOSSES = [
  { idx: 0, vn: "Âm Luật Tiểu Yêu", zh: "音律小妖", lv: "hsk1", modes: ["am", "nghia"], hp: 600, hue: 120, line: "Ngươi còn chưa đọc nổi một thanh điệu!" },
  { idx: 1, vn: "Độc Nhãn Hổ · Hán Tự Ma Vương", zh: "汉字魔王", lv: "hsk1", modes: ["nghia", "han", "am"], hp: 1000, hue: 0, line: "Một con mắt của ta đủ thấy ngươi quên chữ." },
  { idx: 2, vn: "Ngữ Pháp Xà Yêu", zh: "语法蛇妖", lv: "hsk2", modes: ["nghia", "han", "am"], hp: 1000, hue: 60, line: "Câu của ngươi lộn xộn như ổ rắn." },
  { idx: 3, vn: "Thiên Âm Quỷ Vương", zh: "天音鬼王", lv: "hsk3", modes: ["nghia", "han"], hp: 1200, hue: 200, line: "Tai ngươi điếc trước thiên âm." },
  { idx: 4, vn: "Văn Tự Hắc Long", zh: "文字黑龙", lv: "hsk4", modes: ["nghia", "han"], hp: 1200, hue: 260, line: "Vạn chữ nằm trong vảy ta." },
  { idx: 5, vn: "Vạn Pháp Ma Tôn", zh: "万法魔尊", lv: "hsk5", modes: ["nghia", "han"], hp: 1400, hue: 320, line: "Pháp của ngươi chỉ là bắt chước." },
  { idx: 6, vn: "Thiên Đạo Chi Chủ", zh: "天道之主", lv: "hsk6", modes: ["nghia", "han"], hp: 1600, hue: 30, line: "Thiên đạo không dung kẻ nửa vời." },
  { idx: 7, vn: "Thiên Thư Tàn Hồn", zh: "天书残魂", lv: "hsk7-9", modes: ["nghia", "han"], hp: 1800, hue: 160, line: "Ta là phần Thiên Thư chưa ai thu lại." },
];
export const BOSS_Q = 20, BOSS_LIVES = 3, BOSS_TV = 150;
