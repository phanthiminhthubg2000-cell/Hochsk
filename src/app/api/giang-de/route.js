// GIẢNG ĐỀ: AI soạn phần chữa đề cho MỘT nhóm câu (một unit của đề) — đáp án & căn cứ, vì sao phương án khác sai,
// kiến thức trọng điểm, từ vựng, mẹo làm bài; kèm chiến lược làm cả phần. Giáo viên sửa lại rồi mới trình chiếu.
import { guard } from "@/lib/apiGuard";
import { NextResponse } from "next/server";
import { raceJSON } from "@/lib/geminiRace";

export const maxDuration = 120;

const LANG = {
  vi: "Viết bằng TIẾNG VIỆT, trích nguyên văn chữ Hán khi dẫn chứng (kèm pinyin cho từ khó). Xưng \"cô\", gọi học viên là \"các em\".",
  zh: "全部用简体中文书写（生词可加拼音）。语气像老师给学生讲题，称学生为“同学们”。",
};

const PROMPT = ({ level, center, part, head, passage, qs, lang }) => `Bạn là giáo viên luyện thi HSK ${level} (${center}) giàu kinh nghiệm, đang soạn bài CHỮA ĐỀ để giảng trên lớp cho học viên người Việt.
${LANG[lang] || LANG.vi}

Phần đề: ${part}${head ? ` — ${head}` : ""}
${passage ? `Bài đọc chung của nhóm câu:\n${passage}\n` : ""}
Các câu cần chữa:
${qs}

Với MỖI câu, soạn:
- "key": đáp án đúng và CĂN CỨ: chỉ ra đúng câu/cụm từ trong lời nghe hoặc bài đọc dẫn tới đáp án (trích nguyên văn), giải thích cách suy luận (đồng nghĩa, nói ngược, hàm ý, thành ngữ…). Câu sắp xếp: giải thích trật tự (chủ – vị – tân, trạng ngữ, bổ ngữ, 把/被…). Câu viết: dàn ý + bài mẫu ngắn đúng trình độ. 2–5 câu.
- "traps": với câu trắc nghiệm, mỗi phương án sai 1 dòng "A: lý do sai / bẫy gì" (bỏ qua đáp án đúng). Câu không có phương án: lỗi học viên hay mắc.
- "point": 1–3 điểm ngữ pháp / cấu trúc / thành ngữ / kiến thức trọng điểm rút ra từ câu này, có ví dụ ngắn.
- "vocab": 3–6 từ đáng học trong câu, mỗi dòng "词语 pinyin – nghĩa tiếng Việt".
- "tip": 1 mẹo ngắn để làm nhanh dạng câu này.
Thêm "strategy": 2–4 câu về chiến lược làm cả phần này (đọc trước phương án, nghe từ khoá gì…).
Không bịa nội dung không có trong đề. Nếu đáp án cho sẵn có vẻ sai, vẫn giải thích theo đáp án cho sẵn nhưng ghi chú "(cần kiểm tra lại đáp án)".
Chỉ trả JSON: {"strategy":"","items":[{"n":0,"key":"","traps":"","point":"","vocab":"","tip":""}]}`;

export async function POST(request) {
  const blocked = await guard("giang-de", 120);
  if (blocked) return blocked;
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Thiếu API Key." }, { status: 500 });
    const b = await request.json();
    const qs = String(b.qs || "").slice(0, 24000);
    if (!qs) return NextResponse.json({ error: "Thiếu câu hỏi." }, { status: 400 });
    const d = await raceJSON(
      apiKey,
      PROMPT({ level: String(b.level || "").slice(0, 4), center: String(b.center || "").slice(0, 20), part: String(b.part || "").slice(0, 60), head: String(b.head || "").slice(0, 200), passage: String(b.passage || "").slice(0, 6000), qs, lang: b.lang === "zh" ? "zh" : "vi" }),
      { head: 30000, deadline: 112000, temperature: 0.4 }
    );
    const s = (x) => (Array.isArray(x) ? x.join("\n") : typeof x === "object" && x ? Object.entries(x).map(([k, v]) => `${k}: ${v}`).join("\n") : String(x ?? "")).trim();
    const items = (Array.isArray(d.items) ? d.items : []).map((x) => ({ n: Number(x.n), key: s(x.key), traps: s(x.traps), point: s(x.point), vocab: s(x.vocab), tip: s(x.tip) })).filter((x) => x.n);
    return NextResponse.json({ strategy: s(d.strategy), items, model: d.model });
  } catch (e) {
    const msg = String(e?.message || e);
    const busy = /429|503|overload|quota|timeout|exhaust/i.test(msg);
    return NextResponse.json({ error: busy ? "AI đang quá tải, thử lại sau ít phút." : "Lỗi AI: " + msg.slice(0, 200) }, { status: busy ? 503 : 500 });
  }
}
