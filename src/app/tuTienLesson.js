"use client";
// ============================================================
// LỚP TU TIÊN CHO BÀI GIẢNG — Sơn Hải Thư Viện (giai đoạn 2)
// Bài giảng là tệp HTML tĩnh (nhiều khuôn: cuộn dài, thẻ tab, trang chiếu) mở trong iframe cùng nguồn.
// Trang chính "khoác" lớp tu tiên từ bên ngoài, không sửa tệp bài:
//   1. Nhận ra các bước học qua chữ trên tiêu đề / nút mục lục (热身, 生词, 课文, 练习… hoặc tiếng Việt)
//   2. Gắn nhãn bước tu luyện (调息 Điều tức, 聚气 Tụ khí…) lên nút mục lục / tab
//   3. Người học ở một bước ≥3 giây (tiêu đề đang hiện, hoặc tab đang chọn) → onStep một lần cho bước đó
//   4. Một câu được chấm đúng (phần tử nhận class right/ok/correct ngay sau thao tác) → onCorrect
// ============================================================

// Thứ tự quan trọng: mẫu cụ thể đứng trước mẫu chung
export const STEPS = [
  { key: "dieu-tuc", zh: "调息", vn: "Điều tức", qi: 10, re: /khởi động|热身|mục tiêu|目标|mở đầu/i },
  { key: "pha-chuong", zh: "破障", vn: "Phá chướng", qi: 20, re: /phân biệt|辨析|搭配/i },
  { key: "than-thong", zh: "神通", vn: "Thần thông", qi: 20, re: /mở rộng|扩展|tu từ|篇章|修辞|văn hoá|văn hóa|文化/i },
  { key: "thi-luyen", zh: "试炼", vn: "Thí luyện", qi: 10, re: /luyện đề|模拟|真题|đề hsk|thi thử|听力|阅读/i },
  { key: "ngung-dan", zh: "凝丹", vn: "Ngưng đan", qi: 20, re: /viết|写作|缩写|作文|运用|vận dụng/i },
  { key: "be-quan", zh: "闭关", vn: "Bế quan", qi: 10, re: /tổng kết|总结|bài về nhà|作业|小结/i },
  { key: "tu-khi", zh: "聚气", vn: "Tụ khí", qi: 20, re: /từ vựng|từ mới|生词|词汇|vocab/i },
  { key: "tham-ngo", zh: "参悟", vn: "Tham ngộ", qi: 30, re: /bài khóa|bài khoá|hội thoại|课文|会话|đoạn văn/i },
  { key: "chieu-thuc", zh: "招式", vn: "Luyện chiêu", qi: 20, re: /ngữ pháp|chú thích|注释|语法|cấu trúc|句型/i },
  { key: "luyen-am", zh: "炼音", vn: "Luyện âm", qi: 10, re: /语音|phát âm|ngữ âm|thanh điệu|thanh mẫu|vận mẫu|bút thuận|nét cơ bản|nét chữ/i },
  { key: "dien-vo", zh: "演武", vn: "Diễn võ", qi: 10, re: /bài tập|luyện tập|练习|thực hành|trò chơi|判断/i },
];
export const CORRECT_QI = 5;      // mỗi câu đúng (Diễn võ)
export const CORRECT_CAP = 30;    // tối đa số câu đúng được tính linh khí trong một bài

export const stepOf = (text) => {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t || t.length > 80) return null;
  return STEPS.find((s) => s.re.test(t)) || null;
};

// Mức lĩnh ngộ (ước lượng từ bên ngoài bài): rec = { s: [bước đã qua], t: số bước của bài, c: câu đúng }
export function masteryOf(rec, done) {
  const seen = rec?.s?.length || 0, total = rec?.t || 0, c = rec?.c || 0;
  const all = total > 0 && seen >= total;
  if (done && all && c >= 10) return { zh: "大成", vn: "Đại thành", n: 3 };
  if (all && c >= 10) return { zh: "小成", vn: "Tiểu thành", n: 2 };
  if (total > 0 && seen / total >= 0.5) return { zh: "入门", vn: "Nhập môn", n: 1 };
  return { zh: "初窥", vn: "Mới bước vào", n: 0 };
}

const CSS = `
tt-b{display:inline-flex!important;align-items:center;gap:4px;flex:none;margin:0 6px 0 0;padding:1px 6px;border:0;border-radius:3px;background:#9E2F22;color:#FBF3E4;font:700 11px/1.5 "Noto Serif SC","Be Vietnam Pro",serif;vertical-align:middle;white-space:nowrap;letter-spacing:0;text-transform:none;text-decoration:none;pointer-events:none;box-shadow:none;width:auto;height:auto;min-width:0}
tt-b tt-i{display:inline;font-style:normal;font-weight:600;font-family:"Be Vietnam Pro",system-ui,sans-serif;opacity:.92}
tt-b.done{background:#1C1A17}
tt-b.done::after{content:"✓";margin-left:1px}
`;

const NAV_SEL = '[data-go],[data-sec],[data-tab],[data-toc],[role="tab"],nav a,nav button,.toc a,.tabs button,.tabbar button,.tab';
const ACTIVE_RE = /\b(on|active|cur|current|sel|selected)\b/;
const NAV_KEY = /^[^\u4e00-\u9fff]{0,8}(热身|目标|生词|课文|注释|语法|辨析|练习|扩展|真题|模拟|写作|运用|作业|语音|文化|总结)/;

/**
 * Gắn lớp tu tiên vào iframe bài giảng. Trả về hàm gỡ.
 * @param frame     phần tử iframe (đã load)
 * @param seen      mảng key bước đã nhận linh khí (để đánh dấu ✓)
 * @param onInit    ({total, steps})
 * @param onStep    ({key, zh, vn, qi})
 * @param onCorrect ()
 */
export function attachTuTien(frame, { seen = [], onInit, onStep, onCorrect } = {}) {
  let doc, win;
  try { doc = frame.contentDocument; win = frame.contentWindow; } catch (_) { return () => {}; }
  if (!doc || !win || !doc.body) return () => {};
  const cleanups = [];
  const got = new Set(seen);

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
    if (got.has(step.key)) b.className = "done";
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

  const markDone = (key) => doc.querySelectorAll(`tt-b[data-tt="${key}"]`).forEach((b) => b.classList.add("done"));

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
        got.add(k); markDone(k);
        const step = STEPS.find((s) => s.key === k);
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
    rights.filter(near).slice(0, 1).forEach((el) => { counted.add(el); onCorrect && onCorrect(); });
  });
  mo.observe(doc.body, { subtree: true, attributes: true, attributeFilter: ["class"], attributeOldValue: true });
  cleanups.push(() => {
    mo.disconnect();
    ["click", "keydown", "change", "pointerup"].forEach((ev) => doc.removeEventListener(ev, onInput, true));
  });

  return () => cleanups.forEach((f) => { try { f(); } catch (_) {} });
}
