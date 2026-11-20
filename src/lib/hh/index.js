// 玄门学宫 — 7 cảnh giới ứng với 7 cấp của lộ trình Huyền học
import { L1, L2, L3 } from "./l1-3";
import { L4, L5 } from "./l4-5";
import { L6, L7 } from "./l6-7";

const REALM = [
  { zh: "凡人境", hv: "Phàm Nhân cảnh", num: "壹" },
  { zh: "感气境", hv: "Cảm Khí cảnh", num: "贰" },
  { zh: "炼气境", hv: "Luyện Khí cảnh", num: "叁" },
  { zh: "筑基境", hv: "Trúc Cơ cảnh", num: "肆" },
  { zh: "金丹境", hv: "Kim Đan cảnh", num: "伍" },
  { zh: "元婴境", hv: "Nguyên Anh cảnh", num: "陆" },
  { zh: "化神境", hv: "Hoá Thần cảnh", num: "柒" },
];
export const LEVELS = [L1, L2, L3, L4, L5, L6, L7].map((L, i) => ({ ...L, realm: REALM[i] }));
export const LESSONS = LEVELS.flatMap((L) => L.lessons.map((x) => ({ ...x, level: L })));
export const lessonById = (id) => LESSONS.find((x) => x.id === id);
export const PASS = 60; // điểm trắc nghiệm tối thiểu để mở bài tiếp theo

// Từ điển toàn khoá: gộp từ vựng, giữ bài xuất hiện đầu tiên
export const ALL_VOCAB = (() => {
  const seen = new Map();
  for (const l of LESSONS) for (const [zh, py, vi] of l.vocab) if (!seen.has(zh)) seen.set(zh, { zh, py, vi, id: l.id, lv: l.level.n });
  return [...seen.values()];
})();

// Tiến độ: { id: { s: điểm %, t: thời điểm } }
export function unlockedSet(prog, all) {
  const out = new Set();
  for (let i = 0; i < LESSONS.length; i++) {
    const id = LESSONS[i].id;
    if (all || i === 0 || (prog[LESSONS[i - 1].id]?.s ?? -1) >= PASS) out.add(id);
    else break;
  }
  if (all) LESSONS.forEach((l) => out.add(l.id));
  return out;
}
export const isDone = (prog, id) => (prog[id]?.s ?? -1) >= PASS;
