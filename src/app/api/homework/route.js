// Chấm bài tập về nhà viết tay (HSK4–5): ảnh chụp → Gemini đọc chữ viết tay, chấm tóm tắt bài khoá / bài văn, nhận xét bằng tiếng Việt.
// Gọi từ trang giáo viên (kết quả không hiển thị cho học viên).
import { guard } from "@/lib/apiGuard";
import { NextResponse } from "next/server";
import { raceJSON } from "@/lib/geminiRace";

export const maxDuration = 180; // bài nhiều trang + tóm tắt + bài văn cần thời gian đọc chữ viết tay

// HSK4, HSK5: toàn bộ nhận xét bằng tiếng Trung (giáo viên yêu cầu)
const ZH_RULE = (lvN) => `
QUAN TRỌNG — NGÔN NGỮ: học viên trình độ HSK${lvN} nên TOÀN BỘ phần nhận xét viết bằng TIẾNG TRUNG giản thể (không dùng tiếng Việt, không pinyin, không tiếng Anh), thay cho mọi chỗ ở trên ghi "tiếng Việt". Áp dụng cho: comment, strengths, tips, hand, errors[].why, errors[].type, sections[].title, sections[].points[].vi, sections[].comment, req_check[].req/note, essay.topic, essay.comment.
Giọng: như cô giáo viết cho học trò — xưng "老师", gọi "你"; câu ngắn, tự nhiên, dùng từ vựng – ngữ pháp trong tầm HSK${lvN}${lvN === "4" ? " (câu đơn giản, dễ hiểu)" : ""}; không sáo rỗng (không "非常棒""继续加油""总的来说""总体而言"), không dấu chấm than. Khen cụ thể, chỉ lỗi cụ thể. "why" ≤ 15 chữ Hán.`;
// đề bài văn lấy từ bài giảng (khẩu ngữ buổi 2 / 口语专题 / câu 72) + bài mẫu của giáo trình để AI đối chiếu
function essayRefText(b) {
  const r = b.essayRef; if (!r) return "";
  return `\nĐề này lấy từ bài giảng (${String(r.label || "").slice(0, 60)}) — chấm bám sát đúng đề này.${r.sample ? `\nBài mẫu của bài giảng (chỉ để tham khảo ý và độ dài, không bắt học viên viết giống):\n"""${String(r.sample).slice(0, 2000)}"""` : ""}`;
}
function prompt(b) {
  const lv = String(b.level || "HSK4–5");
  const m = lv.match(/HSK\s*([45])/i);
  return promptBody(b, lv) + (m ? ZH_RULE(m[1]) : "");
}
function promptBody(b, lv) {
  const common = `Bạn là giáo viên tiếng Trung giàu kinh nghiệm, chấm bài tập về nhà VIẾT TAY của học viên người Việt trình độ ${lv}. Các ảnh đính kèm là bài viết tay (có thể nhiều trang, theo thứ tự).
Bước 1 — "ocr": chép lại CHÍNH XÁC từng chữ học viên viết, giữ xuống dòng. Đây là bài để chấm lỗi nên TUYỆT ĐỐI KHÔNG tự sửa: chữ viết sai/nhầm chữ đồng âm (vd 时侯 thay vì 时候, 羡幕 thay vì 羡慕), thiếu/thừa nét, sai ngữ pháp đều phải chép y nguyên như trên giấy — nhìn kỹ từng chữ trước khi chép. Chữ không đọc được ghi [?]. Bỏ phần đề bài in sẵn nếu có.
Bước 2 — chấm và nhận xét bằng tiếng Việt.
GIỌNG VĂN (rất quan trọng): viết như cô giáo người Việt nhắn tin Zalo cho học trò — xưng "cô", gọi học viên là "bạn" (không gọi "em"), câu ngắn, nói thẳng vào việc, tự nhiên như người thật nói.
- KHÔNG khen chung chung, KHÔNG sáo rỗng kiểu văn AI: cấm các cụm "bài viết rất hay", "hành văn mượt mà", "chỉn chu", "tuyệt vời", "đáng khen", "xuất sắc", "hãy tiếp tục phát huy", "chú ý một chút", "nhìn chung", "tổng thể"; không dùng dấu chấm than; không mở đầu bằng lời khen rồi "tuy nhiên".
- Khen thì khen cụ thể (trích đúng từ/cấu trúc bạn ấy dùng tốt). Chê thì chỉ đúng chỗ.
- Mọi phần giải thích chỉ bằng tiếng Việt, không chen tiếng Anh.
Chỉ trả JSON hợp lệ, không markdown.`;
  const tail = `"errors": tối đa 8 lỗi quan trọng nhất, ưu tiên lỗi chữ viết sai và lỗi ngữ pháp [{"wrong":"cụm sai, chép đúng nguyên văn như trong ocr","right":"câu/cụm đã sửa, viết HOÀN TOÀN bằng tiếng Trung (chữ Hán + dấu câu Trung) — tuyệt đối không chen chữ tiếng Việt; giải thích để ở why","type":"chữ viết|từ vựng|ngữ pháp|dấu câu|diễn đạt|nội dung","why":"giải thích tiếng Việt, tối đa 15 chữ, vd: \"候 có thêm nét sổ, khác 侯\""}],
"upgrades": 2 câu viết lại cho tự nhiên hơn [{"orig":"câu của học viên","better":"giữ nguyên ý của học viên, chỉ sửa cho giống người Trung Quốc nói/viết bình thường, đúng trình độ ${lv}; không thêm thành ngữ, không văn hoa"}],
"strengths": 1–2 điểm tốt cụ thể (ngắn), "comment": TỐI ĐA 2 câu ngắn (≤ 40 chữ) nhận xét chính để cô gửi học viên, "tips": 1–2 việc cần luyện, mỗi việc ≤ 12 chữ,
"hand": nhận xét ngắn về chữ viết tay (nét, bộ thủ hay viết sai), "chars": số chữ Hán học viên viết.`;
  if (b.part === "essay") {
    return `${common}
Dạng bài: VIẾT BÀI VĂN (作文).${b.prompt ? `\nĐỀ BÀI / CHỦ ĐỀ: ${b.prompt}` : "\nKhông có đề cụ thể — tự nhận chủ đề từ bài viết."}${essayRefText(b)}
${taskText(b.task)}
${b.lectureText ? `Bài học liên quan (để biết từ vựng/ngữ pháp trọng tâm học viên nên dùng):\n"""${String(b.lectureText).slice(0, 12000)}"""` : ""}
Chấm (0–100 mỗi mục): content (bám đề, ý phong phú, có ví dụ), structure (mở – thân – kết, từ nối), vocab (đúng, phong phú, dùng từ của bài học), grammar (chính xác, đa dạng cấu trúc), length (đủ dài: ${b.essayRef?.min ? `≥ ${b.essayRef.min} chữ theo đề` : "HSK4 ≥ 150 chữ, HSK5 ≥ 250 chữ"}).
total = round(content*0.3 + structure*0.15 + vocab*0.2 + grammar*0.25 + length*0.1).
JSON: {"ocr":"","score":{"content":0,"structure":0,"vocab":0,"grammar":0,"length":0,"total":0},
${tail}
"req_check": đối chiếu từng yêu cầu bài tập (nếu có) [{"req":"","ok":true,"note":""}],
"sample": "bài văn mẫu ngắn cùng đề, đúng trình độ (để giáo viên tham khảo)"}`;
  }
  const m = String(b.part || "").match(/^kw(\d+)/);
  const ns = (m ? m[1].split("").map(Number) : [1]).filter((x) => x >= 1 && x <= 5);
  const withEssay = /\+essay$/.test(b.part || "");
  const h5 = /HSK\s*5/i.test(lv) && ns.length === 1;
  const zh = (x) => "一二三四五"[x - 1];
  const list = h5 ? "课文 (bài khoá duy nhất của bài học)" : ns.map((x) => `课文${zh(x)}`).join("、");
  const essayPart = withEssay ? `
PHẦN 2 — VIẾT BÀI VĂN (作文): trên cùng các ảnh, sau (hoặc trước) phần tóm tắt, học viên còn viết một bài văn.${b.prompt ? ` Đề bài: ${b.prompt}.` : " Không có đề cụ thể — tự nhận chủ đề từ bài viết."}${essayRefText(b)} Tách rõ hai phần (dựa vào tiêu đề, số thứ tự, nội dung). Ghi cả hai phần vào "ocr" (đánh dấu "【缩写】" và "【作文】" ở đầu mỗi phần).
Chấm bài văn riêng trong "essay" (0–100 mỗi mục): content, structure, vocab (dùng từ của bài học), grammar, length (${b.essayRef?.min ? `≥ ${b.essayRef.min} chữ theo đề` : "HSK5 ≥ 250 chữ, HSK4 ≥ 150 chữ"}); total = round(content*0.3 + structure*0.15 + vocab*0.2 + grammar*0.25 + length*0.1).
"errors" và "upgrades" gộp lỗi của cả hai phần. "score" là phần tóm tắt.` : "";
  return `${common}
Dạng bài: TÓM TẮT BÀI KHOÁ (缩写) — học viên tóm tắt ${ns.length > 1 ? `${ns.length} bài khoá ${list} (thường viết liền trên cùng tờ giấy, theo thứ tự; nhận ra ranh giới từng đoạn qua tiêu đề/số thứ tự hoặc nội dung)` : list} bằng lời của mình.
${taskText(b.task)}
${b.lectureText ? `Dưới đây là chữ của bài giảng có chứa các bài khoá. Tìm đúng ${list} làm BÀI GỐC (trong dữ liệu có thể đánh dấu "课文一…" hoặc "### 课文 n: 1…"; chỉ lấy lời bài khoá — hội thoại/đoạn văn — bỏ phần từ vựng, ví dụ, bài tập):\n"""${String(b.lectureText).slice(0, 20000)}"""` : `Không có văn bản bài khoá — chấm dựa trên sự mạch lạc và ngôn ngữ; "source_found": false, để "points" rỗng.`}
- Đọc kỹ bài gốc, phân biệt rõ nhân vật nào nói/làm gì; học viên kể nhầm thông tin thì ghi vào errors với type "nội dung".
- "sections": mỗi bài khoá một mục [{"n":số bài khoá (${ns.join(",")}),"title":"tiêu đề bài khoá gốc","written":true/false — học viên có viết phần này không,"points":[4–6 ý chính {"vi":"ý chính (tiếng Việt)","hit":true/false}],"kw_used":["từ mới của bài khoá này học viên đã dùng"],"kw_missing":["từ mới yêu cầu mà chưa dùng"],"score":0–100,"comment":"1 câu ngắn ≤ 20 chữ"}].
- "req_check": đối chiếu từng yêu cầu bài tập (nếu có) [{"req":"yêu cầu","ok":true/false,"note":"ngắn"}].
Chấm chung (0–100 mỗi mục): coverage (đủ ý chính, đúng trình tự, làm đủ các bài khoá được giao), own (bằng lời của mình, độ dài đúng yêu cầu), grammar (chính xác), vocab (dùng đúng và đủ từ mới yêu cầu).
total = round(coverage*0.4 + own*0.15 + grammar*0.3 + vocab*0.15).
${essayPart}
JSON: {"ocr":"","source_found":true,"sections":[],"req_check":[],"score":{"coverage":0,"own":0,"grammar":0,"vocab":0,"total":0},
${withEssay ? `"essay":{"written":true,"topic":"đề/chủ đề bài văn","score":{"content":0,"structure":0,"vocab":0,"grammar":0,"length":0,"total":0},"chars":0,"comment":"1 câu ≤ 25 chữ"},` : ""}
${tail}
"sample": "bản tóm tắt mẫu cho ${list}, mỗi bài 3–4 câu, đúng trình độ${withEssay ? "; sau đó một bài văn mẫu ngắn cùng đề" : ""} (để giáo viên tham khảo)"}`;
}

// yêu cầu bài tập lấy từ slide bài giảng (HSK4)
function taskText(t) {
  if (!t || !t.t) return "";
  return `YÊU CẦU BÀI TẬP CÔ GIAO (trong slide bài giảng): ${t.t}
${(t.req || []).map((r) => "- " + r).join("\n")}${(t.kw || []).length ? "\nTừ mới yêu cầu dùng theo từng bài khoá:\n" + t.kw.map((x) => (Array.isArray(x) ? `- ${x[0]}: ${x[1]}` : `- ${x.k}: ${x.v}`)).join("\n") : ""}
Chấm bám sát các yêu cầu này (số câu, số từ mới phải dùng…). Danh sách từ mới là để chọn: yêu cầu "ít nhất N từ" thì dùng đủ N từ là ĐẠT, không bắt dùng hết.`;
}

// phần sửa phải là tiếng Trung thuần: bỏ chữ Latin/tiếng Việt lỡ chen vào
const zhOnly = (t) => String(t || "").replace(/[（(][^）)]*[A-Za-zÀ-ỹ][^）)]*[）)]/g, "").replace(/[A-Za-zÀ-ỹ][A-Za-zÀ-ỹ0-9\s/'’-]*/g, "").replace(/\s+/g, "").trim();
function clean(d) {
  if (!d || typeof d !== "object") return d;
  // nộp cùng tóm tắt + bài văn: điểm tổng = trung bình hai phần
  if (d.essay?.score?.total != null && d.score?.total != null) { d.score.summary = d.score.total; d.score.essay = d.essay.score.total; d.score.total = Math.round((Number(d.score.summary) + Number(d.essay.score.total)) / 2); }
  d.errors = (d.errors || []).map((e) => ({ ...e, right: zhOnly(e.right) || e.right })).filter((e) => e.wrong && e.right && e.wrong !== e.right);
  d.upgrades = (d.upgrades || []).map((u) => ({ ...u, better: zhOnly(u.better) || u.better }));
  return d;
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
    const parts = [{ text: prompt(b) }, ...imgs.map((d) => ({ inlineData: { data: d.replace(/^data:[^,]+,/, ""), mimeType: d.slice(5, d.indexOf(";")) || "image/jpeg" } }))];
    try {
      const d = await raceJSON(apiKey, parts, { head: 50000, deadline: 170000, temperature: 0.2 });
      return NextResponse.json({ ...clean(d), model: d.model });
    } catch (e) {
      console.error("homework:", e);
      return NextResponse.json({ error: "AI đang quá tải hoặc đọc bài quá lâu, bấm chấm lại sau ít phút." }, { status: 503 });
    }
  } catch (e) {
    console.error("homework:", e);
    return NextResponse.json({ error: "Lỗi chấm bài: " + e.message }, { status: 500 });
  }
}
