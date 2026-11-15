// Gộp chỉ mục Con Đường của mọi bộ bài (HSK6 + các bộ khác) → public/data/con-duong/all-index.json
//   node tools/lessons/build_index.mjs   (chạy sau extract_hsk6.js / extract_all.js)
import fs from "fs";
import { buildNodes } from "../../src/app/con-duong/engine.js";
const dir = new URL("../../public/data/con-duong/", import.meta.url).pathname;
const out = [];
for (const f of fs.readdirSync(dir).filter((f) => /^[a-z0-9]+-\d+\.json$/.test(f)).sort()) {
  const L = JSON.parse(fs.readFileSync(dir + f, "utf8"));
  out.push({ id: L.id, lecture: L.lecture, title: L.title, vn: L.vn || "", nodes: buildNodes(L).length });
}
fs.writeFileSync(dir + "all-index.json", JSON.stringify(out));
console.log("all-index:", out.length, "bài");
