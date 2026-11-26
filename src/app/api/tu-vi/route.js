// Luận giải lá số Tử vi bằng AI: nhận bản tóm tắt lá số (đã an sao ở trình duyệt) → Gemini viết luận giải tiếng Việt
import { guard } from "@/lib/apiGuard";
import { NextResponse } from "next/server";
import { raceJSON } from "@/lib/geminiRace";

export const maxDuration = 60;

const PROMPT = (chart, year) => `Bạn là thầy Tử vi đẩu số (紫微斗数) uyên bác, viết luận giải cho người Việt đang học tiếng Trung. Dưới đây là lá số đã an sao đầy đủ (tên sao kèm chữ Hán, độ sáng, Tứ hoá):

${chart}

Yêu cầu:
- Luận theo phương pháp chuẩn: xem cung Mệnh, Thân cùng tam phương tứ chính (Mệnh – Tài – Quan – Di), cách cục nổi bật, sự phối hợp của chính tinh với cát tinh/sát tinh và Tứ hoá; cung vô chính diệu thì mượn sao cung đối.
- Viết bằng tiếng Việt, cụ thể theo đúng lá số này (nêu tên sao làm căn cứ), giọng ấm áp, xây dựng. Mỗi mục 3–5 câu, súc tích.
- Đây là nội dung văn hoá – tham khảo: không phán chắc chắn chuyện sống chết, bệnh tật nặng, tai nạn; không khuyên quyết định y tế/tài chính cụ thể. Điểm yếu thì nói như "điều cần lưu ý" kèm cách khắc phục.
- Mục "nam_nay" luận vận năm ${year} dựa trên đại vận hiện tại và lưu niên ghi trong lá số.
- "tu_vung": 8–10 thuật ngữ tiếng Trung xuất hiện trong lá số/luận giải đáng học (chữ Hán, pinyin có dấu, nghĩa tiếng Việt).
Chỉ trả JSON hợp lệ:
{"tong_quan":"","cach_cuc":[{"ten":"tên cách cục (Hán Việt + chữ Hán) nếu có","giai":""}],"tinh_cach":"","su_nghiep":"","tai_loc":"","tinh_duyen":"","gia_dao":"","suc_khoe":"","dai_van":"","nam_nay":"","loi_khuyen":["3–5 lời khuyên ngắn"],"tu_vung":[{"zh":"","py":"","vi":""}]}`;

export async function POST(req) {
  const blocked = await guard("tu-vi", 8);
  if (blocked) return blocked;
  try {
    const b = await req.json();
    if (!b?.chart || typeof b.chart !== "string" || b.chart.length > 16000) return NextResponse.json({ error: "Thiếu dữ liệu lá số." }, { status: 400 });
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Thiếu API Key." }, { status: 500 });
    try {
      return NextResponse.json(await raceJSON(apiKey, PROMPT(b.chart, Number(b.year) || new Date().getFullYear()), { temperature: 0.5 }));
    } catch (e) {
      console.error("tu-vi:", e);
      return NextResponse.json({ error: "AI đang quá tải hoặc trả lời quá chậm, bạn bấm thử lại nhé." }, { status: 503 });
    }
  } catch (e) {
    console.error("tu-vi:", e);
    return NextResponse.json({ error: "Lỗi luận giải: " + e.message }, { status: 500 });
  }
}
