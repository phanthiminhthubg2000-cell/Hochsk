"use client";
// ============================================================
// BẢN ĐỒ TÔNG MÔN & THẾ GIỚI — Sơn Hải Thư Viện v2 (giai đoạn B)
// Ảnh nền không chữ (public/tt/*.jpg); tên công trình, vùng đất, nhãn trạng thái đều vẽ bằng code
// Toạ độ theo % của ảnh để co giãn theo mọi khổ màn hình
// ============================================================
import Link from "next/link";
import { REALMS8 } from "./tuVi";
import { elementOf } from "./tuTien";

// ---------- Công trình trong tông môn ----------
// box = [trái, trên, phải, dưới] (%), lab = [x, y] tâm biển tên (%)
export const BUILDINGS = [
  { key: "chuong-mon", vn: "Chưởng Môn Điện", zh: "掌门殿", box: [35, 5.6, 67, 30.6], lab: [51, 4.5], href: "/tong-mon", hint: "Tông môn · lớp học" },
  { key: "tang-kinh", vn: "Tàng Kinh Các", zh: "藏经阁", box: [7.3, 41, 26.6, 55], lab: [17, 38.5], tab: "learn", hint: "Bài giảng" },
  { key: "luyen-dan", vn: "Luyện Đan Phòng", zh: "炼丹房", box: [83, 25.8, 100, 37.2], lab: [85.5, 23.6], href: "/luyen-dan", hint: "Ôn từ vựng" },
  { key: "do-kiep", vn: "Độ Kiếp Đài", zh: "渡劫台", box: [80.6, 12.2, 90.2, 19.4], lab: [85, 10.2], tab: "exam", hint: "Thi đột phá" },
  { key: "tran-phap", vn: "Trận Pháp Đài", zh: "阵法台", box: [30, 37.5, 66, 46.7], lab: [48, 35.4], href: "/arrange", hint: "Ngữ pháp · sắp câu" },
  { key: "dau-phap", vn: "Đấu Pháp Đài", zh: "斗法台", box: [70.9, 45.8, 82.8, 55.8], lab: [77, 57.4], href: "/luan-vo", hint: "Luận võ" },
  { key: "trac-linh", vn: "Trắc Linh Đài", zh: "测灵台", box: [38.4, 59.4, 62.5, 69.2], lab: [50.4, 71], href: "/linh-can", hint: "Linh căn · cảnh giới" },
  { key: "linh-thu", vn: "Đệ Tử Cư Sở", zh: "弟子居", box: [78.4, 62.2, 99.9, 74.2], lab: [86, 75.6], href: "/de-tu", hint: "Hồ sơ · linh thú" },
  { key: "tam-ma", vn: "Tâm Ma Động", zh: "心魔洞", box: [0.7, 77.8, 18.9, 98.6], lab: [14, 75.6], href: "/tam-ma", hint: "Câu hay sai" },
];

const PLATE = "absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none inline-flex items-center gap-1.5 whitespace-nowrap rounded-[5px] border border-[#C9A24E] bg-[linear-gradient(#2E2922,#211D18)] text-[#F6EBD2] shadow-[0_0_0_2px_#211D18,0_3px_8px_rgba(0,0,0,.4)] font-serif-vn font-bold";

/**
 * @param tags  { [key]: { text, tone: "red"|"gold"|"ink"|"violet" } } nhãn trạng thái dưới biển tên
 * @param lock  { [key]: "lý do" } công trình chưa mở
 * @param glow  key công trình được sư phụ chỉ (vòng sáng)
 * @param onTab (tab) → chuyển khu trên trang chủ
 */
export function TongMonMap({ tags = {}, lock = {}, glow, onTab, className = "" }) {
  const tone = { red: "bg-[#9E2F22] text-white", gold: "bg-[#FBF8F1] text-[#5C3D00] border border-[#9A6B12]", ink: "bg-[#1C1A17] text-[#F3EEE2]", violet: "bg-[#3A2350] text-[#F1E6FF]" };
  return (
    <div className={`relative w-full aspect-[500/496] overflow-hidden rounded-[18px] bg-[#1E2A33] [container-type:inline-size] ${className}`}>
      <style>{`@keyframes tmRing{0%{transform:translate(-50%,-50%) scale(.6);opacity:.9}100%{transform:translate(-50%,-50%) scale(1.7);opacity:0}}
@keyframes tmFlash{0%,100%{opacity:0}4%{opacity:.9}6%{opacity:.1}8%{opacity:.8}12%{opacity:0}}
@keyframes tmGlow{0%,100%{opacity:.4}50%{opacity:.9}}
@keyframes tmDrift{0%,100%{transform:translateX(0)}50%{transform:translateX(8%)}}
.tm-plate{font-size:clamp(9px,2.6cqw,15px);height:clamp(20px,5.2cqw,30px);padding:0 clamp(6px,2cqw,14px)}
.tm-plate b{font-family:"Noto Serif SC",serif;color:#E6C36E;font-weight:700}
.tm-tag{font-size:clamp(9px,2.1cqw,12px)}
@container (max-width:420px){.tm-plate b{display:none}}
@media (prefers-reduced-motion:reduce){.tm-anim{animation:none!important}}`}</style>
      <img src="/tt/tong-mon.jpg" alt="Tông môn Sơn Hải Thư Viện: điện chính trên đỉnh núi, các đình đài trên vách đá, thác nước, cầu đá và hồ sen" className="absolute inset-0 w-full h-full object-cover" />
      <div aria-hidden="true" className="tm-anim absolute pointer-events-none mix-blend-screen" style={{ left: "75%", top: "4%", width: "22%", height: "20%", background: "radial-gradient(closest-side, rgba(255,238,170,.85), transparent)", animation: "tmFlash 5s linear infinite" }} />
      <div aria-hidden="true" className="tm-anim absolute pointer-events-none mix-blend-screen" style={{ left: "-2%", top: "76%", width: "24%", height: "22%", background: "radial-gradient(closest-side, rgba(140,80,200,.75), transparent)", animation: "tmGlow 2.6s ease-in-out infinite" }} />
      <div aria-hidden="true" className="tm-anim absolute pointer-events-none" style={{ left: "4%", top: "63%", width: "52%", height: "16%", background: "radial-gradient(closest-side, rgba(240,244,248,.5), transparent)", animation: "tmDrift 22s ease-in-out infinite" }} />
      {BUILDINGS.map((b) => {
        const [l, t, r, d] = b.box; const locked = lock[b.key];
        const style = { left: `${l}%`, top: `${t}%`, width: `${r - l}%`, height: `${d - t}%` };
        const cls = `absolute rounded-[14px] outline-none transition-shadow hover:shadow-[0_0_0_2px_rgba(230,182,86,.95),0_0_30px_8px_rgba(230,182,86,.45)] focus-visible:shadow-[0_0_0_3px_#E6B656] ${glow === b.key ? "shadow-[0_0_0_2px_rgba(230,182,86,.95),0_0_30px_8px_rgba(230,182,86,.45)]" : ""}`;
        const label = `${b.vn} — ${b.hint}${locked ? ` (${locked})` : ""}`;
        return b.tab
          ? <button key={b.key} type="button" aria-label={label} title={label} onClick={() => onTab && onTab(b.tab)} className={cls} style={style} />
          : <Link key={b.key} href={b.href} aria-label={label} title={label} className={cls} style={style} />;
      })}
      {glow && (() => { const b = BUILDINGS.find((x) => x.key === glow); if (!b) return null; const [l, t, r, d] = b.box; return <span aria-hidden="true" className="tm-anim absolute w-[9%] aspect-square rounded-full border-[3px] border-[#E6B656] pointer-events-none" style={{ left: `${(l + r) / 2}%`, top: `${(t + d) / 2}%`, animation: "tmRing 1.8s ease-out infinite" }} />; })()}
      {BUILDINGS.map((b) => (
        <span key={`p${b.key}`} className={`${PLATE} tm-plate ${lock[b.key] ? "opacity-80 grayscale-[.5]" : ""}`} style={{ left: `${b.lab[0]}%`, top: `${b.lab[1]}%` }} aria-hidden="true">
          {b.vn} <b>{b.zh}</b>
        </span>
      ))}
      {BUILDINGS.map((b) => {
        const tg = lock[b.key] ? { text: `🔒 ${lock[b.key]}`, tone: "ink" } : tags[b.key]; if (!tg) return null;
        return <span key={`t${b.key}`} aria-hidden="true" className={`tm-tag absolute -translate-x-1/2 pointer-events-none whitespace-nowrap font-extrabold px-2 py-0.5 rounded-full shadow ${tone[tg.tone || "gold"]}`} style={{ left: `${Math.min(88, Math.max(12, b.lab[0]))}%`, top: `calc(${b.lab[1]}% + clamp(11px,2.9cqw,17px))` }}>{tg.text}</span>;
      })}
    </div>
  );
}

// ---------- Bản đồ thế giới ----------
export const REGIONS = [
  { key: "pham-nhan", vn: "Phàm Nhân Giới", zh: "凡人界", realms: [0], box: [0, 66.7, 17.6, 84.7], card: [14, 90] },
  { key: "thanh-van", vn: "Thanh Vân Sơn", zh: "青云山", realms: [1], box: [11, 41.7, 26, 56.4], card: [17, 34] },
  { key: "kim-dan", vn: "Kim Đan Cốc", zh: "金丹谷", realms: [2], box: [34, 34, 58, 60.5], card: [46, 27] },
  { key: "nguyen-anh", vn: "Nguyên Anh Hải", zh: "元婴海", realms: [3], box: [31, 60.5, 75, 81], card: [40, 91] },
  { key: "van-phap", vn: "Vạn Pháp Thành", zh: "万法城", realms: [4], box: [62, 52, 85.5, 68.6], card: [80, 75] },
  { key: "thien-co", vn: "Thiên Cơ Các", zh: "天机阁", realms: [5, 6], box: [76, 30.8, 89.5, 45.5], card: [84, 27] },
  { key: "tien-gioi", vn: "Tiên Giới", zh: "仙界", realms: [7], box: [73.7, 4, 98, 22.5], card: [55, 8] },
];
export const regionOfRealm = (idx) => REGIONS.find((r) => r.realms.includes(idx)) || REGIONS[0];

export function WorldMap({ realmIdx = 0, onPick, picked, className = "" }) {
  const here = regionOfRealm(realmIdx);
  return (
    <div className={`relative w-full aspect-[517/496] overflow-hidden rounded-[18px] bg-[#E9DAB8] [container-type:inline-size] ${className}`}>
      <style>{`@keyframes wmPing{0%{transform:translate(-50%,-50%) scale(.5);opacity:.9}100%{transform:translate(-50%,-50%) scale(2.2);opacity:0}}
@keyframes wmDash{to{stroke-dashoffset:-34}}
.wm-card{font-size:clamp(9px,2.3cqw,14px)}
.wm-card .cn{font-family:"Noto Serif SC",serif;letter-spacing:.15em}
@container (max-width:420px){.wm-card .cn,.wm-card .hk{display:none}}
@media (prefers-reduced-motion:reduce){.wm-anim{animation:none!important}}`}</style>
      <img src="/tt/the-gioi.jpg" alt="Sơn Hải Dư Đồ: núi non, hồ lớn ở giữa, làng hoa đào góc trái, cung điện vàng trên mây góc phải" className="absolute inset-0 w-full h-full object-cover" />
      {REGIONS.map((r) => {
        const locked = Math.min(...r.realms) > realmIdx; if (!locked) return null; const [l, t, rr, d] = r.box;
        return <div key={`f${r.key}`} aria-hidden="true" className="absolute pointer-events-none rounded-full" style={{ left: `${l - 4}%`, top: `${t - 4}%`, width: `${rr - l + 8}%`, height: `${d - t + 8}%`, backdropFilter: "grayscale(.85) brightness(1.05) blur(1px)", WebkitBackdropFilter: "grayscale(.85) brightness(1.05) blur(1px)", maskImage: "radial-gradient(closest-side,#000 55%,transparent)", WebkitMaskImage: "radial-gradient(closest-side,#000 55%,transparent)" }} />;
      })}
      <svg viewBox="0 0 750 720" preserveAspectRatio="none" aria-hidden="true" className="absolute inset-0 w-full h-full pointer-events-none">
        <path d="M65 545 C85 470 115 420 140 375" fill="none" stroke="#2F6E5A" strokeWidth="4" strokeLinecap="round" strokeDasharray="2 8" />
        <path className="wm-anim" d="M140 375 C205 330 275 320 335 340 S335 470 335 490 S455 450 535 440 S595 330 615 280 S635 160 640 120" fill="none" stroke="#9E2F22" strokeWidth="3.5" strokeDasharray="3 9" strokeLinecap="round" style={{ animation: "wmDash 2.4s linear infinite" }} />
      </svg>
      {REGIONS.map((r, i) => {
        const [l, t, rr, d] = r.box; const locked = Math.min(...r.realms) > realmIdx; const passed = Math.max(...r.realms) < realmIdx;
        const label = `${r.vn} — ${r.realms.map((x) => REALMS8[x].hsk.split(" · ")[0]).join(", ")}${locked ? " (chưa mở)" : passed ? " (đã qua)" : r === here ? " (bạn đang ở đây)" : ""}`;
        return <button key={r.key} type="button" aria-label={label} title={label} onClick={() => onPick && onPick(r)}
          className={`absolute rounded-[30px] outline-none transition-shadow hover:shadow-[0_0_0_2px_rgba(230,182,86,.95),0_0_36px_10px_rgba(230,182,86,.4)] focus-visible:shadow-[0_0_0_3px_#E6B656] ${picked === r.key ? "shadow-[0_0_0_2px_rgba(230,182,86,.95),0_0_36px_10px_rgba(230,182,86,.4)]" : r === here ? "shadow-[0_0_0_2.5px_#9E2F22,0_0_28px_6px_rgba(158,47,34,.35)]" : ""}`}
          style={{ left: `${l}%`, top: `${t}%`, width: `${rr - l}%`, height: `${d - t}%` }} />;
      })}
      {REGIONS.map((r, i) => {
        const locked = Math.min(...r.realms) > realmIdx; const passed = Math.max(...r.realms) < realmIdx;
        const hk = r.realms.map((x) => REALMS8[x].hsk.split(" · ")[0]).join("–").replace(/HSK (\d)–HSK (\d)/, "HSK $1–$2");
        return (
          <div key={`c${r.key}`} aria-hidden="true" className={`wm-card absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-start gap-1.5 rounded-[3px] border border-[#8C6A3A] bg-[linear-gradient(#FAF3E2,#F0E4C8)] px-2 py-1 shadow-[0_0_0_2px_#F6EEDB,0_3px_8px_rgba(59,47,34,.3)] ${locked ? "grayscale-[.55] opacity-90" : ""}`} style={{ left: `${r.card[0]}%`, top: `${r.card[1]}%` }}>
            <span className="grid place-items-center w-[1.7em] h-[1.7em] rounded-[3px] bg-[#9E2F22] text-[#FBF3E4] font-serif-vn font-extrabold -rotate-3 shrink-0">{i + 1}</span>
            <span className="flex flex-col items-center leading-tight">
              <b className="font-serif-vn whitespace-nowrap text-[#2B2016]">{r.vn}</b>
              <span className="cn font-bold text-[#2B2016]">{r.zh}</span>
              <span className={`hk mt-0.5 px-1.5 rounded-[2px] text-[0.8em] font-bold whitespace-nowrap text-[#FBF3E4] ${locked ? "bg-[#5E5446]" : "bg-[#8E2A1F]"}`}>{locked ? "🔒 " : passed ? "✓ " : ""}{hk}</span>
            </span>
          </div>
        );
      })}
      {(() => { const [l, t, rr, d] = here.box; return <>
        <span aria-hidden="true" className="wm-anim absolute w-[6%] aspect-square rounded-full bg-[#9E2F22] pointer-events-none" style={{ left: `${(l + rr) / 2}%`, top: `${(t + d) / 2}%`, animation: "wmPing 1.8s ease-out infinite" }} />
        <span aria-hidden="true" className="absolute w-[3.4%] aspect-square rounded-full bg-[#9E2F22] border-[3px] border-[#FBF8F1] shadow -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ left: `${(l + rr) / 2}%`, top: `${(t + d) / 2}%` }} />
      </>; })()}
    </div>
  );
}

// ---------- Sư phụ chỉ điểm mỗi ngày ----------
// s = { realm (tuViState), quest, linhCan (judge), nextLesson, reviewLesson, tamMaCount, dueWords }
export function suPhuTip(s) {
  const r = s.realm;
  if (!r) return { text: "Đồ nhi, đăng nhập để vi sư ghi danh con vào tông môn.", glow: null };
  if (r.provisional) return { text: "Đồ nhi mới nhập môn — lên Trắc Linh Đài đo linh căn và định cảnh giới trước đã, để vi sư biết nên truyền công pháp nào.", glow: "trac-linh", href: "/linh-can" };
  if (r.peak && s.quest?.done && r.kiepN) return { text: `Tu vi ${r.vn} đã viên mãn. Lôi kiếp đang chờ ở Độ Kiếp Đài — qua được là lên ${r.next?.vn}.`, glow: "do-kiep", tab: "exam" };
  if (r.peak && r.idx === 0 && s.quest?.done) return { text: "Con đã đủ căn cơ. Bấm Nhập môn để bước vào Luyện Khí.", glow: null };
  if (r.peak && !s.quest?.done) return { text: `Tu vi đã tới Đỉnh phong, nhưng còn nhiệm vụ cảnh giới: ${s.quest.label} (${s.quest.have}/${s.quest.need}). Vào Tàng Kinh Các luyện cho thành.`, glow: "tang-kinh", tab: "learn" };
  if ((s.tamMaCount || 0) >= 8) return { text: `Tâm ma đang lớn: ${s.tamMaCount} từ hay sai. Vào Tâm Ma Động trảm bớt rồi hãy học bài mới.`, glow: "tam-ma", href: "/tam-ma" };
  if ((s.dueWords || 0) >= 10) return { text: `Lò đan có ${s.dueWords} từ đến hạn ôn. Luyện xong một lò ở Luyện Đan Phòng là giữ được linh lực.`, glow: "luyen-dan", href: "/luyen-dan" };
  if (s.reviewLesson) return { text: `Công pháp "${s.reviewLesson.lectureName}" đến hạn ôn. Ôn lại để lên Viên mãn, kẻo rạn nứt.`, glow: "tang-kinh", tab: "learn" };
  const w = s.linhCan?.weak ? elementOf(s.linhCan.weak) : null;
  if (s.nextLesson) return { text: `Hôm nay luyện tiếp "${s.nextLesson.lectureName}". Còn ${r.toNext} tu vi nữa lên tầng ${r.tang + 1 > 9 ? "Đỉnh phong" : r.tang + 1}.${w ? ` Hệ ${w.vn} (${w.skill}) của con còn yếu, chớ bỏ.` : ""}`, glow: "tang-kinh", tab: "learn" };
  return { text: "Vào Tàng Kinh Các chọn công pháp hợp cảnh giới của con.", glow: "tang-kinh", tab: "learn" };
}
