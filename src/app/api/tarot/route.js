// Giải bài Tarot bằng AI: nhận câu hỏi + trải bài + các lá đã rút (xuôi/ngược) → Gemini viết lời giải tiếng Việt
import { guard } from "@/lib/apiGuard";
import { NextResponse } from "next/server";
import { raceJSON } from "@/lib/geminiRace";

export const maxDuration = 60;

const PROMPT = (b) => `Bạn là người giải bài Tarot (塔罗牌) có kinh nghiệm, viết cho người Việt đang học tiếng Trung.
Chủ đề: ${b.topic || "Tổng quát"}
Câu hỏi của người xem: ${b.question ? `"${String(b.question).slice(0, 300)}"` : "(không đặt câu hỏi cụ thể — giải theo chủ đề)"}
Trải bài: ${b.spread}
Các lá đã rút:
${(b.cards || []).slice(0, 10).map((c, i) => `${i + 1}. Vị trí "${c.pos}": ${c.name} (${c.en}) — ${c.rev ? "NGƯỢC 逆位" : "XUÔI 正位"}`).join("\n")}

Yêu cầu:
- Giải từng lá theo đúng vị trí trong trải bài và theo câu hỏi, rồi nối các lá thành một câu chuyện liền mạch (lá trước ảnh hưởng lá sau, lá Ẩn chính nặng hơn, nhiều lá cùng bộ thì nêu ý nghĩa).
- Tiếng Việt tự nhiên, ấm áp, cụ thể; xưng "mình", gọi "bạn". Không sáo rỗng, không dấu chấm than.
- Tarot là để tham khảo và tự suy ngẫm: không phán chắc chắn tương lai, không nói chuyện chết chóc, bệnh nặng; không khuyên quyết định y tế, pháp lý, tài chính cụ thể. Lá xấu thì nói như "điều cần lưu ý" kèm cách hành động.
- "tu_vung": 6–8 từ tiếng Trung đáng học liên quan đến các lá/lời giải (chữ Hán, pinyin có dấu, nghĩa tiếng Việt).
Chỉ trả JSON hợp lệ:
{"tong_quan":"2–3 câu trả lời thẳng vào câu hỏi","la":[{"vi_tri":"","giai":"3–4 câu"}],"cau_chuyen":"4–6 câu nối các lá","loi_khuyen":["2–4 lời khuyên ngắn, làm được"],"tu_vung":[{"zh":"","py":"","vi":""}]}`;

export async function POST(req) {
  const blocked = await guard("tarot", 12);
  if (blocked) return blocked;
  try {
    const b = await req.json();
    if (!Array.isArray(b?.cards) || !b.cards.length) return NextResponse.json({ error: "Chưa có lá bài." }, { status: 400 });
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Thiếu API Key." }, { status: 500 });
    try {
      return NextResponse.json(await raceJSON(apiKey, PROMPT(b), { temperature: 0.6 }));
    } catch (e) {
      console.error("tarot:", e);
      return NextResponse.json({ error: "AI đang quá tải hoặc trả lời quá chậm, bạn bấm thử lại nhé." }, { status: 503 });
    }
  } catch (e) {
    console.error("tarot:", e);
    return NextResponse.json({ error: "Lỗi giải bài: " + e.message }, { status: 500 });
  }
}
