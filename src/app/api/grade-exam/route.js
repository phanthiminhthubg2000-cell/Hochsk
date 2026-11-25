// AI chấm bài thi cho giáo viên duyệt:
//  mode "hskk"     — một câu thi nói HSKK (ghi âm) → chép lời, điểm, nhận xét, lỗi
//  mode "hskk_sum" — tổng hợp nhận xét cả bài HSKK từ các câu đã chấm
//  mode "writing"  — phần viết đề HSK (các câu viết, có thể kèm tranh) → điểm từng câu, lỗi, nhận xét chung
import { guard } from "@/lib/apiGuard";
import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const maxDuration = 60;
const TONE = `GIỌNG VĂN: như cô giáo người Việt nhắn cho học viên — xưng "cô", gọi học viên là "bạn", câu ngắn, nói thẳng vào việc, tự nhiên. Không khen sáo rỗng ("rất hay", "tuyệt vời", "chỉn chu", "xuất sắc", "hãy tiếp tục phát huy"), không dấu chấm than, không chen tiếng Anh. Khen thì chỉ đúng chỗ làm tốt, chê thì chỉ đúng lỗi.`;
const FIX = `"fixes": tối đa 5 lỗi quan trọng [{"wrong":"cụm sai (chữ Hán, đúng như học viên nói/viết)","right":"cụm đúng — CHỈ tiếng Trung","why":"tiếng Việt, ≤ 15 chữ"}]`;

const P = {
  hskk: (b) => `Bạn là giám khảo HSKK chấm một câu thi nói của học viên người Việt (${b.level || "HSKK"}). File ghi âm đính kèm là câu trả lời.
Dạng câu: ${{ repeat: "nghe rồi nhắc lại / thuật lại", picture: "nhìn tranh nói", answer: "trả lời câu hỏi", read: "đọc thành tiếng" }[b.type] || b.type || "nói"}.
Đề / câu gốc: ${b.question || "(không có)"}
${b.ref ? `Văn bản gốc / gợi ý: ${b.ref}` : ""}
Chấm theo tiêu chí HSKK: đúng nội dung/yêu cầu đề (với nhắc lại: đúng từng chữ), phát âm – thanh điệu, trôi chảy, từ vựng – ngữ pháp, độ dài (nói đủ thời gian).
Nếu ghi âm im lặng/không nói gì: score 0.
${TONE}
Chỉ trả JSON: {"transcript":"chép lại lời học viên nói bằng chữ Hán (giữ nguyên chỗ sai)","score":0-100,"pron":"1 câu về phát âm/thanh điệu — chỉ nêu chữ đọc sai khi nghe rõ là sai; phát âm chuẩn thì nói chuẩn, không bịa lỗi","comment":"1–2 câu nhận xét ngắn (≤ 40 chữ)",${FIX}}`,
  hskk_sum: (b) => `Bạn là giám khảo HSKK. Dưới đây là kết quả từng câu của một bài thi nói (${b.level || "HSKK"}):
${(b.items || []).map((x) => `Câu ${x.n} (${x.type}): điểm ${x.score}/100. Lời: ${x.transcript || "(không nói)"}. Nhận xét: ${x.comment || ""}`).join("\n")}
${TONE}
Viết nhận xét tổng cho cả bài: 2–3 câu (≤ 60 chữ) — điểm mạnh cụ thể, lỗi lớn nhất, việc cần luyện tiếp.
Chỉ trả JSON: {"comment":""}`,
  writing: (b) => `Bạn là giám khảo HSK chấm phần VIẾT của học viên người Việt, đề ${b.level || "HSK"}. Các ảnh đính kèm (nếu có) là tranh của câu có ghi số tương ứng.
${(b.items || []).map((x) => `— Câu ${x.n}${x.img ? " (có tranh, xem ảnh [câu " + x.n + "])" : ""}: ${x.word ? `từ cho sẵn: ${x.word}` : x.prompt ? `đề: ${x.prompt}` : ""}${x.min ? ` · yêu cầu ≥ ${x.min} chữ` : ""}${x.ref ? `\n   đáp án tham khảo: ${x.ref}` : ""}\n   BÀI CỦA HỌC VIÊN: ${x.text || "(bỏ trống)"}`).join("\n")}
Chấm từng câu 0–100 theo chuẩn chấm viết HSK: đúng yêu cầu (dùng đúng từ cho sẵn / đúng tranh / đúng đề), ngữ pháp, từ vựng, mạch lạc, đủ độ dài. Bỏ trống = 0.
${TONE}
Chỉ trả JSON: {"items":[{"n":số câu,"score":0-100,"comment":"1 câu ≤ 25 chữ",${FIX},"better":"câu/đoạn viết lại tự nhiên, giữ ý học viên (chỉ tiếng Trung; rỗng nếu đã tốt)"}],"comment":"nhận xét chung phần viết 1–2 câu (≤ 40 chữ)"}`,
};

const zhOnly = (t) => String(t || "").replace(/[（(][^）)]*[A-Za-zÀ-ỹ][^）)]*[）)]/g, "").replace(/[A-Za-zÀ-ỹ][A-Za-zÀ-ỹ0-9\s/'’-]*/g, "").replace(/\s+/g, "").trim();
const cleanFix = (a) => (a || []).map((e) => ({ ...e, right: zhOnly(e.right) || e.right })).filter((e) => e.wrong && e.right && e.wrong !== e.right);

async function toPart(src) {
  if (!src) return null;
  if (src.startsWith("data:")) return { inlineData: { data: src.replace(/^data:[^,]+,/, ""), mimeType: src.slice(5, src.indexOf(";")).split(";")[0] || "audio/webm" } };
  const r = await fetch(src); if (!r.ok) return null;
  const buf = Buffer.from(await r.arrayBuffer());
  return { inlineData: { data: buf.toString("base64"), mimeType: (r.headers.get("content-type") || "application/octet-stream").split(";")[0] } };
}

export async function POST(req) {
  const blocked = await guard("grade-exam", 600);
  if (blocked) return blocked;
  try {
    const b = await req.json();
    if (!P[b?.mode]) return NextResponse.json({ error: "mode?" }, { status: 400 });
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Thiếu API Key." }, { status: 500 });
    const parts = [{ text: P[b.mode](b) }];
    if (b.mode === "hskk") {
      const a = await toPart(b.audio).catch(() => null);
      if (!a) return NextResponse.json({ transcript: "", score: 0, comment: "Không có ghi âm.", fixes: [] });
      if (a.inlineData.data.length > 14_000_000) return NextResponse.json({ error: "Ghi âm quá dài." }, { status: 413 });
      parts.push(a);
      if (b.img) { const p = await toPart(b.img).catch(() => null); if (p && p.inlineData.mimeType.startsWith("image/")) parts.push({ text: "Tranh của đề:" }, p); }
    }
    if (b.mode === "writing") for (const x of b.items || []) if (x.img) { const p = await toPart(x.img).catch(() => null); if (p) parts.push({ text: `[câu ${x.n}]` }, p); }
    const models = b.mode === "hskk_sum" ? [["gemini-3.5-flash-lite", 20000], ["gemini-3.5-flash", 25000]] : [["gemini-3.5-flash", 40000], ["gemini-3.5-flash-lite", 15000]];
    const genAI = new GoogleGenerativeAI(apiKey); let last = null;
    for (const [m, timeout] of models) {
      try {
        const model = genAI.getGenerativeModel({ model: m, generationConfig: { responseMimeType: "application/json", temperature: 0.2 } }, { timeout });
        const r = await model.generateContent(parts);
        let d = JSON.parse(r.response.text().replace(/```json|```/g, "").trim()); d = Array.isArray(d) ? d[0] : d;
        if (d.fixes) d.fixes = cleanFix(d.fixes);
        if (d.items) d.items = d.items.map((x) => ({ ...x, fixes: cleanFix(x.fixes), better: x.better ? zhOnly(x.better) || x.better : "" }));
        return NextResponse.json({ ...d, model: m });
      } catch (e) { last = e; }
    }
    console.error("grade-exam:", last);
    return NextResponse.json({ error: "AI đang quá tải, thử lại sau ít phút." }, { status: 503 });
  } catch (e) {
    console.error("grade-exam:", e);
    return NextResponse.json({ error: "Lỗi chấm: " + e.message }, { status: 500 });
  }
}
