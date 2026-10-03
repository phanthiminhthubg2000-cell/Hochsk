// Trang học viên: mỗi cấp độ HSK 3.0 hiển thị TẤT CẢ đề (thay vì chỉ 1 đề)
// Cách chạy (tại thư mục gốc flashcard-app):  node fix-hsk3-student-list.mjs
import fs from "fs";

const FILE = "src/app/page.js";
if (!fs.existsSync(FILE)) { console.error("❌ Không tìm thấy " + FILE + ". Hãy chạy lệnh trong thư mục flashcard-app."); process.exit(1); }
const raw = fs.readFileSync(FILE, "utf8");
const CRLF = raw.includes("\r\n");
let s = raw.replace(/\r\n/g, "\n");
const done = [];

const NEW_GRID = `{HSK3_LEVELS.map(lvl => {
                  const exams = hsk3ExamsList
                    .filter(e => e.level === lvl)
                    .sort((a, b) => (a.examName || "").localeCompare(b.examName || "", undefined, { numeric: true }));
                  const hasExam = exams.length > 0;

                  return (
                    <div key={lvl} className={\`p-6 rounded-3xl border-2 transition-all flex flex-col \${hasExam ? 'bg-white border-[#8FD9A8] shadow-md hover:shadow-lg' : 'bg-white/50 border-[#E2E8F0] opacity-80'}\`}>
                      <div className="flex justify-between items-center mb-4">
                        <span className="bg-[#1B5E4B] text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md">{lvl}</span>
                        <span className={\`text-[10px] font-black px-2.5 py-1 rounded-full \${hasExam ? 'bg-[#EEF5E9] text-[#2F8F6E] border border-[#8FD9A8]' : 'bg-amber-50 text-amber-600 border border-amber-200'}\`}>
                          {hasExam ? \`✓ \${exams.length} đề\` : "⏳ Đang update"}
                        </span>
                      </div>

                      {hasExam ? (
                        <div className="space-y-2.5">
                          {exams.map(ex => (
                            <div key={ex.id} className="flex items-center gap-3 p-3 rounded-2xl bg-[#F7FAF3] border border-[#8FD9A8]/40 hover:border-[#2F8F6E] transition-colors">
                              <p className="flex-1 min-w-0 font-black text-sm text-[#1B5E4B] truncate">{ex.examName}</p>
                              <button
                                onClick={() => setActiveHskExamView(ex)}
                                className="shrink-0 px-4 py-2 bg-[#2F8F6E] hover:bg-[#1B5E4B] text-white rounded-xl font-black text-[11px] shadow-sm transition"
                              >
                                🚀 Vào thi
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <>
                          <h4 className="font-black text-lg text-[#1B5E4B] mb-1">Chưa có đề thi</h4>
                          <p className="text-xs text-slate-500 font-medium mb-6">Giáo viên đang cập nhật nội dung cho cấp độ này.</p>
                          <button disabled className="mt-auto w-full py-3.5 bg-slate-200 text-slate-400 rounded-2xl font-bold text-xs cursor-not-allowed">
                            Sắp ra mắt
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}`;

let a = -1, from = 0;
while ((from = s.indexOf("{HSK3_LEVELS.map(lvl => {", from)) !== -1) {
  if (s.slice(from, from + 300).includes("examForLevel")) { a = from; break; }
  from++;
}
if (a !== -1) {
  let depth = 0, b = -1;
  for (let i = a; i < s.length; i++) {
    if (s[i] === "{") depth++;
    else if (s[i] === "}") { depth--; if (depth === 0) { b = i + 1; break; } }
  }
  if (b > a) { s = s.slice(0, a) + NEW_GRID + s.slice(b); done.push("Mỗi cấp độ hiển thị tất cả đề, sắp theo tên"); }
} else console.warn("⚠️  Không tìm thấy khối HSK3_LEVELS.map dùng examForLevel (có thể đã sửa rồi)");

// Bổ sung hàm handleChangeLevel nếu đang bị thiếu (nút chọn mốc HSK 1–9 ở trang chủ)
if (s.includes("handleChangeLevel(") && !/(const|function)\s+handleChangeLevel\b/.test(s)) {
  const anchor = "  const handleExchangeXpForWater";
  if (s.includes(anchor)) {
    s = s.replace(anchor, `  const handleChangeLevel = async (lvl) => {
    setCurrentLevel(lvl);
    if (userId) {
      try {
        await setDoc(doc(db, "users", userId), { currentLevel: lvl }, { merge: true });
      } catch (err) { console.error("Lỗi đổi cấp độ:", err); }
    }
  };

` + anchor);
    done.push("Bổ sung hàm handleChangeLevel (trước đây bị thiếu)");
  }
}

if (!done.length) { console.log("Không có thay đổi nào."); process.exit(0); }
if (!fs.existsSync(FILE + ".bak")) fs.writeFileSync(FILE + ".bak", raw);
else fs.writeFileSync(FILE + ".bak2", raw);
fs.writeFileSync(FILE, CRLF ? s.replace(/\n/g, "\r\n") : s);
console.log("✅ Hoàn tất " + FILE);
done.forEach(d => console.log("   • " + d));
