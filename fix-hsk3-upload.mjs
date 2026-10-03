// Sửa trang teacher: lưu đề HSK 3.0 vào Firestore (không dùng Firebase Storage)
// Cách chạy (tại thư mục gốc flashcard-app):  node fix-hsk3-upload.mjs
import fs from "fs";

const FILE = "src/app/teacher/page.js";
if (!fs.existsSync(FILE)) { console.error("❌ Không tìm thấy " + FILE + ". Hãy chạy lệnh trong thư mục flashcard-app."); process.exit(1); }

const raw = fs.readFileSync(FILE, "utf8");
const CRLF = raw.includes("\r\n");
let s = raw.replace(/\r\n/g, "\n");
const done = [];

// ---------- 1. Bỏ Firebase Storage ----------
const before1 = s;
s = s.replace(/^import\s*\{[^}]*\}\s*from\s*["']firebase\/storage["'];?\s*\n/m, "");
s = s.replace(/^const\s+storage\s*=\s*getStorage\(\);?\s*\n/m, "");
if (s !== before1) done.push("1. Đã bỏ import Firebase Storage");

// ---------- 2. Thay hàm handleCreateHskExam ----------
const NEW_CREATE = `const handleCreateHskExam = async (e) => {
    e.preventDefault();
    if (!newHskExamName.trim() || !selectedHskExamFile) {
      return alert("Vui lòng nhập tên đề thi và chọn tệp .html!");
    }
    if (selectedHskExamFile.size > 900 * 1024) {
      return alert("Tệp quá lớn (>900KB). Hãy dùng bản HTML đã tách ảnh/audio ra public/.");
    }

    try {
      setIsSubmitting(true);
      const htmlContent = await selectedHskExamFile.text();

      await addDoc(collection(db, "hsk3_exams_bank"), {
        examName: newHskExamName.trim(),
        level: newHskExamLevel,
        htmlContent,
        createdAt: serverTimestamp()
      });

      alert("✅ Đã tải lên đề thi HSK 3.0 thành công!");
      setIsAddHskExamModalOpen(false);
      setNewHskExamName("");
      setSelectedHskExamFile(null);
      fetchHsk3Exams();
    } catch (err) {
      alert("Lỗi khi tải lên đề thi: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  `;
const a2 = s.indexOf("const handleCreateHskExam");
const b2 = s.indexOf("const handleDeleteHskExam");
if (s.includes("selectedHskExamFile.text()")) { /* đã sửa rồi */ }
else if (a2 !== -1 && b2 > a2) { s = s.slice(0, a2) + NEW_CREATE + s.slice(b2); done.push("2. Đã thay hàm handleCreateHskExam"); }
else console.warn("⚠️  Bước 2: không tìm thấy handleCreateHskExam / handleDeleteHskExam");

// ---------- 3. iframe xem thử dùng srcDoc ----------
const before3 = s;
s = s.replace(/<iframe\s+src=\{activeHskExamView\.fileUrl\}/,
  "<iframe {...(activeHskExamView.htmlContent ? { srcDoc: activeHskExamView.htmlContent } : { src: activeHskExamView.fileUrl })}");
if (s !== before3) done.push("3. Đã sửa iframe xem thử (srcDoc)");
else console.warn("⚠️  Bước 3: không tìm thấy <iframe src={activeHskExamView.fileUrl}");

// ---------- 4. Mỗi cấp độ hiển thị nhiều đề ----------
const NEW_GRID = `{HSK3_LEVELS.map(lvl => {
                    const exams = hsk3ExamsList
                      .filter(e => e.level === lvl)
                      .sort((a, b) => (a.examName || "").localeCompare(b.examName || "", undefined, { numeric: true }));
                    return (
                      <div key={lvl} className={\`p-6 rounded-3xl border-2 flex flex-col \${exams.length ? 'bg-white border-[#10B981]/30 shadow-sm' : 'bg-[#F8FAFC] border-[#E2E8F0]'}\`}>
                        <div className="flex justify-between items-center mb-4">
                          <span className="bg-[#142033] text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md">{lvl}</span>
                          <span className={\`text-[10px] font-black px-2.5 py-1 rounded-full \${exams.length ? 'bg-[#ECFDF5] text-[#10B981] border border-[#A7F3D0]' : 'bg-amber-50 text-amber-600 border border-amber-200'}\`}>
                            {exams.length ? \`✓ \${exams.length} đề\` : "⏳ Đang update"}
                          </span>
                        </div>
                        {exams.length === 0 ? (
                          <p className="text-xs text-[#64748B] font-medium">Chưa có đề thi cho cấp độ này.</p>
                        ) : (
                          <div className="space-y-2">
                            {exams.map(ex => (
                              <div key={ex.id} className="flex items-center gap-2 p-2 rounded-xl border border-slate-100">
                                <p className="flex-1 text-sm font-bold text-[#142033] truncate">{ex.examName}</p>
                                <button onClick={() => setActiveHskExamView(ex)} className="px-3 py-1.5 bg-[#10B981] hover:bg-[#059669] text-white rounded-lg font-black text-[10px]">🖥️ Xem</button>
                                <button onClick={() => handleDeleteHskExam(ex.id)} className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg font-black text-[10px] border border-rose-200">🗑</button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}`;
let a4 = -1, from = 0;
while ((from = s.indexOf("{HSK3_LEVELS.map(lvl => {", from)) !== -1) {
  if (s.slice(from, from + 300).includes("examForLevel")) { a4 = from; break; }
  from++;
}
if (a4 !== -1) {
  let depth = 0, b4 = -1;
  for (let i = a4; i < s.length; i++) {
    if (s[i] === "{") depth++;
    else if (s[i] === "}") { depth--; if (depth === 0) { b4 = i + 1; break; } }
  }
  if (b4 > a4) { s = s.slice(0, a4) + NEW_GRID + s.slice(b4); done.push("4. Đã cho mỗi cấp độ hiển thị nhiều đề"); }
  else console.warn("⚠️  Bước 4: không xác định được điểm kết thúc khối");
} else console.warn("⚠️  Bước 4: không tìm thấy khối HSK3_LEVELS.map dùng examForLevel (có thể đã sửa rồi)");

if (s.includes("uploadBytes") || /\bstorage\b,\s*`hsk3_exams/.test(s)) console.warn("⚠️  Trong file vẫn còn chỗ dùng uploadBytes/Storage — gửi file cho Claude kiểm tra.");

if (!done.length) { console.log("Không có thay đổi nào."); process.exit(0); }
if (!fs.existsSync(FILE + ".bak")) fs.writeFileSync(FILE + ".bak", raw);
fs.writeFileSync(FILE, CRLF ? s.replace(/\n/g, "\r\n") : s);
console.log("✅ Hoàn tất. Bản sao lưu: " + FILE + ".bak");
done.forEach(d => console.log("   " + d));
