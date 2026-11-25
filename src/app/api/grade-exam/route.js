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

// Tiêu chí chấm theo từng dạng câu (trọng số %). AI cho điểm từng tiêu chí 0–100, máy tính điểm câu = tổng có trọng số.
const CRIT = {
  repeat: [["Chính xác — nhắc lại đúng, đủ từng chữ", 60], ["Phát âm, thanh điệu", 30], ["Trôi chảy", 10]],
  retell: [["Nội dung — đủ ý chính, đúng trình tự", 40], ["Từ vựng – ngữ pháp", 30], ["Phát âm, thanh điệu", 20], ["Trôi chảy, nói đủ thời gian", 10]],
  read: [["Đọc đúng chữ, không thêm/bớt/đọc sai", 40], ["Phát âm, thanh điệu, ngữ điệu", 35], ["Trôi chảy, ngắt nghỉ đúng", 25]],
  picture: [["Nội dung — đúng tranh, có diễn biến/liên tưởng", 35], ["Từ vựng – ngữ pháp", 30], ["Phát âm, thanh điệu", 20], ["Trôi chảy, nói đủ thời gian", 15]],
  answer: [["Nội dung — đúng trọng tâm, có lý do, ví dụ", 35], ["Từ vựng – ngữ pháp", 30], ["Phát âm, thanh điệu", 20], ["Trôi chảy, nói đủ thời gian", 15]],
  sentence: [["Đúng yêu cầu — dùng đúng từ cho sẵn", 40], ["Ngữ pháp", 40], ["Dùng từ, chữ viết", 20]],
  picture_w: [["Đúng yêu cầu — dùng đúng từ, khớp tranh", 40], ["Ngữ pháp", 40], ["Dùng từ, chữ viết", 20]],
  essay: [["Nội dung — đúng đề, dùng đủ từ/tranh cho sẵn", 30], ["Bố cục, liên kết", 15], ["Từ vựng", 20], ["Ngữ pháp", 25], ["Đủ số chữ", 10]],
  suoxie: [["Nội dung — giữ đủ ý chính, đúng trình tự, không thêm ý mình", 40], ["Bố cục, liên kết", 15], ["Ngôn ngữ — từ vựng, ngữ pháp", 35], ["Độ dài ~400 chữ, có tiêu đề", 10]],
};
const critText = (k) => (CRIT[k] || CRIT.answer).map(([n, w], i) => `   ${i + 1}. ${n} (${w}%)`).join("\n");
const KIND_VI = { repeat: "nghe rồi nhắc lại nguyên câu (听后重复)", retell: "nghe rồi thuật lại đoạn văn bằng lời của mình (听后复述)", read: "đọc to đoạn văn (朗读)", picture: "nhìn tranh nói (看图说话)", answer: "trả lời câu hỏi (回答问题)" };
const WKIND_VI = { sentence: "dùng từ cho sẵn đặt câu", picture_w: "nhìn tranh, dùng từ cho sẵn đặt câu (看图，用词造句)", essay: "viết đoạn văn (写短文)", suoxie: "đọc rồi tóm tắt lại bài (缩写)" };

const P = {
  hskk: (b) => `Bạn là giám khảo HSKK chấm một câu thi nói của học viên người Việt (${b.level || "HSKK"}). File ghi âm đính kèm là câu trả lời.
Dạng câu: ${KIND_VI[b.kind] || b.type || "nói"}${b.max ? ` — câu này chiếm ${b.max}/100 điểm của bài` : ""}.
Đề / câu gốc: ${b.question || "(không có)"}
${b.ref ? (b.refKind === "source" ? `VĂN BẢN GỐC (học viên phải ${b.kind === "read" ? "đọc đúng" : b.kind === "repeat" ? "nhắc lại đúng" : "thuật lại đủ ý"} theo bài này): ${b.ref}` : `Bài mẫu tham khảo (chỉ để tham khảo ý, học viên không cần nói giống): ${b.ref}`) : ""}
Chấm theo tiêu chí của dạng câu này, mỗi tiêu chí 0–100:
${critText(b.kind)}
Nếu ghi âm im lặng/không nói gì: mọi tiêu chí 0. Nói lạc đề thì tiêu chí nội dung thấp.
${TONE}
Chỉ trả JSON: {"transcript":"chép lại lời học viên nói bằng chữ Hán (giữ nguyên chỗ sai)","crit":[điểm tiêu chí 1, tiêu chí 2, …],"pron":"1 câu về phát âm/thanh điệu — chỉ nêu chữ đọc sai khi nghe rõ là sai; phát âm chuẩn thì nói chuẩn, không bịa lỗi","comment":"1–2 câu nhận xét ngắn (≤ 40 chữ)",${FIX}}`,
  hskk_sum: (b) => `Bạn là giám khảo HSKK. Dưới đây là kết quả từng phần của một bài thi nói (${b.level || "HSKK"}), tổng ${b.total ?? "?"}/100 (đạt từ 60):
${(b.items || []).map((x) => `Câu ${x.n} (${x.type}): điểm ${x.score}/100. Lời: ${x.transcript || "(không nói)"}. Nhận xét: ${x.comment || ""}`).join("\n")}
${TONE}
Viết nhận xét tổng cho cả bài: 2–3 câu (≤ 60 chữ) — phần làm tốt, phần yếu nhất, việc cần luyện tiếp.
Chỉ trả JSON: {"comment":""}`,
  writing: (b) => `Bạn là giám khảo HSK chấm phần VIẾT (书写) của học viên người Việt, đề ${b.level || "HSK"}. Các ảnh đính kèm (nếu có) là tranh của câu có ghi số tương ứng.
${(b.items || []).map((x) => `— Câu ${x.n} · dạng: ${WKIND_VI[x.kind] || "viết"}${x.img ? " (có tranh, xem ảnh [câu " + x.n + "])" : ""}: ${x.word ? `từ cho sẵn: ${x.word}` : ""}${x.prompt ? ` đề: ${x.prompt}` : ""}${x.min ? ` · yêu cầu ≥ ${x.min} chữ (học viên viết ${String(x.text || "").replace(/\s/g, "").length} chữ)` : ""}${x.ref ? `\n   đáp án tham khảo: ${x.ref}` : ""}
   Tiêu chí (mỗi tiêu chí 0–100):\n${critText(x.kind)}
   BÀI CỦA HỌC VIÊN: ${x.text || "(bỏ trống)"}`).join("\n")}
Bỏ trống = mọi tiêu chí 0. Không dùng từ cho sẵn → tiêu chí "đúng yêu cầu" tối đa 30.
${TONE}
Chỉ trả JSON: {"items":[{"n":số câu,"crit":[điểm tiêu chí 1, tiêu chí 2, …],"comment":"1 câu ≤ 25 chữ",${FIX},"better":"câu/đoạn viết lại tự nhiên, giữ ý học viên (chỉ tiếng Trung; rỗng nếu đã tốt)"}],"comment":"nhận xét chung phần viết 1–2 câu (≤ 40 chữ)"}`,
};

// điểm câu = tổng có trọng số của điểm tiêu chí
function withCrit(d, kind) {
  const C = CRIT[kind] || CRIT.answer;
  const arr = Array.isArray(d.crit) ? d.crit.map((v) => Math.max(0, Math.min(100, Number(typeof v === "object" ? v?.score : v) || 0))) : null;
  if (!arr || arr.length < C.length) return { ...d, score: Math.max(0, Math.min(100, Math.round(Number(d.score) || 0))) };
  return { ...d, crit: C.map(([name, w], i) => ({ name, w, score: arr[i] })), score: Math.round(C.reduce((s, [, w], i) => s + arr[i] * w, 0) / 100) };
}

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
        if (b.mode === "hskk") d = withCrit(d, b.kind || "answer");
        if (d.items) d.items = d.items.map((x) => { const k = (b.items || []).find((y) => String(y.n) === String(x.n))?.kind || "essay"; return withCrit({ ...x, fixes: cleanFix(x.fixes), better: x.better ? zhOnly(x.better) || x.better : "" }, k); });
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
