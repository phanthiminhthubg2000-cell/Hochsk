// Chấm shadowing / phát âm: nghe file ghi âm của học viên, so với câu gốc → chấm TỪNG CHỮ (đúng / sai thanh / sai âm / thiếu),
// điểm chính xác – thanh điệu – trôi chảy – đầy đủ, nhận xét ngắn tiếng Việt. Dùng ở trang Shadowing và thẻ từ (Chủ đề).
import { guard } from "@/lib/apiGuard";
import { NextResponse } from "next/server";
import { raceJSON } from "@/lib/geminiRace";

export const maxDuration = 60;

const PROMPT = (t, py) => `Bạn là giáo viên luyện phát âm tiếng Trung, nghe file ghi âm của học viên người Việt đang luyện SHADOWING (nghe rồi nói lại).
Câu gốc: "${t}"${py ? `\nPinyin chuẩn: ${py}` : ""}

Nghe thật kỹ và đánh giá TỪNG CHỮ HÁN trong câu gốc (bỏ dấu câu), theo đúng thứ tự:
- "ok": đọc đúng âm và thanh
- "tone": đúng âm nhưng sai thanh điệu (ghi thanh học viên đọc vào "heard", vd "mā")
- "wrong": sai âm (ghi pinyin học viên đọc vào "heard")
- "miss": bỏ sót, không đọc
Chỉ đánh lỗi khi nghe RÕ là sai; giọng hơi lơ lớ nhưng vẫn đúng thì vẫn "ok". Không bịa lỗi. Biến điệu thanh (一、不, hai thanh 3 liền nhau) đọc theo biến điệu là ĐÚNG.
Nếu ghi âm im lặng hoặc không phải tiếng Trung: mọi chữ "miss".
Chấm thêm (0–100): "fluency" độ trôi chảy, ngắt nghỉ tự nhiên, tốc độ gần giọng mẫu; "intonation" ngữ điệu cả câu.
"feedback": 1–2 câu tiếng Việt, xưng "cô", gọi "bạn", nói thẳng chữ nào cần sửa và sửa thế nào (vd: "好 đọc thanh 3, hạ giọng xuống rồi mới lên"); không khen sáo rỗng, không dấu chấm than.
"transcript": chép lại bằng chữ Hán những gì học viên đọc.
Chỉ trả JSON: {"chars":[{"c":"字","st":"ok|tone|wrong|miss","py":"pinyin chuẩn có dấu","heard":""}],"fluency":0,"intonation":0,"feedback":"","transcript":""}`;

const W = { ok: 1, tone: 0.45, wrong: 0.15, miss: 0 };

export async function POST(request) {
  const blocked = await guard("shadowing", 150);
  if (blocked) return blocked;
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Thiếu API Key." }, { status: 500 });
    const { targetText, audioBase64, mimeType, pinyin } = await request.json();
    const t = String(targetText || "").slice(0, 200);
    if (!t || !audioBase64) return NextResponse.json({ error: "Thiếu câu hoặc ghi âm." }, { status: 400 });
    const data = String(audioBase64).replace(/^data:[^,]+,/, "");
    if (data.length > 6_000_000) return NextResponse.json({ error: "Ghi âm quá dài." }, { status: 413 });
    const mt = (mimeType || String(audioBase64).slice(5, String(audioBase64).indexOf(";")) || "audio/webm").split(";")[0];
    const d = await raceJSON(apiKey, [{ text: PROMPT(t, pinyin) }, { inlineData: { data, mimeType: mt } }], { head: 18000, deadline: 52000, temperature: 0.1 });
    // điểm do máy tính từ kết quả từng chữ để ổn định
    const target = [...t.replace(/[^㐀-鿿]/g, "")];
    let chars = Array.isArray(d.chars) ? d.chars.filter((x) => x && /[㐀-鿿]/.test(x.c || "")) : [];
    if (chars.length !== target.length) { // AI trả lệch số chữ → khớp lại theo vị trí
      chars = target.map((c, i) => { const x = chars.find((y, k) => y.c === c && Math.abs(k - i) <= 2) || {}; return { c, st: x.st || "ok", py: x.py || "", heard: x.heard || "" }; });
    }
    chars = chars.map((x) => ({ c: x.c, st: W[x.st] != null ? x.st : "ok", py: x.py || "", heard: x.heard || "" }));
    const n = chars.length || 1;
    const accuracy = Math.round((chars.reduce((s, x) => s + W[x.st], 0) / n) * 100);
    const tone = Math.round((chars.filter((x) => x.st === "ok" || x.st === "wrong").length / n) * 100 * (chars.some((x) => x.st !== "miss") ? 1 : 0));
    const complete = Math.round((chars.filter((x) => x.st !== "miss").length / n) * 100);
    const fluency = Math.max(0, Math.min(100, Math.round(Number(d.fluency) || 0)));
    const intonation = Math.max(0, Math.min(100, Math.round(Number(d.intonation) || 0)));
    const score = complete === 0 ? 0 : Math.round(accuracy * 0.65 + fluency * 0.2 + intonation * 0.15);
    return NextResponse.json({ score, accuracy, tone, complete, fluency, intonation, chars, feedback: d.feedback || "", transcript: d.transcript || "", model: d.model });
  } catch (error) {
    console.error("shadowing:", error);
    return NextResponse.json({ error: "AI đang quá tải, bạn thử lại sau ít phút." }, { status: 503 });
  }
}
