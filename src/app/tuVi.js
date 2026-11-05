// ============================================================
// TU VI 修为 — hệ cảnh giới v2 của Sơn Hải Thư Viện
// · 8 cảnh giới, mỗi cảnh giới 9 tầng + Đỉnh phong. Cảnh giới n ≈ đang tu cấp HSK n.
// · Tu vi = users.xp (tổng tích lũy, dùng cho Thiên Bảng). Tiến độ trong cảnh giới = xp − tuVi.base,
//   base là số xp lúc bước vào cảnh giới (lúc trắc linh hoặc lúc độ kiếp thành công).
// · Tu vi chỉ đến từ kết quả học (câu đúng, ôn từ, luận võ…), không đến từ thời gian mở trang.
// · Lên cảnh giới mới chỉ bằng độ kiếp (đề thi HSK thật). Riêng Phàm Nhân đủ Đỉnh phong là tự nhập môn.
// · Thư sinh mới: Trắc Linh Đài xếp cảnh giới khởi đầu theo trình độ thật (chỉ xếp lên, không hạ).
// Dữ liệu: users/{uid}.tuVi = { realm, base, src: "trac-linh"|"do-kiep"|"nhap-mon"|"tam", at, placed? }
// ============================================================

export const REALMS8 = [
  { idx: 0, key: "pham-nhan", zh: "凡人", vn: "Phàm Nhân", hsk: "HSK 0 · ngữ âm", region: "Phàm Nhân Giới", per: 80, book: "《音律炼体诀》 Âm Luật Luyện Thể Quyết" },
  { idx: 1, key: "luyen-khi", zh: "炼气", vn: "Luyện Khí", hsk: "HSK 1", region: "Thanh Vân Sơn", per: 150, book: "《引气诀》 Dẫn Khí Quyết" },
  { idx: 2, key: "truc-co", zh: "筑基", vn: "Trúc Cơ", hsk: "HSK 2", region: "Kim Đan Cốc", per: 220, book: "《筑基心法》 Trúc Cơ Tâm Pháp" },
  { idx: 3, key: "kim-dan", zh: "金丹", vn: "Kim Đan", hsk: "HSK 3", region: "Nguyên Anh Hải", per: 300, book: "《凝丹宝典》 Ngưng Đan Bảo Điển" },
  { idx: 4, key: "nguyen-anh", zh: "元婴", vn: "Nguyên Anh", hsk: "HSK 4", region: "Vạn Pháp Thành", per: 400, book: "《元婴秘录》 Nguyên Anh Bí Lục" },
  { idx: 5, key: "hoa-than", zh: "化神", vn: "Hóa Thần", hsk: "HSK 5", region: "Thiên Cơ Các", per: 500, book: "《化神真经》 Hóa Thần Chân Kinh" },
  { idx: 6, key: "dai-thua", zh: "大乘", vn: "Đại Thừa", hsk: "HSK 6", region: "Thiên Cơ Các", per: 600, book: "《大乘天书》 Đại Thừa Thiên Thư" },
  { idx: 7, key: "phi-thang", zh: "飞升", vn: "Phi Thăng", hsk: "HSK 7–9 · HSKK", region: "Tiên Giới", per: 800, book: "《万字天书》 Vạn Chữ Thiên Thư" },
];
export const TANG = 9;
const CN_NUM = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];

// Cảnh giới có đề độ kiếp trong phòng thi (HSK 1–5). Phàm Nhân tự nhập môn; Đại Thừa chờ đề HSK6.
export const kiepLevelOf = (realmIdx) => (realmIdx >= 1 && realmIdx <= 5 ? realmIdx : 0);

// Cảnh giới tạm cho tài khoản cũ chưa qua Trắc Linh Đài: dựa trên các lần độ kiếp đã thành công
export function provisionalRealm(doKiep = {}) {
  let r = 0;
  for (let n = 1; n <= 6; n++) if (doKiep?.[`hsk${n}`]?.passed) r = Math.max(r, n + 1);
  return Math.min(7, r);
}

/**
 * Trạng thái tu vi đầy đủ để hiển thị.
 * @param xp     tổng tu vi (users.xp)
 * @param tuVi   users.tuVi hoặc null
 * @param doKiep users.doKiep (cho tài khoản cũ)
 */
export function tuViState(xp = 0, tuVi = null, doKiep = {}) {
  const placed = !!tuVi && Number.isFinite(tuVi.realm);
  const idx = placed ? Math.max(0, Math.min(7, tuVi.realm)) : provisionalRealm(doKiep);
  const R = REALMS8[idx];
  const base = placed ? Math.max(0, tuVi.base || 0) : Math.max(0, xp || 0);
  const need = R.per * TANG;
  const tv = Math.max(0, Math.min(need, (xp || 0) - base));
  const peak = tv >= need;
  const tang = peak ? TANG : Math.min(TANG, Math.floor(tv / R.per) + 1);
  const inTang = peak ? R.per : tv - (tang - 1) * R.per;
  const stage = peak ? "Đỉnh phong" : `Tầng ${tang}`;
  const stageZh = peak ? "巅峰" : `${CN_NUM[tang - 1]}层`;
  return {
    ...R, placed, provisional: !placed, base, tv, need, peak, tang, stage, stageZh,
    pct: Math.round((tv / need) * 100),          // % cả cảnh giới
    tangPct: Math.round((inTang / R.per) * 100), // % tầng hiện tại
    toNext: peak ? 0 : R.per - inTang,           // còn bao nhiêu tu vi lên tầng kế
    toPeak: Math.max(0, need - tv),
    kiepN: kiepLevelOf(idx),
    next: REALMS8[idx + 1] || null,
  };
}

// Bảng nguồn tu vi (hiển thị cho thư sinh và dùng trong code) — chỉ tính kết quả
export const TV_RULES = [
  { k: "cau-dung", vn: "Câu đúng trong bài tập công pháp", tv: "+5 / câu (tối đa 30 câu mỗi bài)" },
  { k: "tieu-thanh", vn: "Bài đạt Tiểu thành (qua đủ các bước + đúng ≥10 câu)", tv: "+60 một lần" },
  { k: "hoan-thanh", vn: "Đánh dấu hoàn thành bài (đã đúng ≥5 câu trong bài)", tv: "+30 một lần" },
  { k: "luyen-dan", vn: "Ôn từ vựng, nghe chép, dịch, sắp câu, trò chơi", tv: "theo số câu đúng" },
  { k: "luan-vo", vn: "Luận võ", tv: "thắng +50 · hòa +25 · thua +10" },
  { k: "do-kiep", vn: "Độ kiếp thành công", tv: "+200 và lên cảnh giới mới" },
];
export const LESSON_DONE_MIN_CORRECT = 5;
export const TIEU_THANH_TV = 60;
