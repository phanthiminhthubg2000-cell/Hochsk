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
  { key: "chuong-mon", vn: "Chưởng Môn Điện", zh: "掌门殿", box: [40.7, 5.3, 59.8, 29.8], lab: [50, 3.6], href: "/tong-mon", hint: "Tông môn · lớp học" },
  { key: "tang-kinh", vn: "Tàng Kinh Các", zh: "藏经阁", box: [7.8, 28.7, 24, 47.8], lab: [16, 26.5], tab: "learn", hint: "Bài giảng" },
  { key: "luyen-dan", vn: "Luyện Đan Phòng", zh: "炼丹房", box: [71.2, 35, 88, 50], lab: [79.6, 52.5], href: "/luyen-dan", hint: "Ôn từ vựng" },
  { key: "do-kiep", vn: "Độ Kiếp Đài", zh: "渡劫台", box: [75.4, 2, 92.2, 21], lab: [83.8, 23], tab: "exam", hint: "Thi đột phá" },
  { key: "tran-phap", vn: "Trận Pháp Đài", zh: "阵法台", box: [43.7, 31, 56.9, 53], lab: [50.3, 49], href: "/arrange", hint: "Ngữ pháp · sắp câu" },
  { key: "dau-phap", vn: "Đấu Pháp Đài", zh: "斗法台", box: [25.7, 44.6, 38.3, 55.3], lab: [32, 57.5], href: "/luan-vo", hint: "Luận võ" },
  { key: "trac-linh", vn: "Trắc Linh Đài", zh: "测灵台", box: [43, 55, 55, 85], lab: [49, 89], href: "/linh-can", hint: "Linh căn · cảnh giới" },
  { key: "linh-thu", vn: "Đệ Tử Cư Sở", zh: "弟子居", box: [72.4, 59.5, 95.8, 88], lab: [99, 91], an: "r", href: "/de-tu", hint: "Hồ sơ · linh thú" },
  { key: "tam-ma", vn: "Tâm Ma Động", zh: "心魔洞", box: [3.6, 59.5, 31, 92.5], lab: [1, 57], an: "l", href: "/tam-ma", hint: "Câu hay sai" },
];

const PLATE = "absolute pointer-events-none inline-flex items-center gap-1.5 whitespace-nowrap rounded-[5px] border border-[#C9A24E] bg-[linear-gradient(#2E2922,#211D18)] text-[#F6EBD2] shadow-[0_0_0_2px_#211D18,0_3px_8px_rgba(0,0,0,.4)] font-serif-vn font-bold";

/**
 * @param tags  { [key]: { text, tone: "red"|"gold"|"ink"|"violet" } } nhãn trạng thái dưới biển tên
 * @param lock  { [key]: "lý do" } công trình chưa mở
 * @param glow  key công trình được sư phụ chỉ (vòng sáng)
 * @param onTab (tab) → chuyển khu trên trang chủ
 */
const anchorStyle = (b, dy = 0) => {
  const [x, y] = b.lab; const top = dy ? `calc(${y}% + ${dy})` : `${y}%`;
  if (b.an === "r") return { right: `${100 - x}%`, top, transform: dy ? "none" : "translateY(-50%)" };
  if (b.an === "l") return { left: `${x}%`, top, transform: dy ? "none" : "translateY(-50%)" };
  return { left: `${x}%`, top, transform: dy ? "translateX(-50%)" : "translate(-50%,-50%)" };
};
export function TongMonMap({ tags = {}, lock = {}, glow, onTab, className = "" }) {
  const tone = { red: "bg-[#9E2F22] text-white", gold: "bg-[#FBF8F1] text-[#5C3D00] border border-[#9A6B12]", ink: "bg-[#1C1A17] text-[#F3EEE2]", violet: "bg-[#3A2350] text-[#F1E6FF]" };
  return (
    <div className={`relative w-full aspect-[1671/941] overflow-hidden rounded-[6px] bg-[#1E2A33] border border-[#C9A24E] shadow-[0_0_0_3px_#1C1A17] [container-type:inline-size] ${className}`}>
      <style>{`@keyframes tmRing{0%{transform:translate(-50%,-50%) scale(.6);opacity:.9}100%{transform:translate(-50%,-50%) scale(1.7);opacity:0}}
@keyframes tmFlash{0%,100%{opacity:0}4%{opacity:.9}6%{opacity:.1}8%{opacity:.8}12%{opacity:0}}
@keyframes tmGlow{0%,100%{opacity:.4}50%{opacity:.9}}
@keyframes tmDrift{0%,100%{transform:translateX(0)}50%{transform:translateX(8%)}}
.tm-plate{font-size:clamp(9px,2.05cqw,13px);height:clamp(18px,4.2cqw,26px);padding:0 clamp(5px,1.6cqw,11px)}
.tm-plate b{font-family:"Noto Serif SC",serif;color:#E6C36E;font-weight:700}
.tm-tag{font-size:clamp(8.5px,1.8cqw,11.5px)}
@container (max-width:520px){.tm-plate b{display:none}}
@media (prefers-reduced-motion:reduce){.tm-anim{animation:none!important}}`}</style>
      <img src="/tt/tong-mon.jpg" alt="Tông môn Sơn Hải Thư Viện: điện chính dưới trăng tròn, bậc đá lớn giữa thác nước, Tàng Kinh Các bên trái, động tím góc trái, đài lơ lửng trên mây" className="absolute inset-0 w-full h-full object-cover" />
      <div aria-hidden="true" className="tm-anim absolute pointer-events-none mix-blend-screen" style={{ left: "74%", top: "0%", width: "20%", height: "24%", background: "radial-gradient(closest-side, rgba(170,210,255,.8), transparent)", animation: "tmFlash 5s linear infinite" }} />
      <div aria-hidden="true" className="tm-anim absolute pointer-events-none mix-blend-screen" style={{ left: "4%", top: "66%", width: "20%", height: "28%", background: "radial-gradient(closest-side, rgba(150,90,220,.7), transparent)", animation: "tmGlow 2.6s ease-in-out infinite" }} />
      <div aria-hidden="true" className="tm-anim absolute pointer-events-none" style={{ left: "20%", top: "84%", width: "60%", height: "16%", background: "radial-gradient(closest-side, rgba(240,244,248,.45), transparent)", animation: "tmDrift 22s ease-in-out infinite" }} />
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
        <span key={`p${b.key}`} className={`${PLATE} tm-plate ${lock[b.key] ? "opacity-80 grayscale-[.5]" : ""}`} style={anchorStyle(b)} aria-hidden="true">
          {b.vn} <b>{b.zh}</b>
        </span>
      ))}
      {BUILDINGS.map((b) => {
        const tg = lock[b.key] ? { text: `🔒 ${lock[b.key]}`, tone: "ink" } : tags[b.key]; if (!tg) return null;
        return <span key={`t${b.key}`} aria-hidden="true" className={`tm-tag absolute pointer-events-none whitespace-nowrap font-extrabold px-2 py-0.5 rounded-[3px] shadow ${tone[tg.tone || "gold"]}`} style={anchorStyle(b, "clamp(10px,2.4cqw,15px)")}>{tg.text}</span>;
      })}
    </div>
  );
}

// ---------- Bản đồ thế giới ----------
export const REGIONS = [
  { key: "pham-nhan", vn: "Phàm Nhân Giới", zh: "凡人界", realms: [0], box: [1.8, 69, 27.5, 91.4], card: [20, 92] },
  { key: "thanh-van", vn: "Thanh Vân Sơn", zh: "青云山", realms: [1], box: [10, 48.9, 33.5, 68], card: [8.5, 45] },
  { key: "kim-dan", vn: "Kim Đan Cốc", zh: "金丹谷", realms: [2], box: [6, 5.3, 37, 32], card: [40, 8] },
  { key: "nguyen-anh", vn: "Nguyên Anh Hải", zh: "元婴海", realms: [3], box: [32.3, 25.5, 56.9, 50], card: [44, 58] },
  { key: "van-phap", vn: "Vạn Pháp Thành", zh: "万法城", realms: [4], box: [54, 55, 80, 81], card: [67, 88] },
  { key: "thien-co", vn: "Thiên Cơ Các", zh: "天机阁", realms: [5, 6], box: [73.6, 35, 98.7, 55.3], card: [90, 60] },
  { key: "tien-gioi", vn: "Tiên Giới", zh: "仙界", realms: [7], box: [63.4, 3.2, 98.1, 31.9], card: [59, 8] },
];
export const regionOfRealm = (idx) => REGIONS.find((r) => r.realms.includes(idx)) || REGIONS[0];

export function WorldMap({ realmIdx = 0, onPick, picked, unplaced = false, className = "" }) {
  const here = regionOfRealm(realmIdx);
  return (
    <div className={`relative w-full aspect-[1671/941] overflow-hidden rounded-[6px] bg-[#1A2236] border border-[#C9A24E] shadow-[0_0_0_3px_#1C1A17] [container-type:inline-size] ${className}`}>
      <style>{`@keyframes wmPing{0%{transform:translate(-50%,-50%) scale(.5);opacity:.9}100%{transform:translate(-50%,-50%) scale(2.2);opacity:0}}
@keyframes wmDash{to{stroke-dashoffset:-34}}
.wm-card{font-size:clamp(8.5px,1.95cqw,13px)}
.wm-card .cn{font-family:"Noto Serif SC",serif;letter-spacing:.15em}
@container (max-width:420px){.wm-card .cn,.wm-card .hk{display:none}}
@media (prefers-reduced-motion:reduce){.wm-anim{animation:none!important}}`}</style>
      <img src="/tt/the-gioi.jpg" alt="Sơn Hải Dư Đồ: bảy cung điện trên các vách núi giữa đêm, nối nhau bằng cầu đá và dải sáng vàng, cung điện dưới trăng ở góc phải" className="absolute inset-0 w-full h-full object-cover" />
      {REGIONS.map((r) => {
        const locked = Math.min(...r.realms) > realmIdx; if (!locked) return null; const [l, t, rr, d] = r.box;
        return <div key={`f${r.key}`} aria-hidden="true" className="absolute pointer-events-none rounded-full" style={{ left: `${l - 4}%`, top: `${t - 4}%`, width: `${rr - l + 8}%`, height: `${d - t + 8}%`, backdropFilter: "grayscale(.85) brightness(.7) blur(1px)", WebkitBackdropFilter: "grayscale(.85) brightness(.7) blur(1px)", maskImage: "radial-gradient(closest-side,#000 55%,transparent)", WebkitMaskImage: "radial-gradient(closest-side,#000 55%,transparent)" }} />;
      })}
      <svg viewBox="0 0 1671 941" preserveAspectRatio="none" aria-hidden="true" className="absolute inset-0 w-full h-full pointer-events-none">
      </svg>
      {REGIONS.map((r, i) => {
        const [l, t, rr, d] = r.box; const locked = Math.min(...r.realms) > realmIdx; const passed = Math.max(...r.realms) < realmIdx;
        const label = `${r.vn} — ${r.realms.map((x) => REALMS8[x].hsk.split(" · ")[0]).join(", ")}${locked ? " (chưa mở)" : passed ? " (đã qua)" : r === here ? " (bạn đang ở đây)" : ""}`;
        return <button key={r.key} type="button" aria-label={label} title={label} onClick={() => onPick && onPick(r)}
          className={`absolute rounded-[30px] outline-none transition-shadow hover:shadow-[0_0_0_2px_rgba(230,182,86,.95),0_0_36px_10px_rgba(230,182,86,.4)] focus-visible:shadow-[0_0_0_3px_#E6B656] ${picked === r.key ? "shadow-[0_0_0_2px_rgba(230,182,86,.95),0_0_36px_10px_rgba(230,182,86,.4)]" : r === here && !unplaced ? "shadow-[0_0_0_2.5px_#9E2F22,0_0_28px_6px_rgba(158,47,34,.35)]" : ""}`}
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
      {!unplaced && (() => { const [l, t, rr, d] = here.box; return <>
        <span aria-hidden="true" className="wm-anim absolute w-[4%] aspect-square rounded-full bg-[#9E2F22] pointer-events-none" style={{ left: `${(l + rr) / 2}%`, top: `${(t + d) / 2}%`, animation: "wmPing 1.8s ease-out infinite" }} />
        <span aria-hidden="true" className="absolute w-[2.6%] aspect-square rounded-full bg-[#9E2F22] border-2 border-[#FBF8F1] shadow -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ left: `${(l + rr) / 2}%`, top: `${(t + d) / 2}%` }} />
      </>; })()}
    </div>
  );
}

// ---------- Sư phụ chỉ điểm mỗi ngày ----------
// s = { realm (tuViState), quest, linhCan (judge), nextLesson, reviewLesson, tamMaCount, dueWords }
export function suPhuTip(s) {
  const r = s.realm;
  if (!r) return { text: "Đồ nhi, đăng nhập để vi sư ghi danh con vào tông môn.", glow: null };
  if (r.provisional && s.nextLesson) return { text: `Đồ nhi chưa định cảnh giới. Lúc rảnh hãy lên Trắc Linh Đài; còn hôm nay cứ luyện tiếp "${s.nextLesson.lectureName}" — tu vi vẫn được tính đủ.`, glow: "tang-kinh", tab: "learn" };
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
