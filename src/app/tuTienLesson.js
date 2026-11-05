"use client";
// ============================================================
// LỚP TU TIÊN CHO BÀI GIẢNG — Sơn Hải Thư Viện (giai đoạn 2)
// Bài giảng là tệp HTML tĩnh (nhiều khuôn: cuộn dài, thẻ tab, trang chiếu) mở trong iframe cùng nguồn.
// Trang chính "khoác" lớp tu tiên từ bên ngoài, không sửa tệp bài:
//   1. Nhận ra các bước học qua chữ trên tiêu đề / nút mục lục (热身, 生词, 课文, 练习… hoặc tiếng Việt)
//   2. Gắn nhãn 5 bước (开卷 Khai quyển, 领悟 Lĩnh ngộ, 修炼 Tu luyện, 试炼 Thí luyện, 悟道 Ngộ đạo) lên mục lục / tiêu đề
//   3. Người học ở một bước ≥3 giây → onStep (đã đọc qua, không có tu vi)
//   4. Một câu được chấm đúng (phần tử nhận class right/ok/correct ngay sau thao tác) → onCorrect({step}); bước đó "đạt"
// ============================================================

// v2 · Bài học 5 bước: Khai quyển → Lĩnh ngộ → Tu luyện → Thí luyện → Ngộ đạo
// Bước 1 tính "đã qua" khi đọc; bước 2–5 chỉ "đạt" khi có câu làm đúng trong bước đó (nhận tu vi một lần).
export const STEPS = [
  { key: "khai-quyen", zh: "开卷", vn: "Khai quyển", qi: 0 },
  { key: "linh-ngo", zh: "领悟", vn: "Lĩnh ngộ", qi: 10 },
  { key: "tu-luyen", zh: "修炼", vn: "Tu luyện", qi: 20 },
  { key: "thi-luyen", zh: "试炼", vn: "Thí luyện", qi: 20 },
  { key: "ngo-dao", zh: "悟道", vn: "Ngộ đạo", qi: 30 },
];
// Nhận dạng phần của bài → bước. Thứ tự quan trọng: mẫu cụ thể đứng trước mẫu chung
const PATTERNS = [
  [/khởi động|热身|mục tiêu|目标|mở đầu/i, "khai-quyen"],
  [/phân biệt|辨析|搭配/i, "tu-luyen"],
  [/mở rộng|扩展|tu từ|篇章|修辞|văn hoá|văn hóa|文化/i, "tu-luyen"],
  [/luyện đề|模拟|真题|đề hsk|thi thử|听力|阅读/i, "thi-luyen"],
  [/viết|写作|缩写|作文|运用|vận dụng/i, "ngo-dao"],
  [/tổng kết|总结|bài về nhà|作业|小结/i, "ngo-dao"],
  [/từ vựng|từ mới|生词|词汇|vocab/i, "linh-ngo"],
  [/bài khóa|bài khoá|hội thoại|课文|会话|đoạn văn/i, "tu-luyen"],
  [/ngữ pháp|chú thích|注释|语法|cấu trúc|句型/i, "tu-luyen"],
  [/语音|phát âm|ngữ âm|thanh điệu|thanh mẫu|vận mẫu|bút thuận|nét cơ bản|nét chữ/i, "tu-luyen"],
  [/bài tập|luyện tập|练习|thực hành|trò chơi|判断/i, "thi-luyen"],
];
// Khóa bước cũ (11 nhãn, giai đoạn 2) → bước mới
const ALIAS = { "dieu-tuc": "khai-quyen", "tu-khi": "linh-ngo", "tham-ngo": "tu-luyen", "chieu-thuc": "tu-luyen", "pha-chuong": "tu-luyen", "than-thong": "tu-luyen", "luyen-am": "tu-luyen", "dien-vo": "thi-luyen", "thi-luyen": "thi-luyen", "ngung-dan": "ngo-dao", "be-quan": "ngo-dao" };
const uniq = (a) => [...new Set(a)];
export const normKeys = (arr) => uniq((arr || []).map((k) => ALIAS[k] || k).filter((k) => STEPS.some((x) => x.key === k)));
export const stepByKey = (k) => STEPS.find((x) => x.key === k) || null;
export const CORRECT_QI = 5;      // mỗi câu đúng (Diễn võ)
export const CORRECT_CAP = 30;    // tối đa số câu đúng được tính linh khí trong một bài

export const stepOf = (text) => {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t || t.length > 80) return null;
  const hit = PATTERNS.find(([re]) => re.test(t));
  return hit ? stepByKey(hit[1]) : null;
};

// Mức lĩnh ngộ (ước lượng từ bên ngoài bài)
// rec = { s: [bước đã qua], t: số bước của bài, c: câu đúng, f: ngày đạt Tiểu thành, r: [ngày ôn lại] }
const dn = (k) => { const [y, m, d] = String(k || "").split("-").map(Number); return y ? Math.round(Date.UTC(y, m - 1, d) / 864e5) : 0; };
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
export const isTieuThanh = (rec) => { const seen = normKeys(rec?.s).length, total = rec?.t || 0; return total > 0 && seen >= total && (rec?.c || 0) >= 10; };
export function masteryOf(rec, done) {
  const seen = normKeys(rec?.s).length, total = rec?.t || 0;
  if (isTieuThanh(rec)) {
    const f = dn(rec.f), r = (rec.r || []).map(dn);
    if (f && r.some((x) => x - f >= 3) && r.some((x) => x - f >= 7)) return { zh: "圆满", vn: "Viên mãn", n: 4 };
    if (done) return { zh: "大成", vn: "Đại thành", n: 3 };
    return { zh: "小成", vn: "Tiểu thành", n: 2 };
  }
  if (total > 0 && seen / total >= 0.5) return { zh: "入门", vn: "Nhập môn", n: 1 };
  return { zh: "初窥", vn: "Mới bước vào", n: 0 };
}
// Ôn tập: bài đã Tiểu thành cần ôn lại ở mốc +3 và +7 ngày để lên Viên mãn
export function reviewOf(rec, done) {
  const m = masteryOf(rec, done);
  if (m.n < 2 || m.n >= 4 || !rec?.f) return { due: false, crack: false };
  const f = dn(rec.f), t = dn(todayKey()), r = (rec.r || []).map(dn);
  const has3 = r.some((x) => x - f >= 3);
  const due = (!has3 && t - f >= 3) || (has3 && !r.some((x) => x - f >= 7) && t - f >= 7);
  const last = Math.max(f, ...r);
  return { due, crack: t - last > 7 };
}

const CSS = `
tt-b{display:inline-flex!important;align-items:center;gap:4px;flex:none;margin:0 6px 0 0;padding:1px 6px;border:0;border-radius:3px;background:#9E2F22;color:#FBF3E4;font:700 11px/1.5 "Noto Serif SC","Be Vietnam Pro",serif;vertical-align:middle;white-space:nowrap;letter-spacing:0;text-transform:none;text-decoration:none;pointer-events:none;box-shadow:none;width:auto;height:auto;min-width:0}
tt-b tt-i{display:inline;font-style:normal;font-weight:600;font-family:"Be Vietnam Pro",system-ui,sans-serif;opacity:.92}
tt-b.seen{background:#6B4A2E}
tt-b.done{background:#1C1A17}
tt-b.done::after{content:"✓";margin-left:1px}
`;

const NAV_SEL = '[data-go],[data-sec],[data-tab],[data-toc],[role="tab"],nav a,nav button,.toc a,.tabs button,.tabbar button,.tab';
const ACTIVE_RE = /\b(on|active|cur|current|sel|selected)\b/;
const NAV_KEY = /^[^\u4e00-\u9fff]{0,8}(热身|目标|生词|课文|注释|语法|辨析|练习|扩展|真题|模拟|写作|运用|作业|语音|文化|总结)/;

/**
 * Gắn lớp tu tiên vào iframe bài giảng. Trả về hàm gỡ.
 * @param frame     phần tử iframe (đã load)
 * @param seen      mảng key bước đã đọc qua
 * @param passed    mảng key bước đã đạt (có câu đúng trong bước) → ✓
 * @param onInit    ({total, steps})
 * @param onStep    ({key, zh, vn, qi})   — đọc qua một bước (không kèm tu vi)
 * @param onCorrect ({step})             — một câu đúng; step = key bước chứa câu đó (có thể null)
 */
export function attachTuTien(frame, { seen = [], passed = [], onInit, onStep, onCorrect } = {}) {
  let doc, win;
  try { doc = frame.contentDocument; win = frame.contentWindow; } catch (_) { return () => {}; }
  if (!doc || !win || !doc.body) return () => {};
  const cleanups = [];
  const got = new Set(normKeys(seen));
  const pass = new Set(normKeys(passed));

  if (!doc.getElementById("tt-style")) {
    const st = doc.createElement("style"); st.id = "tt-style"; st.textContent = CSS; (doc.head || doc.body).appendChild(st);
  }

  const ownText = (el) => {
    let t = el.textContent || "";
    el.querySelectorAll("tt-b").forEach((x) => { t = t.replace(x.textContent, ""); });
    return t.replace(/\s+/g, " ").trim();
  };
  let navs = [], heads = [], present = new Set();

  // Thẻ riêng <tt-b> để CSS của bài không ảnh hưởng; ở mục lục chỉ ghi chữ Hán (chỗ hẹp), ở tiêu đề ghi đủ
  const badge = (step, full) => {
    const b = doc.createElement("tt-b");
    if (pass.has(step.key)) b.className = "done"; else if (got.has(step.key)) b.className = "seen";
    b.dataset.tt = step.key;
    b.title = `${step.zh} ${step.vn}`;
    b.innerHTML = full ? `${step.zh}<tt-i>${step.vn}</tt-i>` : step.zh;
    return b;
  };

  // Quét lại nhãn (nhiều bài dựng giao diện bằng JS sau khi tải, có bài đổi trang/tab)
  const scan = () => {
    navs = []; heads = [];
    doc.querySelectorAll(NAV_SEL).forEach((el) => {
      if (el.closest("tt-b")) return;
      const step = stepOf(ownText(el));
      if (step) navs.push({ el, step });
    });
    // Thẻ/nút lớn mở từng phần (vd. "🎯 01 目标 Mục tiêu…", "💬 02 课文一 …"): chữ Hán của bước đứng gần đầu
    doc.querySelectorAll("button,a,[role=button]").forEach((el) => {
      if (el.closest("tt-b") || navs.some((n) => n.el === el || n.el.contains(el) || el.contains(n.el))) return;
      const t = ownText(el);
      if (t.length > 140 || !NAV_KEY.test(t)) return;
      const step = stepOf(t.slice(0, 80));
      if (step) navs.push({ el, step });
    });
    doc.querySelectorAll("h1,h2,h3").forEach((el) => {
      const step = stepOf(ownText(el));
      if (step) heads.push({ el, step });
    });
    const before = present.size;
    [...navs, ...heads].forEach((x) => present.add(x.step.key));
    // Nhãn đặt trên nút mục lục; bài không có mục lục thì đặt trên tiêu đề
    navs.forEach(({ el, step }) => {
      if (el.querySelector(":scope > tt-b")) return;
      try { el.insertBefore(badge(step, false), el.firstChild); } catch (_) {}
    });
    heads.filter((h) => h.el.tagName !== "H1").forEach(({ el, step }) => {
      if (el.querySelector(":scope > tt-b")) return;
      try { el.insertBefore(badge(step, true), el.firstChild); } catch (_) {}
    });
    if (present.size !== before) onInit && onInit({ total: present.size, steps: [...present] });
  };
  scan();
  const rescan = win.setInterval(scan, 4000);
  cleanups.push(() => win.clearInterval(rescan));
  cleanups.push(() => doc.querySelectorAll("tt-b").forEach((b) => b.remove()));

  const markSeen = (key) => doc.querySelectorAll(`tt-b[data-tt="${key}"]`).forEach((b) => { if (!b.classList.contains("done")) b.classList.add("seen"); });
  const markDone = (key) => { pass.add(key); doc.querySelectorAll(`tt-b[data-tt="${key}"]`).forEach((b) => { b.classList.remove("seen"); b.classList.add("done"); }); };
  // Câu vừa làm thuộc bước nào: tiêu đề bước gần nhất phía trên câu đó, nếu không có thì bước đang chọn ở mục lục
  // Thứ tự: mục/tab đang chọn (bài dạng thẻ, trang chiếu, mục lục theo cuộn) → tiêu đề gần nhất trong cùng khối → mục vừa bấm
  const stepAt = (el) => {
    const act = navs.find((n) => isActive(n.el));
    if (act) return act.step.key;
    for (let a = el; a && a !== doc.body; a = a.parentElement) {
      let best = null;
      heads.forEach((h) => { try { if (a.contains(h.el) && (h.el === el || h.el.compareDocumentPosition(el) & 4)) best = h.step.key; } catch (_) {} });
      if (best) return best;
    }
    return clickedStep;
  };

  // ---- Bước nào đang được học: tiêu đề đang hiện trong khung nhìn, hoặc tab/mục đang chọn ----
  const onScreen = (el) => {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    const vh = win.innerHeight || 800, vw = win.innerWidth || 1200;
    if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) return false;
    const st = win.getComputedStyle(el);
    return st.visibility !== "hidden" && st.opacity !== "0";
  };
  const isActive = (el) => el.getAttribute("aria-selected") === "true" || el.getAttribute("aria-current") || ACTIVE_RE.test(el.className && el.className.baseVal === undefined ? el.className : "");
  const dwell = {};
  let clickedStep = null, lastAct = Date.now();
  const onNavClick = (e) => {
    lastAct = Date.now();
    const hit = navs.find((n) => n.el.contains(e.target));
    if (hit) clickedStep = hit.step.key;
  };
  doc.addEventListener("click", onNavClick, true);
  const onAct = () => { lastAct = Date.now(); };
  ["keydown", "scroll", "pointermove", "wheel", "touchstart"].forEach((ev) => doc.addEventListener(ev, onAct, { capture: true, passive: true }));
  cleanups.push(() => {
    doc.removeEventListener("click", onNavClick, true);
    ["keydown", "scroll", "pointermove", "wheel", "touchstart"].forEach((ev) => doc.removeEventListener(ev, onAct, { capture: true }));
  });
  const tick = win.setInterval(() => {
    if (doc.hidden) return;
    const now = new Set();
    heads.forEach(({ el, step }) => { if (onScreen(el)) now.add(step.key); });
    navs.forEach(({ el, step }) => { if (isActive(el)) now.add(step.key); });
    // Bài dạng trang chiếu / cửa sổ: bước vừa chọn ở mục lục được tính khi người học còn thao tác (≤ 2 phút)
    if (clickedStep && Date.now() - lastAct < 120000) now.add(clickedStep);
    Object.keys(dwell).forEach((k) => { if (!now.has(k)) delete dwell[k]; });
    now.forEach((k) => {
      if (got.has(k)) return;
      dwell[k] = (dwell[k] || 0) + 1;
      if (dwell[k] >= 3) {
        got.add(k); if (k === "khai-quyen") markDone(k); else markSeen(k);
        const step = stepByKey(k);
        onStep && onStep({ key: k, zh: step.zh, vn: step.vn, qi: step.qi });
      }
    });
  }, 1000);
  cleanups.push(() => win.clearInterval(tick));

  // ---- Câu được chấm đúng: phần tử nhận class right / ok / correct ngay sau thao tác của người học ----
  let lastInput = 0, lastTarget = null;
  const onInput = (e) => { lastInput = Date.now(); if (e && e.target && e.type !== "keydown") lastTarget = e.target; };
  ["click", "keydown", "change", "pointerup"].forEach((ev) => doc.addEventListener(ev, onInput, true));
  const counted = new WeakSet();
  const MO = win.MutationObserver || window.MutationObserver;
  const mo = new MO((muts) => {
    if (Date.now() - lastInput > 4000) return;
    const rights = [];
    let wrongNow = false;
    muts.forEach((m) => {
      const el = m.target;
      if (!el.classList || el.closest?.("tt-b")) return;
      const old = String(m.oldValue || "");
      if ((el.classList.contains("wrong") || el.classList.contains("no") || el.classList.contains("incorrect")) && !/\b(wrong|no|incorrect)\b/.test(old)) wrongNow = true;
      if (counted.has(el)) return;
      const isRight = el.classList.contains("right") || el.classList.contains("ok") || el.classList.contains("correct");
      if (isRight && !/\b(right|ok|correct)\b/.test(old)) rights.push(el);
    });
    // Chọn sai thì bài thường tô luôn đáp án đúng → không tính; chỉ tính phần tử gần chỗ vừa bấm
    if (wrongNow) return;
    const near = (el) => !lastTarget || el === lastTarget || el.contains(lastTarget) || lastTarget.contains?.(el) || el.parentElement?.contains(lastTarget) || el.parentElement?.parentElement?.contains(lastTarget);
    rights.filter(near).slice(0, 1).forEach((el) => {
      counted.add(el);
      const k = stepAt(el);
      if (k && k !== "khai-quyen" && !pass.has(k)) markDone(k);
      onCorrect && onCorrect({ step: k });
    });
  });
  mo.observe(doc.body, { subtree: true, attributes: true, attributeFilter: ["class"], attributeOldValue: true });
  cleanups.push(() => {
    mo.disconnect();
    ["click", "keydown", "change", "pointerup"].forEach((ev) => doc.removeEventListener(ev, onInput, true));
  });

  return () => cleanups.forEach((f) => { try { f(); } catch (_) {} });
}
