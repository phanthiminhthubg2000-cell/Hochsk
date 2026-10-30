"use client";
// ============================================================
// LƯU KẾT QUẢ TRÒ CHƠI LỚP
//   game_results/{auto} : 1 bản ghi / 1 trận — lớp, đề, bảng điểm, từ hay sai
//   tests_bank/{auto}   : (tuỳ chọn) biến danh sách từ hay sai thành bài Kiểm tra bài cũ
// Học sinh được gắn với hồ sơ lớp khi giáo viên chọn lớp lúc tạo phòng
// (máy HS chọn tên trong danh sách lớp → players/{pid}.sid = id học sinh).
// ============================================================
import { db } from "../../firebase";
import { collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore";

export const GAME_NAMES = { tug: "Kéo co", race: "Đua về đích", quiz: "Ai nhanh nhất", bomb: "Bom nổ chậm", arrange: "Sắp xếp câu" };

export async function loadClasses() {
  const snap = await getDocs(collection(db, "classes"));
  const out = [];
  snap.forEach((d) => {
    const c = d.data();
    out.push({ id: d.id, className: c.className || "(chưa đặt tên)", level: c.level || "", students: (c.students || []).map((s) => ({ id: s.id, name: s.name })) });
  });
  return out.sort((a, b) => a.className.localeCompare(b.className, "vi", { numeric: true }));
}

// Cấp trong kho bài (trang giáo viên) tương ứng với đề đang chơi
export function bankLevel(cfg) {
  if (cfg.classLevel) return cfg.classLevel;
  const id = cfg.levelId || "";
  const maxN = Math.max(0, ...(cfg.lessonNums || []).map(Number));
  if (id === "HSK1") return "HSK1 3.0";
  if (id === "HSK2") return "HSK2 3.0";
  if (id === "HSK3") return "HSK3 3.0";
  if (id === "HSK4") return maxN > 10 ? "HSK4.2 3.0" : "HSK4.1 3.0";
  if (id === "HSK4v2") return maxN > 10 ? "HSK4.2 2.0" : "HSK4.1 2.0";
  if (id === "HSK5") return maxN > 18 ? "HSK5.2 2.0" : "HSK5.1 2.0";
  return cfg.level || "";
}

const today = () => new Date().toLocaleDateString("vi-VN");

/**
 * Lưu 1 trận. players: danh sách người chơi trong phòng; metric(p) = điểm để xếp hạng.
 * missed: [{ w:[hz,py,vn], n }] — từ bị trả lời sai trong trận.
 * Trả về id bản ghi, hoặc null nếu không lưu được (không chặn trò chơi).
 */
export async function saveGameResult({ game, cfg = {}, players = [], metric, missed = [], extra = {} }) {
  try {
    const val = metric || ((p) => p.score || 0);
    const ranked = players.slice().sort((a, b) => val(b) - val(a));
    const rec = {
      game, gameName: GAME_NAMES[game] || game,
      classId: cfg.classId || null, className: cfg.className || "",
      level: cfg.level || "", levelId: cfg.levelId || "", lessons: cfg.lessons || "", lessonNums: cfg.lessonNums || [], mode: cfg.mode || "",
      date: today(), ts: Date.now(), createdAt: serverTimestamp(),
      players: ranked.map((p, i) => ({
        pid: p.id || "", sid: p.sid || null, name: p.name || "", rank: i + 1, value: val(p),
        score: p.score || 0, correct: p.correct || 0, wrong: p.wrong || 0, ...(p.team ? { team: p.team } : {}), ...(p.booms ? { booms: p.booms } : {}),
      })),
      missed: missed.slice().sort((a, b) => b.n - a.n).slice(0, 40).map((m) => ({ z: m.w[0], py: m.w[1] || "", vn: m.w[2] || "", n: m.n, tot: m.tot || m.n })),
      ...extra,
    };
    const ref = await addDoc(collection(db, "game_results"), rec);
    return ref.id;
  } catch (e) {
    console.warn("Không lưu được kết quả trò chơi:", e);
    return null;
  }
}

/** Tạo bài "Kiểm tra bài cũ" từ các từ hay sai trong trận. */
export async function missedToTest({ game, cfg = {}, missed = [] }) {
  const items = missed.slice().sort((a, b) => b.n - a.n).slice(0, 30).map((m) => ({ z: m.w[0], py: m.w[1] || "", vn: m.w[2] || "" }));
  if (!items.length) throw new Error("Không có từ sai nào.");
  const testName = `Ôn từ sai · ${GAME_NAMES[game] || game} · ${cfg.className ? cfg.className + " · " : ""}${today()}`;
  const ref = await addDoc(collection(db, "tests_bank"), {
    testName, level: bankLevel(cfg), kind: "vocab", items, questions: items.map((i) => i.z),
    source: "game", createdAt: serverTimestamp(),
  });
  return { id: ref.id, testName };
}
