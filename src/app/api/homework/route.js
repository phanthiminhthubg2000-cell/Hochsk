// Chấm bài tập về nhà viết tay (HSK4–5): ảnh chụp → Gemini đọc chữ viết tay, chấm tóm tắt bài khoá / bài văn, nhận xét bằng tiếng Việt.
// Gọi từ trang giáo viên (kết quả không hiển thị cho học viên).
import { guard } from "@/lib/apiGuard";
import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const maxDuration = 60;
const MODELS = [["gemini-3.5-flash", 42000], ["gemini-3.5-flash-lite", 15000]];

function prompt(b) {
  const lv = String(b.level || "HSK4–5");
  const common = `Bạn là giáo viên tiếng Trung giàu kinh nghiệm, chấm bài tập về nhà VIẾT TAY của học viên người Việt trình độ ${lv}. Các ảnh đính kèm là bài viết tay (có thể nhiều trang, theo thứ tự).
Bước 1 — "ocr": chép lại CHÍNH XÁC từng chữ học viên viết, giữ xuống dòng. Đây là bài để chấm lỗi nên TUYỆT ĐỐI KHÔNG tự sửa: chữ viết sai/nhầm chữ đồng âm (vd 时侯 thay vì 时候, 羡幕 thay vì 羡慕), thiếu/thừa nét, sai ngữ pháp đều phải chép y nguyên như trên giấy — nhìn kỹ từng chữ trước khi chép. Chữ không đọc được ghi [?]. Bỏ phần đề bài in sẵn nếu có.
Bước 2 — chấm và nhận xét bằng tiếng Việt, cụ thể, thẳng thắn nhưng khích lệ.
Chỉ trả JSON hợp lệ, không markdown.`;
  const tail = `"errors": tối đa 8 lỗi quan trọng nhất, ưu tiên lỗi chữ viết sai và lỗi ngữ pháp [{"wrong":"cụm sai, chép đúng nguyên văn như trong ocr","right":"câu/cụm đã sửa, viết HOÀN TOÀN bằng tiếng Trung (chữ Hán + dấu câu Trung) — tuyệt đối không chen chữ tiếng Việt; giải thích để ở why","type":"chữ viết|từ vựng|ngữ pháp|dấu câu|diễn đạt|nội dung","why":"giải thích ngắn"}],
"upgrades": 2–3 câu viết lại hay hơn [{"orig":"câu của học viên","better":"câu nâng cấp đúng trình độ ${lv}"}],
"strengths": 1–3 điểm tốt, "comment": 2–4 câu nhận xét chung để giáo viên gửi học viên, "tips": 1–3 việc nên luyện tiếp,
"hand": nhận xét ngắn về chữ viết tay (nét, bộ thủ hay viết sai), "chars": số chữ Hán học viên viết.`;
  if (b.part === "essay") {
    return `${common}
Dạng bài: VIẾT BÀI VĂN (作文).${b.prompt ? `\nĐỀ BÀI / CHỦ ĐỀ: ${b.prompt}` : "\nKhông có đề cụ thể — tự nhận chủ đề từ bài viết."}
${taskText(b.task)}
${b.lectureText ? `Bài học liên quan (để biết từ vựng/ngữ pháp trọng tâm học viên nên dùng):\n"""${String(b.lectureText).slice(0, 12000)}"""` : ""}
Chấm (0–100 mỗi mục): content (bám đề, ý phong phú, có ví dụ), structure (mở – thân – kết, từ nối), vocab (đúng, phong phú, dùng từ của bài học), grammar (chính xác, đa dạng cấu trúc), length (đủ dài: HSK4 ≥ 150 chữ, HSK5 ≥ 250 chữ).
total = round(content*0.3 + structure*0.15 + vocab*0.2 + grammar*0.25 + length*0.1).
JSON: {"ocr":"","score":{"content":0,"structure":0,"vocab":0,"grammar":0,"length":0,"total":0},
${tail}
"req_check": đối chiếu từng yêu cầu bài tập (nếu có) [{"req":"","ok":true,"note":""}],
"sample": "bài văn mẫu ngắn cùng đề, đúng trình độ (để giáo viên tham khảo)"}`;
  }
  const ns = (/^kw\d+$/.test(b.part || "") ? b.part.slice(2).split("").map(Number) : [1]).filter((x) => x >= 1 && x <= 5);
  const zh = (x) => "一二三四五"[x - 1];
  const list = ns.map((x) => `课文${zh(x)}`).join("、");
  return `${common}
Dạng bài: TÓM TẮT BÀI KHOÁ (缩写) — học viên tóm tắt ${ns.length > 1 ? `${ns.length} bài khoá ${list} (thường viết liền trên cùng tờ giấy, theo thứ tự; nhận ra ranh giới từng đoạn qua tiêu đề/số thứ tự hoặc nội dung)` : list} bằng lời của mình.
${taskText(b.task)}
${b.lectureText ? `Dưới đây là chữ của bài giảng có chứa các bài khoá. Tìm đúng ${list} làm BÀI GỐC (trong dữ liệu có thể đánh dấu "课文一…" hoặc "### 课文 n: 1…"; chỉ lấy lời bài khoá — hội thoại/đoạn văn — bỏ phần từ vựng, ví dụ, bài tập):\n"""${String(b.lectureText).slice(0, 30000)}"""` : `Không có văn bản bài khoá — chấm dựa trên sự mạch lạc và ngôn ngữ; "source_found": false, để "points" rỗng.`}
- Đọc kỹ bài gốc, phân biệt rõ nhân vật nào nói/làm gì; học viên kể nhầm thông tin thì ghi vào errors với type "nội dung".
- "sections": mỗi bài khoá một mục [{"n":số bài khoá (${ns.join(",")}),"title":"tiêu đề bài khoá gốc","written":true/false — học viên có viết phần này không,"points":[4–6 ý chính {"vi":"ý chính (tiếng Việt)","hit":true/false}],"kw_used":["từ mới của bài khoá này học viên đã dùng"],"kw_missing":["từ mới yêu cầu mà chưa dùng"],"score":0–100,"comment":"1–2 câu nhận xét riêng đoạn này"}].
- "req_check": đối chiếu từng yêu cầu bài tập (nếu có) [{"req":"yêu cầu","ok":true/false,"note":"ngắn"}].
Chấm chung (0–100 mỗi mục): coverage (đủ ý chính, đúng trình tự, làm đủ các bài khoá được giao), own (bằng lời của mình, độ dài đúng yêu cầu), grammar (chính xác), vocab (dùng đúng và đủ từ mới yêu cầu).
total = round(coverage*0.4 + own*0.15 + grammar*0.3 + vocab*0.15).
JSON: {"ocr":"","source_found":true,"sections":[],"req_check":[],"score":{"coverage":0,"own":0,"grammar":0,"vocab":0,"total":0},
${tail}
"sample": "bản tóm tắt mẫu cho ${list}, mỗi bài 3–4 câu, đúng trình độ (để giáo viên tham khảo)"}`;
}

// yêu cầu bài tập lấy từ slide bài giảng (HSK4)
function taskText(t) {
  if (!t || !t.t) return "";
  return `YÊU CẦU BÀI TẬP CÔ GIAO (trong slide bài giảng): ${t.t}
${(t.req || []).map((r) => "- " + r).join("\n")}${(t.kw || []).length ? "\nTừ mới yêu cầu dùng theo từng bài khoá:\n" + t.kw.map((x) => (Array.isArray(x) ? `- ${x[0]}: ${x[1]}` : `- ${x.k}: ${x.v}`)).join("\n") : ""}
Chấm bám sát các yêu cầu này (số câu, số từ mới phải dùng…). Danh sách từ mới là để chọn: yêu cầu "ít nhất N từ" thì dùng đủ N từ là ĐẠT, không bắt dùng hết.`;
}

export async function POST(req) {
  const blocked = await guard("homework", 300);
  if (blocked) return blocked;
  try {
    const b = await req.json();
    const imgs = (Array.isArray(b?.images) ? b.images : []).filter((x) => typeof x === "string" && x.startsWith("data:image/")).slice(0, 5);
    if (!imgs.length) return NextResponse.json({ error: "Không có ảnh bài làm." }, { status: 400 });
    if (imgs.join("").length > 8_000_000) return NextResponse.json({ error: "Ảnh quá lớn." }, { status: 413 });
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Thiếu API Key." }, { status: 500 });
    const genAI = new GoogleGenerativeAI(apiKey);
    const parts = [{ text: prompt(b) }, ...imgs.map((d) => ({ inlineData: { data: d.replace(/^data:[^,]+,/, ""), mimeType: d.slice(5, d.indexOf(";")) || "image/jpeg" } }))];
    let last = null;
    for (const [m, timeout] of MODELS) {
      try {
        const model = genAI.getGenerativeModel({ model: m, generationConfig: { responseMimeType: "application/json", temperature: 0.2 } }, { timeout });
        const r = await model.generateContent(parts);
        const d = JSON.parse(r.response.text().replace(/```json|```/g, "").trim());
        return NextResponse.json({ ...(Array.isArray(d) ? d[0] : d), model: m });
      } catch (e) { last = e; }
    }
    console.error("homework:", last);
    return NextResponse.json({ error: "AI đang quá tải, thử lại sau ít phút." }, { status: 503 });
  } catch (e) {
    console.error("homework:", e);
    return NextResponse.json({ error: "Lỗi chấm bài: " + e.message }, { status: 500 });
  }
}
