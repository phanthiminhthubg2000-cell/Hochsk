// Luận bản đồ sao (chiêm tinh phương Tây) bằng AI: nhận bản tóm tắt lá số đã tính ở trình duyệt → luận giải tiếng Việt
import { guard } from "@/lib/apiGuard";
import { NextResponse } from "next/server";
import { raceJSON } from "@/lib/geminiRace";

export const maxDuration = 120;

const PROMPT = (chart, year) => `Bạn là nhà chiêm tinh phương Tây (西洋占星) giàu kinh nghiệm, viết cho người Việt đang học tiếng Trung. Bản đồ sao (hoàng đạo nhiệt đới, nhà Placidus) đã tính sẵn:

${chart}

Yêu cầu:
- Luận tổng hợp, nối các yếu tố với nhau (Mặt Trời – Mặt Trăng – Cung Mọc, hành tinh chủ quản cung Mọc, hành tinh trội, nguyên tố/tính chất trội và thiếu, các góc chiếu chặt nhất, nhà có nhiều hành tinh). Nêu căn cứ cụ thể (vd "Sao Kim ở Cự Giải nhà 5 tam hợp Sao Hoả").
- Tiếng Việt tự nhiên, ấm áp, cụ thể; xưng "mình", gọi "bạn"; không sáo rỗng. Mỗi mục 3–5 câu.
- Nội dung văn hoá – tham khảo: không phán chắc tương lai, không nói chuyện sinh tử, bệnh nặng; không khuyên quyết định y tế, tài chính, hôn nhân cụ thể.
- "nam_nay": xu hướng năm ${year} dựa trên vị trí sao Mộc, sao Thổ năm ${year} so với lá số (nói chung, mang tính gợi ý).
- "tu_vung": 8 thuật ngữ chiêm tinh tiếng Trung đáng học (chữ Hán, pinyin có dấu, nghĩa tiếng Việt).
Chỉ trả JSON hợp lệ:
{"tong_quan":"","bo_ba":"luận bộ ba Mặt Trời – Mặt Trăng – Cung Mọc","tinh_cach":"","tinh_cam":"","su_nghiep":"","tai_chinh":"","diem_manh":["3–4 ý"],"thu_thach":["2–4 ý"],"goc_chieu":"các góc chiếu nổi bật và ý nghĩa","nam_nay":"","loi_khuyen":["3–5 lời khuyên làm được"],"tu_vung":[{"zh":"","py":"","vi":""}]}`;

export async function POST(req) {
  const blocked = await guard("chiem-tinh", 8);
  if (blocked) return blocked;
  try {
    const b = await req.json();
    if (!b?.chart || typeof b.chart !== "string" || b.chart.length > 10000) return NextResponse.json({ error: "Thiếu dữ liệu bản đồ sao." }, { status: 400 });
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Thiếu API Key." }, { status: 500 });
    try {
      return NextResponse.json(await raceJSON(apiKey, PROMPT(b.chart, Number(b.year) || new Date().getFullYear()), { temperature: 0.5 }));
    } catch (e) {
      console.error("chiem-tinh:", e);
      return NextResponse.json({ error: "AI đang quá tải hoặc trả lời quá chậm, bạn bấm thử lại nhé." }, { status: 503 });
    }
  } catch (e) {
    return NextResponse.json({ error: "Lỗi luận giải: " + e.message }, { status: 500 });
  }
}
