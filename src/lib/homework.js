// Bài tập về nhà (HSK4–5): tóm tắt bài khoá 课文一/二/三 hoặc viết bài văn — học viên gửi ảnh bài viết tay qua Zalo,
// cô tải lên trang giáo viên; AI đọc chữ viết tay + chấm, cô duyệt rồi sao chép nhận xét gửi lại.
export const HW_COL = "homework_submissions";
export const HW_IMG = "homework_images"; // ảnh bài làm, cùng id với bài nộp
export const PARTS = [
  ["kw1", "Tóm tắt 课文一", "Tóm tắt bài khoá 1"],
  ["kw2", "Tóm tắt 课文二", "Tóm tắt bài khoá 2"],
  ["kw3", "Tóm tắt 课文三", "Tóm tắt bài khoá 3"],
  ["essay", "Viết bài văn 作文", "Viết bài văn"],
];
export const partName = (k) => (PARTS.find((p) => p[0] === k) || [k, k])[1];

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
    let html = lec.htmlContent || "";
    if (!html && lec.fileUrl) {
      const u = /^https:\/\/(firebasestorage\.googleapis\.com|storage\.googleapis\.com|[^/]+\.firebasestorage\.app)\//.test(lec.fileUrl) ? `/api/exam-html?u=${encodeURIComponent(lec.fileUrl)}` : lec.fileUrl;
      const r = await fetch(u); if (r.ok) html = await r.text();
    }
    if (!html) return "";
    // bài giảng dạng slide: nội dung nằm trong dữ liệu JS (n: 1, kind: "对话", "câu tiếng Trung"…) → lấy các chuỗi có chữ Hán
    const raw = html.replace(/<style[\s\S]*?<\/style>/g, "");
    const toks = raw.match(/\bn:\s*\d+\s*,\s*kind:\s*"[^"]*"|"(?:[^"\\]|\\.)*[\u4e00-\u9fff](?:[^"\\]|\\.)*"/g) || [];
    if (toks.some((x) => x.startsWith("n:"))) {
      const t2 = toks.map((x) => (x.startsWith("n:") ? "\n### 课文 " + x : x.slice(1, -1))).join(" | ");
      return t2.slice(Math.max(0, t2.indexOf("### 课文") - 50)).slice(0, 40000);
    }
    const d = new DOMParser().parseFromString(html, "text/html");
    d.querySelectorAll("script,style,noscript,svg").forEach((x) => x.remove());
    const t = (d.body?.innerText || d.body?.textContent || "").replace(/[ \t ]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
    // ưu tiên đoạn từ chữ 课文 đầu tiên trở đi
    const i = t.search(/课文/);
    return (i > 0 ? t.slice(Math.max(0, i - 200)) : t).slice(0, 40000);
  } catch { return ""; }
}

export const fmtTime = (ts) => { const d = ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null; return d ? d.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }) : ""; };
