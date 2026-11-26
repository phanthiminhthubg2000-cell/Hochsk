// Luận Bát tự bằng AI: nhận bản tóm tắt tứ trụ (đã tính ở trình duyệt: ngũ hành, vượng nhược, dụng thần) → Gemini viết luận giải tiếng Việt
import { guard } from "@/lib/apiGuard";
import { NextResponse } from "next/server";
import { raceJSON } from "@/lib/geminiRace";

export const maxDuration = 120;

const PROMPT = (chart, year) => `Bạn là thầy Bát tự (八字 / Tứ trụ) uyên bác, viết luận giải cho người Việt đang học tiếng Trung. Dữ liệu tứ trụ đã tính sẵn:

${chart}

Yêu cầu:
- Luận theo Tử Bình: nhật chủ, cường nhược, cách cục, thập thần nổi bật, ngũ hành khuyết/vượng, dụng – hỷ – kỵ thần (có thể điều chỉnh nếu thấy phép phù ức giản lược ở trên chưa hợp, nêu rõ lý do, xét cả điều hậu và thông quan).
- Phân biệt cho người đọc: "mệnh" theo nạp âm năm (cách gọi dân gian) khác với ngũ hành nhật chủ và dụng thần; khi nói "cần bổ sung hành gì" là theo dụng thần.
- Tiếng Việt tự nhiên, cụ thể theo lá số này (nêu can chi làm căn cứ), xưng "mình", gọi "bạn"; không sáo rỗng. Mỗi mục 3–5 câu.
- Nội dung văn hoá – tham khảo: không phán chắc chuyện sống chết, bệnh nặng; không khuyên quyết định y tế, tài chính, hôn nhân cụ thể.
- "nam_nay": vận năm ${year} (can chi năm, quan hệ với dụng thần và đại vận hiện tại).
- "tu_vung": 8 thuật ngữ Bát tự đáng học (chữ Hán, pinyin có dấu, nghĩa tiếng Việt).
Chỉ trả JSON hợp lệ:
{"tong_quan":"","cach_cuc":"","tinh_cach":"","su_nghiep":"","tai_van":"","tinh_cam":"","suc_khoe":"","dung_than":"giải thích dụng thần và cách bổ sung trong đời sống","nen_lam":["4–6 việc nên làm"],"nen_tranh":["3–5 điều nên tránh"],"dai_van":"","nam_nay":"","tu_vung":[{"zh":"","py":"","vi":""}]}`;

export async function POST(req) {
  const blocked = await guard("bat-tu", 8);
  if (blocked) return blocked;
  try {
    const b = await req.json();
    if (!b?.chart || typeof b.chart !== "string" || b.chart.length > 8000) return NextResponse.json({ error: "Thiếu dữ liệu tứ trụ." }, { status: 400 });
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Thiếu API Key." }, { status: 500 });
    try {
      return NextResponse.json(await raceJSON(apiKey, PROMPT(b.chart, Number(b.year) || new Date().getFullYear()), { temperature: 0.5 }));
    } catch (e) {
      console.error("bat-tu:", e);
      return NextResponse.json({ error: "AI đang quá tải hoặc trả lời quá chậm, bạn bấm thử lại nhé." }, { status: 503 });
    }
  } catch (e) {
    console.error("bat-tu:", e);
    return NextResponse.json({ error: "Lỗi luận giải: " + e.message }, { status: 500 });
  }
}
