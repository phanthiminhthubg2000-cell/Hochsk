// Tủ sách giáo trình: mỗi cuốn là doc books/{id}; mỗi trang là ảnh nén trong book_pages/{id}_{n} (n từ 1).
// Cô tải PDF từ máy lên trang giáo viên → trình duyệt dùng pdf.js vẽ từng trang thành ảnh → lưu Firestore.
// Không cần Firebase Storage; học viên xem như sách thật (lật trang).
export const BOOK_COL = "books";
export const PAGE_COL = "book_pages";
export const pageId = (book, n) => `${book}_${n}`;

// Danh mục giáo trình cần có (sách chính + sách bài tập)
export const CATALOG = [
  { group: "HSK 3.0 · 新HSK教程", items: [
    { id: "x3-1", zh: "新HSK教程 1", vi: "Giáo trình HSK 3.0 · Quyển 1", lv: 1 },
    { id: "x3-2", zh: "新HSK教程 2", vi: "Giáo trình HSK 3.0 · Quyển 2", lv: 2 },
    { id: "x3-3", zh: "新HSK教程 3", vi: "Giáo trình HSK 3.0 · Quyển 3", lv: 3 },
    { id: "x3-3w", zh: "新HSK教程 3 · 学练手册", vi: "Sách luyện tập HSK 3.0 · Quyển 3", lv: 3, wb: 1 },
    { id: "x3-4a", zh: "新HSK教程 4 · 上", vi: "Giáo trình HSK 3.0 · Quyển 4 (thượng)", lv: 4 },
    { id: "x3-4b", zh: "新HSK教程 4 · 下", vi: "Giáo trình HSK 3.0 · Quyển 4 (hạ)", lv: 4 },
  ] },
  { group: "HSK 2.0 · HSK标准教程", items: [
    { id: "b2-4a", zh: "HSK标准教程 4 · 上", vi: "Giáo trình chuẩn HSK 4 (thượng)", lv: 4 },
    { id: "b2-4b", zh: "HSK标准教程 4 · 下", vi: "Giáo trình chuẩn HSK 4 (hạ)", lv: 4 },
    { id: "b2-5a", zh: "HSK标准教程 5 · 上", vi: "Giáo trình chuẩn HSK 5 (thượng)", lv: 5 },
    { id: "b2-5b", zh: "HSK标准教程 5 · 下", vi: "Giáo trình chuẩn HSK 5 (hạ)", lv: 5 },
    { id: "b2-6a", zh: "HSK标准教程 6 · 上", vi: "Giáo trình chuẩn HSK 6 (thượng)", lv: 6 },
    { id: "b2-6b", zh: "HSK标准教程 6 · 下", vi: "Giáo trình chuẩn HSK 6 (hạ)", lv: 6 },
    { id: "b2-4aw", zh: "HSK标准教程 4 · 上 · 练习册", vi: "Sách bài tập HSK 4 (thượng)", lv: 4, wb: 1 },
    { id: "b2-4bw", zh: "HSK标准教程 4 · 下 · 练习册", vi: "Sách bài tập HSK 4 (hạ)", lv: 4, wb: 1 },
    { id: "b2-5aw", zh: "HSK标准教程 5 · 上 · 练习册", vi: "Sách bài tập HSK 5 (thượng)", lv: 5, wb: 1 },
    { id: "b2-5bw", zh: "HSK标准教程 5 · 下 · 练习册", vi: "Sách bài tập HSK 5 (hạ)", lv: 5, wb: 1 },
    { id: "b2-6aw", zh: "HSK标准教程 6 · 上 · 练习册", vi: "Sách bài tập HSK 6 (thượng)", lv: 6, wb: 1 },
    { id: "b2-6bw", zh: "HSK标准教程 6 · 下 · 练习册", vi: "Sách bài tập HSK 6 (hạ)", lv: 6, wb: 1 },
  ] },
];
export const ALL_BOOKS = CATALOG.flatMap((g) => g.items.map((b) => ({ ...b, group: g.group })));

let pdfjs = null;
export async function loadPdfjs() {
  if (pdfjs) return pdfjs;
  pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  return pdfjs;
}

// canvas → ảnh nén (WebP nếu trình duyệt hỗ trợ, không thì JPEG), giữ dưới ngân sách byte
export function canvasToImage(c, budget = 260000) {
  let q = 0.62, out = "";
  for (let k = 0; k < 6; k++) {
    out = c.toDataURL("image/webp", q);
    if (!out.startsWith("data:image/webp")) out = c.toDataURL("image/jpeg", q);
    if (out.length * 0.75 <= budget) break;
    q -= 0.1;
  }
  return out;
}

// vẽ trang n của pdf ra ảnh, chiều rộng ~ width px
export async function renderPage(pdf, n, width = 1100) {
  const page = await pdf.getPage(n);
  const v1 = page.getViewport({ scale: 1 });
  const scale = Math.min(2.5, width / v1.width);
  const vp = page.getViewport({ scale });
  const c = document.createElement("canvas"); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
  const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: g, viewport: vp }).promise;
  const img = canvasToImage(c);
  const ratio = c.height / c.width;
  page.cleanup();
  return { img, ratio, c };
}
