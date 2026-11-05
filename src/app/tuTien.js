"use client";
// ============================================================
// SƠN HẢI THƯ VIỆN 山海书院 — bộ phận dùng chung cho giao diện tu tiên
// Cảnh giới (theo giáo trình đang học), ngũ hành linh căn, logo, Kim Thiềm, tranh núi
// ============================================================

export const BRAND = { vn: "Sơn Hải Thư Viện", zh: "山海书院", slogan: "一书藏山海，心明向远途。" };

// Bảng màu: giấy cổ · mực tàu · đỏ son · vàng linh khí
export const C = {
  paper: "#EFE7D6", card: "#FBF8F1", ink: "#1C1A17", sub: "#4A4238", muted: "#6B6253",
  line: "#D8CBAE", cinnabar: "#9E2F22", cinnabarDark: "#7A2218", gold: "#D9A23A",
};

// ---------- Cảnh giới ----------
export const REALMS = [
  { key: "luyen-the", zh: "炼体", vn: "Luyện Thể", hsk: "Ngữ âm", book: "《音律炼体诀》 Âm Luật Luyện Thể Quyết" },
  { key: "luyen-khi", zh: "炼气", vn: "Luyện Khí", hsk: "HSK 1–2", book: "《引气诀》 Dẫn Khí Quyết · 《聚灵诀》 Tụ Linh Quyết" },
  { key: "truc-co", zh: "筑基", vn: "Trúc Cơ", hsk: "HSK 3", book: "《筑基心法》 Trúc Cơ Tâm Pháp" },
  { key: "ket-dan", zh: "结丹", vn: "Kết Đan", hsk: "HSK 4", book: "《凝丹宝典》 Ngưng Đan Bảo Điển" },
  { key: "nguyen-anh", zh: "元婴", vn: "Nguyên Anh", hsk: "HSK 5", book: "《元婴秘录》 Nguyên Anh Bí Lục" },
  { key: "hoa-than", zh: "化神", vn: "Hóa Thần", hsk: "HSK 6", book: "《化神真经》 Hóa Thần Chân Kinh" },
];
export const STAGES = ["Sơ kỳ", "Trung kỳ", "Hậu kỳ", "Đỉnh phong"];

// Tên giáo trình (vd "HSK6.2 2.0", "Msutong HSK3.1", "HSK1 3.0") → cảnh giới + tiểu cảnh theo % bài đã lĩnh ngộ
export function realmOf(level, pct = 0) {
  const s = String(level || "");
  const m = s.match(/HSK\s*(\d)/i);
  const n = m ? Number(m[1]) : 0;
  const p = Math.max(0, Math.min(100, pct || 0));
  if (/ng[uữ]\s*[aâ]m|语音|pinyin/i.test(s) || !n) {
    return { ...REALMS[n ? 1 : 0], stage: STAGES[Math.min(3, Math.floor(p / 25))], idx: n ? 1 : 0, pct: p };
  }
  if (n <= 2) {
    // Luyện Khí tầng 1–9: HSK1 = tầng 1–5, HSK2 = tầng 6–9
    const tang = n === 1 ? 1 + Math.min(4, Math.floor(p / 20)) : 6 + Math.min(3, Math.floor(p / 25));
    return { ...REALMS[1], stage: `Tầng ${tang}`, idx: 1, pct: p };
  }
  const idx = Math.min(5, n - 1);
  return { ...REALMS[idx], stage: STAGES[Math.min(3, Math.floor(p / 25))], idx, pct: p };
}

// ---------- Ngũ hành linh căn ----------
export const ELEMENTS = [
  { key: "kim", zh: "金", vn: "Kim", skill: "Nghe", book: "《金声诀》 Kim Thanh Quyết", tip: "Nghe chép 1 bài mỗi ngày", href: "/dictation" },
  { key: "moc", zh: "木", vn: "Mộc", skill: "Từ vựng", book: "《木灵诀》 Mộc Linh Quyết", tip: "Ôn 20 thẻ từ vựng mỗi ngày", href: "/vocab" },
  { key: "thuy", zh: "水", vn: "Thủy", skill: "Đọc", book: "《水镜诀》 Thủy Kính Quyết", tip: "Dịch và đọc hiểu 10 câu mỗi ngày", href: "/translate" },
  { key: "hoa", zh: "火", vn: "Hỏa", skill: "Nói · phát âm", book: "《火云诀》 Hỏa Vân Quyết", tip: "Luyện nói theo tình huống 10 phút mỗi ngày", href: "/roleplay" },
  { key: "tho", zh: "土", vn: "Thổ", skill: "Viết · ngữ pháp", book: "《土岳诀》 Thổ Nhạc Quyết", tip: "Sắp xếp 10 câu mỗi ngày", href: "/arrange" },
];
export const elementOf = (k) => ELEMENTS.find((e) => e.key === k) || ELEMENTS[0];

// scores: {kim, moc, thuy, hoa, tho} 0–100 → tên linh căn, tư chất, tâm ma
export function judgeLinhCan(scores) {
  const arr = ELEMENTS.map((e) => ({ ...e, v: Math.round(scores?.[e.key] || 0) })).sort((a, b) => b.v - a.v);
  const vals = arr.map((x) => x.v);
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  let zh, vn, keys;
  if (vals[0] - vals[4] <= 20) { zh = "五行杂灵根"; vn = "Ngũ hành tạp linh căn"; keys = arr.map((x) => x.key); }
  else if (vals[0] - vals[1] >= 30) { zh = `${arr[0].zh}天灵根`; vn = `${arr[0].vn} thiên linh căn`; keys = [arr[0].key]; }
  else if (vals[1] - vals[2] >= 20) { zh = `${arr[0].zh}${arr[1].zh}双灵根`; vn = `${arr[0].vn} ${arr[1].vn} song linh căn`; keys = [arr[0].key, arr[1].key]; }
  else { zh = `${arr[0].zh}${arr[1].zh}${arr[2].zh}三灵根`; vn = `${arr[0].vn} ${arr[1].vn} ${arr[2].vn} tam linh căn`; keys = arr.slice(0, 3).map((x) => x.key); }
  const grade = avg >= 70 ? { zh: "上品", vn: "Thượng phẩm" } : avg >= 40 ? { zh: "中品", vn: "Trung phẩm" } : { zh: "下品", vn: "Hạ phẩm" };
  const weak = arr[arr.length - 1].key;
  return { zh, vn, keys, grade, weak, avg: Math.round(avg) };
}

// ---------- Hình vẽ ----------
// Con dấu son 2×2 chữ, đọc từ phải sang trái theo lối cổ
export function Seal({ chars = "山海书院", className = "w-11 h-11", rotate = -4, filled = true }) {
  const c = [...chars];
  const order = c.length === 4 ? [c[2], c[0], c[3], c[1]] : c;
  return (
    <span aria-hidden="true" className={`${className} inline-grid grid-cols-2 place-items-center rounded-[4px] p-[3px] leading-none font-black shrink-0 ${filled ? "bg-[#9E2F22] text-[#FBF3E4]" : "border-[3px] border-[#9E2F22] text-[#9E2F22]"}`}
      style={{ transform: `rotate(${rotate}deg)`, fontFamily: '"Noto Serif SC", serif', fontSize: "0.72em" }}>
      {order.map((ch, i) => <span key={i}>{ch}</span>)}
    </span>
  );
}

export function BrandMark({ compact = false }) {
  return (
    <span className="flex items-center gap-2.5 shrink-0">
      <Seal className="w-10 h-10 text-[19px]" />
      {!compact && (
        <span className="hidden sm:flex flex-col leading-none">
          <span className="font-brush text-[22px] text-[#1C1A17]">{BRAND.zh}</span>
          <span className="font-serif-vn text-[12px] font-bold tracking-[0.04em] text-[#4A4238] mt-0.5">{BRAND.vn}</span>
        </span>
      )}
    </span>
  );
}

// Kim Thiềm 金蟾 — linh thú (cóc vàng ngậm đồng tiền son)
export function KimThiem({ mood = "happy", className = "w-12 h-10", bob = false }) {
  return (
    <svg viewBox="0 0 120 100" className={className} aria-hidden="true">
      <g className={bob ? "tt-bob" : undefined}>
        <ellipse cx="60" cy="66" rx="50" ry="32" fill="#C9962F" />
        <ellipse cx="60" cy="74" rx="32" ry="18" fill="#F0D58A" />
        <circle cx="34" cy="34" r="20" fill="#C9962F" />
        <circle cx="86" cy="34" r="20" fill="#C9962F" />
        {mood === "sleepy" ? (
          <>
            <path d="M24 34 Q34 42 44 34" stroke="#1C1A17" strokeWidth="4" fill="none" strokeLinecap="round" />
            <path d="M76 34 Q86 42 96 34" stroke="#1C1A17" strokeWidth="4" fill="none" strokeLinecap="round" />
          </>
        ) : mood === "cheer" ? (
          <>
            <path d="M24 36 Q34 26 44 36" stroke="#1C1A17" strokeWidth="4" fill="none" strokeLinecap="round" />
            <path d="M76 36 Q86 26 96 36" stroke="#1C1A17" strokeWidth="4" fill="none" strokeLinecap="round" />
          </>
        ) : (
          <>
            <circle cx="34" cy="34" r="13" fill="#FFFFFF" /><circle cx="86" cy="34" r="13" fill="#FFFFFF" />
            <circle cx={mood === "think" ? 38 : 37} cy={mood === "think" ? 30 : 36} r="6" fill="#1C1A17" />
            <circle cx={mood === "think" ? 90 : 83} cy={mood === "think" ? 30 : 36} r="6" fill="#1C1A17" />
          </>
        )}
        <path d="M44 62 Q60 74 76 62" stroke="#1C1A17" strokeWidth="4" fill="none" strokeLinecap="round" />
        <circle cx="60" cy="86" r="8" fill="#9E2F22" />
        <rect x="57" y="83" width="6" height="6" fill="#F0D58A" />
      </g>
    </svg>
  );
}

// Tranh núi tiên + biển mây (nền thẻ cảnh giới)
export function MountainScene({ className = "", children }) {
  return (
    <div className={`relative overflow-hidden bg-[#1A1916] ${className}`}>
      <svg viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full" aria-hidden="true">
        <circle className="tt-breathe" cx="320" cy="60" r="34" fill="#D9A23A" opacity="0.9" />
        <path d="M0 180 L45 140 L80 155 L125 100 L170 150 L205 120 L250 165 L295 115 L340 155 L400 125 L400 260 L0 260 Z" fill="#2A2824" />
        <path d="M175 170 L198 92 L210 74 L224 92 L246 170 Z" fill="#3A3730" />
        <path d="M194 80 h32 l-16 -11 z" fill="#9E2F22" />
        <rect x="199" y="80" width="22" height="10" fill="#C9472F" />
        <path d="M190 90 h40 l-20 -10 z" fill="#9E2F22" />
        <g className="tt-drift" fill="none" stroke="#EFE7D6" strokeWidth="1.5" strokeLinecap="round" opacity="0.5">
          <path d="M40 70 q6 -12 18 -6 q4 -10 16 -4 q10 0 8 10 q-2 8 -12 6 q4 -8 -4 -8" />
          <path d="M260 105 q6 -12 18 -6 q4 -10 16 -4 q10 0 8 10 q-2 8 -12 6 q4 -8 -4 -8" />
        </g>
        <path d="M0 205 q35 -16 70 -4 q25 -14 55 0 q35 -12 65 2 q32 -14 68 0 q35 -12 70 0 q38 -14 72 2 L400 260 L0 260 Z" fill="#EFE7D6" opacity="0.92" />
        <path d="M0 232 q45 -12 90 0 q45 -12 90 0 q45 -12 90 0 q45 -12 130 0 L400 260 L0 260 Z" fill="#FBF8F1" />
      </svg>
      {children}
    </div>
  );
}

// Vòng ngũ hành quanh Linh Căn Thạch (trang trắc nghiệm)
export function LinhCanStone({ active = "kim", glow = "#D9A23A", className = "w-[240px] h-[240px]" }) {
  const pos = { kim: [126, 22], moc: [226, 95], thuy: [188, 214], hoa: [64, 214], tho: [26, 95] };
  return (
    <svg viewBox="0 0 252 252" className={className} role="img" aria-label={`Linh Căn Thạch đang cảm ứng hệ ${elementOf(active).vn}`}>
      <circle className="tt-spin" cx="126" cy="126" r="104" fill="none" stroke="#1C1A17" strokeWidth="1.2" opacity="0.35" strokeDasharray="2 6" />
      <circle cx="126" cy="126" r="84" fill="none" stroke="#1C1A17" strokeWidth="2.5" opacity="0.8" />
      <circle cx="126" cy="126" r="78" fill="none" stroke="#1C1A17" strokeWidth="0.8" opacity="0.5" />
      <circle className="tt-breathe" cx="126" cy="128" r="52" fill={glow} opacity="0.16" />
      <circle className="tt-breathe2" cx="126" cy="128" r="36" fill={glow} opacity="0.22" />
      <path d="M126 82 L152 100 L147 142 L126 158 L105 142 L100 100 Z" fill="#23201B" />
      <path d="M126 82 L152 100 L126 111 L100 100 Z" fill="#3E3932" />
      <path d="M126 111 L126 158" stroke="#5B554C" strokeWidth="1.2" />
      <circle className="tt-pulse" cx="126" cy="124" r="11" fill={glow} />
      <circle cx="126" cy="124" r="4.5" fill="#FFF6DA" />
      <path d="M92 170 q34 14 68 0 l-8 12 h-52 z" fill="#1C1A17" opacity="0.85" />
      <path d="M86 184 h80" stroke="#1C1A17" strokeWidth="3" strokeLinecap="round" />
      {ELEMENTS.map((e) => {
        const [x, y] = pos[e.key]; const on = e.key === active;
        return (
          <g key={e.key}>
            <circle cx={x} cy={y} r={on ? 20 : 17} fill={on ? "#1C1A17" : "#F7F1E3"} stroke={on ? "none" : "#8C7F68"} strokeWidth="1.2" />
            <text x={x} y={y + 7} textAnchor="middle" fontFamily='"Ma Shan Zheng","Noto Serif SC",serif' fontSize={on ? 22 : 20} fill={on ? glow : "#5E5446"}>{e.zh}</text>
          </g>
        );
      })}
    </svg>
  );
}

// Biểu đồ ngũ hành (radar 5 cạnh)
export function NguHanhChart({ scores, weak, className = "w-[270px] h-[232px]" }) {
  const cx = 120, cy = 111, R = 80;
  const ang = [-90, -18, 54, 126, 198].map((a) => (a * Math.PI) / 180);
  const pt = (i, r) => `${(cx + r * Math.cos(ang[i])).toFixed(1)},${(cy + r * Math.sin(ang[i])).toFixed(1)}`;
  const outer = ELEMENTS.map((_, i) => pt(i, R)).join(" ");
  const mid = ELEMENTS.map((_, i) => pt(i, R / 2)).join(" ");
  const val = ELEMENTS.map((e, i) => pt(i, (R * Math.max(4, scores?.[e.key] || 0)) / 100)).join(" ");
  const lab = [[120, 20, "middle"], [206, 92, "start"], [174, 200, "middle"], [66, 200, "middle"], [34, 92, "end"]];
  const label = ELEMENTS.map((e) => `${e.vn} ${Math.round(scores?.[e.key] || 0)}`).join(", ");
  return (
    <svg viewBox="0 0 240 206" className={className} role="img" aria-label={`Ngũ hành đồ: ${label}`}>
      <circle cx={cx} cy={cy} r="96" fill="none" stroke="#1C1A17" strokeWidth="1" opacity="0.3" strokeDasharray="2 5" />
      <polygon points={outer} fill="#FAF5E8" stroke="#1C1A17" strokeWidth="2.5" strokeLinejoin="round" />
      <polygon points={mid} fill="none" stroke="#B9AD97" strokeWidth="1" />
      {ELEMENTS.map((_, i) => <line key={i} x1={cx} y1={cy} x2={pt(i, R).split(",")[0]} y2={pt(i, R).split(",")[1]} stroke="#CDBF9F" strokeWidth="1" />)}
      <polygon className="tt-grow" points={val} fill="#1C1A17" fillOpacity="0.78" stroke="#1C1A17" strokeWidth="2" strokeLinejoin="round" />
      {ELEMENTS.map((e, i) => (
        <text key={e.key} x={lab[i][0]} y={lab[i][1]} textAnchor={lab[i][2]} fontFamily='"Ma Shan Zheng","Noto Serif SC",serif' fontSize="22" fill={e.key === weak ? "#9E2F22" : "#1C1A17"}>{e.zh}</text>
      ))}
    </svg>
  );
}

// Chữ viết dọc (xếp từng chữ, cột phải đọc trước) — ổn định trên mọi trình duyệt hơn writing-mode
export function VText({ lines, className = "", colClass = "", gap = "gap-3" }) {
  const cols = Array.isArray(lines) ? lines : [lines];
  return (
    <span className={`inline-flex flex-row-reverse ${gap} ${className}`}>
      {cols.map((line, i) => (
        <span key={i} className={`flex flex-col items-center leading-[1.05] ${colClass}`}>
          {[...line].map((ch, k) => <span key={k} className={/[，。、]/.test(ch) ? "self-end -mt-[0.35em] mb-[0.1em]" : ""}>{ch}</span>)}
        </span>
      ))}
    </span>
  );
}

// ---------- Ngày (giờ máy người học) ----------
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const dayNum = (key) => { const [y, m, d] = String(key || "").split("-").map(Number); return y ? Math.round(Date.UTC(y, m - 1, d) / 864e5) : 0; };

// Hồ lô đan dược
export function Gourd({ color = "#9E2F22", ch = "丹", className = "w-7 h-9" }) {
  return (
    <svg viewBox="0 0 28 34" className={className} aria-hidden="true">
      <path d="M8 2h12v5l5 6v15a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V13l5-6z" fill={color} />
      <rect x="6" y="1" width="16" height="4" rx="1" fill="#6E4B2E" />
      <text x="14" y="25" textAnchor="middle" fontFamily='"Ma Shan Zheng","Noto Serif SC",serif' fontSize="12" fill="#FBF3E4">{ch}</text>
    </svg>
  );
}
