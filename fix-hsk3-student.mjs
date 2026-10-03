// Sửa các trang học viên: iframe đề HSK 3.0 đọc htmlContent (Firestore) thay vì fileUrl
// Cách chạy (tại thư mục gốc flashcard-app):  node fix-hsk3-student.mjs
import fs from "fs";
import path from "path";

if (!fs.existsSync("src")) { console.error("❌ Không thấy thư mục src. Hãy chạy lệnh trong thư mục flashcard-app."); process.exit(1); }

const files = [];
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) { if (f !== "node_modules" && !f.startsWith(".")) walk(p); }
    else if (/\.(jsx?|tsx?)$/.test(f)) files.push(p);
  }
})("src");

let total = 0;
const others = [];
for (const file of files) {
  const raw = fs.readFileSync(file, "utf8");
  if (!raw.includes("fileUrl")) continue;
  let count = 0;
  const out = raw.replace(/<iframe\b[^>]*?>/gs, tag =>
    tag.replace(/src=\{\s*([\w$.?\[\]"']+?)(\?)?\.fileUrl\s*\}/, (m, v) => {
      count++;
      const base = v.replace(/\?$/, "");
      return `{...(${base}?.htmlContent ? { srcDoc: ${base}.htmlContent } : { src: ${base}?.fileUrl })}`;
    })
  );
  if (count) {
    if (!fs.existsSync(file + ".bak")) fs.writeFileSync(file + ".bak", raw);
    fs.writeFileSync(file, out);
    console.log(`✅ ${file}: đã sửa ${count} iframe (sao lưu: ${path.basename(file)}.bak)`);
    total += count;
  } else if (!/htmlContent/.test(raw) || /fetch\([^)]*fileUrl/.test(raw)) {
    others.push(file);
  }
}

if (!total) console.log("Không có iframe nào cần sửa.");
if (others.length) {
  console.log("\n⚠️  Các file sau vẫn dùng fileUrl theo cách khác, cần kiểm tra tay (gửi cho Claude):");
  others.forEach(f => console.log("   " + f));
}
