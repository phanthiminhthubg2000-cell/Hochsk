// Bài tập về nhà (HSK4–5): tóm tắt bài khoá 课文一/二/三 hoặc viết bài văn — học viên gửi ảnh bài viết tay qua Zalo,
// cô tải lên trang giáo viên; AI đọc chữ viết tay + chấm, cô duyệt rồi sao chép nhận xét gửi lại.
export const HW_COL = "homework_submissions";
export const HW_IMG = "homework_images"; // ảnh bài làm, cùng id với bài nộp
export const PARTS = [["kw1", "课文一"], ["kw2", "课文二"], ["kw3", "课文三"]];
// part: "essay" hoặc "kw" + các số bài khoá, vd "kw123" = tóm tắt cả 课文一、二、三 trong một lần nộp
const CN = { 1: "一", 2: "二", 3: "三", 4: "四", 5: "五" };
// part có thể ghép: "kw1+essay" = tóm tắt bài khoá + viết bài văn cùng một lần nộp
export const kwNums = (k) => { const m = String(k || "").match(/^kw(\d+)/); return m ? m[1].split("").map(Number) : []; };
export const hasEssay = (k) => /(^|\+)essay$/.test(k || "");
export const isHsk5 = (lv) => /HSK\s*5/i.test(lv || "");
export const partName = (k, lv) => {
  const ns = kwNums(k), sum = ns.length ? (isHsk5(lv) && ns.length === 1 ? "Tóm tắt 课文" : `Tóm tắt 课文${ns.map((n) => CN[n]).join("·")}`) : "";
  return [sum, hasEssay(k) ? "Viết bài văn 作文" : ""].filter(Boolean).join(" + ") || k;
};

async function lectureHtml(lec) {
  let html = lec?.htmlContent || "";
  if (!html && lec?.fileUrl) {
    const u = /^https:\/\/(firebasestorage\.googleapis\.com|storage\.googleapis\.com|[^/]+\.firebasestorage\.app)\//.test(lec.fileUrl) ? `/api/exam-html?u=${encodeURIComponent(lec.fileUrl)}` : lec.fileUrl;
    const r = await fetch(u); if (r.ok) html = await r.text();
  }
  return html;
}
// Phần "Bài tập về nhà" trong slide bài giảng (HSK4: dữ liệu hw: [{ s, zh, range, tasks:[{ t, kind, req, kw }] }])
export async function lectureHw(lec) {
  try {
    if (!lec?.fileUrl?.startsWith("/lectures/")) return [];   // chỉ đọc bài giảng có sẵn của web
    const html = await lectureHtml(lec); const i = html.search(/\bhw:\s*\[/); if (i < 0) return [];
    let j = html.indexOf("[", i), d = 0, k = j, q = null;
    for (; k < html.length; k++) {
      const c = html[k];
      if (q) { if (c === "\\") k++; else if (c === q) q = null; continue; }
      if (c === '"' || c === "'") q = c; else if (c === "[") d++; else if (c === "]" && --d === 0) break;
    }
    const hw = new Function("return " + html.slice(j, k + 1))();
    return Array.isArray(hw) ? hw : [];
  } catch { return []; }
}

// Ảnh chụp → JPEG nén (cạnh dài ≤ maxSide), trả data URL. Tự giảm chất lượng để vừa ngân sách byte.
export async function compressImage(file, maxSide = 1500, budget = 280000) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
    let s = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    let out = "";
    for (let k = 0; k < 6; k++) {
      const c = document.createElement("canvas"); c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
      const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      out = c.toDataURL("image/jpeg", k < 3 ? 0.72 - k * 0.1 : 0.5);
      if (out.length * 0.75 <= budget) break;
      if (k >= 2) s *= 0.82;
    }
    return out;
  } finally { URL.revokeObjectURL(url); }
}

// Xoay ảnh 90° (học viên chụp ngang)
export async function rotateDataUrl(src) {
  const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
  const c = document.createElement("canvas"); c.width = img.naturalHeight; c.height = img.naturalWidth;
  const g = c.getContext("2d"); g.translate(c.width / 2, c.height / 2); g.rotate(Math.PI / 2); g.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  return c.toDataURL("image/jpeg", 0.7);
}

// Lấy chữ của bài giảng (để AI tìm 课文一/二/三 làm bài gốc)
export async function lectureText(lec) {
  if (!lec) return "";
  try {
    const html = await lectureHtml(lec);
    if (!html) return "";
    // bài giảng dạng slide: nội dung nằm trong dữ liệu JS (n: 1, kind: "对话", "câu tiếng Trung"…) → lấy các chuỗi có chữ Hán
    // bài giảng HSK5–6: lời bài khoá nằm trong dữ liệu {"title":"…","sub":"…","paras":["đoạn 1","đoạn 2"…]}
    if (html.includes('"paras":[')) {
      const out = []; let i = 0;
      while ((i = html.indexOf('"paras":[', i)) >= 0) {
        const st = html.indexOf("[", i); let d = 0, k = st, q = false;
        for (; k < html.length; k++) { const c = html[k]; if (q) { if (c === "\\") k++; else if (c === '"') q = false; continue; } if (c === '"') q = true; else if (c === "[") d++; else if (c === "]" && --d === 0) break; }
        let paras = []; try { paras = JSON.parse(html.slice(st, k + 1)).filter((x) => typeof x === "string"); } catch {}
        const head = html.slice(Math.max(0, i - 400), i); const t = [...head.matchAll(/"title":"([^"]*)"/g)].pop()?.[1] || ""; const sub = [...head.matchAll(/"sub":"([^"]*)"/g)].pop()?.[1] || "";
        if (paras.length) out.push(t ? `### 课文 · ${t}${sub ? `（${sub}）` : ""}\n${paras.join("\n")}` : `### (đoạn luyện tập, không phải bài khoá)\n${paras.join("\n")}`);
        i = k;
      }
      if (out.join("").length > 100) return ("【Lời bài khoá trong slide bài giảng】\n" + out.join("\n\n")).slice(0, 40000);
    }
    const raw = html.replace(/<style[\s\S]*?<\/style>/g, "");
    const toks = raw.match(/\bn:\s*\d+\s*,\s*kind:\s*"[^"]*"|"(?:[^"\\]|\\.)*[\u4e00-\u9fff](?:[^"\\]|\\.)*"/g) || [];
    if (toks.some((x) => x.startsWith("n:"))) {
      const t2 = toks.map((x) => (x.startsWith("n:") ? "\n### 课文 " + x : x.slice(1, -1))).join(" | ");
      return t2.slice(Math.max(0, t2.indexOf("### 课文") - 50)).slice(0, 40000);
    }
    const lits = toks.filter((x) => !x.startsWith("n:")).map((x) => x.slice(1, -1)).filter((x) => /[\u4e00-\u9fff]{6,}/.test(x));
    const d = new DOMParser().parseFromString(html, "text/html");
    d.querySelectorAll("script,style,noscript,svg").forEach((x) => x.remove());
    let t = (d.body?.innerText || d.body?.textContent || "").replace(/[ \t ]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
    if (t.replace(/[^\u4e00-\u9fff]/g, "").length < 200 && lits.length) t = lits.join("\n"); // bài giảng dựng bằng JS: lấy các chuỗi chữ Hán trong dữ liệu
    // ưu tiên đoạn từ chữ 课文 đầu tiên trở đi
    const i = t.search(/课文/);
    return (i > 0 ? t.slice(Math.max(0, i - 200)) : t).slice(0, 40000);
  } catch { return ""; }
}

export const fmtTime = (ts) => { const d = ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null; return d ? d.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }) : ""; };
