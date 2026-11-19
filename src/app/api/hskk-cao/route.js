// Chấm bài nói HSKK cao cấp: 听后复述 (retell) · 回答问题 (answer) · 朗读 (read)
// Nhận ghi âm (base64) + bài gốc/câu hỏi → Gemini nghe, chép lời, chấm và nhận xét bằng tiếng Việt
import { guard } from "@/lib/apiGuard";
import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const maxDuration = 60;
const MODELS = [["gemini-3.8-flash", 24000], ["gemini-3.5-flash", 14000], ["gemini-3.5-flash-lite", 18000]]; // [model, thời gian chờ tối đa]

const COMMON = `Bạn là giám khảo HSKK 高级 giàu kinh nghiệm, chấm cho học viên người Việt. Nghe kỹ file ghi âm của học viên.
- "transcript": chép lại CHÍNH XÁC những gì học viên nói bằng chữ Hán (nói sai thì chép đúng như nghe được, không sửa). Nếu gần như không nghe thấy tiếng nói, để transcript rỗng và mọi điểm = 0.
- Mọi nhận xét viết bằng tiếng Việt, cụ thể, ngắn gọn, giọng khích lệ nhưng thẳng thắn.
- Chỉ trả về JSON hợp lệ đúng cấu trúc yêu cầu, không markdown.`;

function prompt(b) {
  if (b.mode === "retell") {
    const pts = (b.points || []).map((p, i) => `${i}. ${p}`).join("\n");
    return `${COMMON}
Phần thi: 听后复述 — học viên nghe một đoạn văn rồi kể lại trong 2 phút.
ĐOẠN VĂN GỐC:
${b.ref}
CÁC Ý CHÍNH (đánh số):
${pts}
Chấm:
- content (0-100): giữ được bao nhiêu ý chính, đúng trình tự, có câu chốt/ý nghĩa không. Kể lại bằng lời của mình vẫn tính là đúng ý.
- language (0-100): từ ngữ, ngữ pháp chính xác, có giữ được các từ/cụm quan trọng của bài.
- fluency (0-100): trôi chảy, ít ngập ngừng, phát âm và thanh điệu rõ.
- total = round(content*0.5 + language*0.3 + fluency*0.2).
JSON:
{"transcript":"","hit":[true/false theo thứ tự từng ý chính],"score":{"content":0,"language":0,"fluency":0,"total":0},"comment":"2-3 câu nhận xét chung","missing":["ý quan trọng bị bỏ sót hoặc kể sai (tiếng Việt)"],"errors":[{"wrong":"câu/cụm học viên nói sai","right":"cách nói đúng","why":"giải thích ngắn"}],"tips":["1-3 mẹo cụ thể để lần sau kể tốt hơn"]}`;
  }
  if (b.mode === "answer") {
    return `${COMMON}
Phần thi: 回答问题 — học viên trả lời câu hỏi trong 2 phút 30 giây (đề thi HSKK 高级). Bài tốt cần khoảng 350-450 chữ, có quan điểm rõ ràng, bố cục mở – thân (2-3 luận điểm có ví dụ) – kết, từ vựng và ngữ pháp trình độ cao cấp.
CÂU HỎI: ${b.question}
Chấm:
- content (0-100): trả lời đúng trọng tâm, quan điểm rõ, lý lẽ và ví dụ thuyết phục, đủ dài.
- structure (0-100): bố cục mạch lạc, có từ nối (首先、其次、此外、总之……).
- language (0-100): độ chính xác và độ phong phú của từ vựng, ngữ pháp, có dùng thành ngữ/cụm cao cấp.
- fluency (0-100): trôi chảy, ít ngập ngừng/lặp, phát âm rõ.
- total = round(content*0.35 + structure*0.2 + language*0.3 + fluency*0.15).
JSON:
{"transcript":"","score":{"content":0,"structure":0,"language":0,"fluency":0,"total":0},"comment":"2-3 câu nhận xét chung","strengths":["điểm tốt"],"errors":[{"wrong":"câu/cụm sai","right":"cách nói đúng","why":"giải thích ngắn"}],"upgrades":[{"orig":"một câu học viên đã nói (đơn giản)","better":"viết lại hay hơn, trình độ cao cấp"}],"tips":["1-3 gợi ý để nói dài và sâu hơn"]}
Tối đa 5 lỗi, 3 câu nâng cấp.`;
  }
  return `${COMMON}
Phần thi: 朗读 — học viên đọc to đoạn văn sau trong 2 phút.
ĐOẠN VĂN:
${b.ref}
Chấm:
- accuracy (0-100): đọc đúng chữ, không đọc sót/thêm/sai chữ.
- tone (0-100): thanh điệu, biến điệu (一、不、thanh 3) và âm đọc chuẩn.
- fluency (0-100): ngắt nghỉ đúng chỗ theo dấu câu và cụm nghĩa, tốc độ tự nhiên, có ngữ điệu.
- total = round(accuracy*0.4 + tone*0.35 + fluency*0.25).
JSON:
{"transcript":"","score":{"accuracy":0,"tone":0,"fluency":0,"total":0},"comment":"2-3 câu nhận xét chung","wrong":[{"text":"chữ/từ trong bài","heard":"học viên đọc thành (pinyin)","right":"pinyin đúng","note":"giải thích ngắn"}],"tips":["1-3 mẹo luyện đọc"]}
Tối đa 8 lỗi tiêu biểu nhất.`;
}

export async function POST(req) {
  const blocked = await guard("hskk-cao", 60);
  if (blocked) return blocked;
  try {
    const b = await req.json();
    if (!b?.audio || !["retell", "answer", "read"].includes(b.mode)) return NextResponse.json({ error: "Thiếu dữ liệu ghi âm." }, { status: 400 });
    if (b.audio.length > 6_000_000) return NextResponse.json({ error: "Bản ghi âm quá dài." }, { status: 413 });
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Thiếu API Key." }, { status: 500 });
    const genAI = new GoogleGenerativeAI(apiKey);
    const parts = [{ text: prompt(b) }, { inlineData: { data: b.audio.replace(/^data:[^,]+,/, ""), mimeType: (b.mime || "audio/webm").split(";")[0] } }];
    let last = null;
    for (const [m, timeout] of MODELS) {
      try {
        const model = genAI.getGenerativeModel({ model: m, generationConfig: { responseMimeType: "application/json", temperature: 0.2 } }, { timeout });
        const r = await model.generateContent(parts);
        const t = r.response.text().replace(/```json|```/g, "").trim();
        const d = JSON.parse(t);
        return NextResponse.json({ ...(Array.isArray(d) ? d[0] : d), model: m });
      } catch (e) { last = e; }
    }
    console.error("hskk-cao:", last);
    return NextResponse.json({ error: "AI đang quá tải, bạn thử lại sau ít phút nhé." }, { status: 503 });
  } catch (e) {
    console.error("hskk-cao:", e);
    return NextResponse.json({ error: "Lỗi chấm bài: " + e.message }, { status: 500 });
  }
}
