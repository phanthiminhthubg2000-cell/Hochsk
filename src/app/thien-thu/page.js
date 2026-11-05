"use client";
// ============================================================
// VẠN CHỮ THIÊN THƯ 万字天书 — màn mở đầu + chọn đạo hiệu (v2 · giai đoạn B)
// Lưu users/{uid}.daoHieu = { vn, zh }; xong thì lên Trắc Linh Đài
// ============================================================
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, SignInButton } from "@clerk/nextjs";
import { db } from "../../firebase";
import { doc, setDoc } from "firebase/firestore";
import { useTuVi } from "../useTuVi";

const SYL = { Thanh: "清", Phong: "风", Lạc: "落", Vân: "云", Mặc: "墨", Trúc: "竹", Tử: "紫", Yên: "烟", Bạch: "白", Lộ: "露", Kinh: "惊", Hồng: "鸿", Lam: "蓝", Khê: "溪", Minh: "明", Nguyệt: "月", Hàn: "寒", Sương: "霜", Tuyết: "雪", Vũ: "雨", Thiên: "天", Tinh: "星", Linh: "灵", Hoa: "花", Diệp: "叶", Tùng: "松", Hạc: "鹤", Nhạn: "雁", Lăng: "凌", Vô: "无", Trần: "尘", Dao: "瑶", Cầm: "琴", Kiếm: "剑", Thư: "书", Sơn: "山", Hải: "海", Ngọc: "玉", Liên: "莲", Huyền: "玄" };
const KEYS = Object.keys(SYL);
const toZh = (vn) => { const p = vn.trim().split(/\s+/); const z = p.map((x) => SYL[x[0]?.toUpperCase() + x.slice(1).toLowerCase()] || SYL[x]); return z.every(Boolean) ? z.join("") : ""; };
const suggest = () => { const out = new Set(); while (out.size < 4) { const a = KEYS[Math.floor(Math.random() * KEYS.length)], b = KEYS[Math.floor(Math.random() * KEYS.length)]; if (a !== b) out.add(`${a} ${b}`); } return [...out]; };

const PAGES = [
  { zh: "天书", t: "Ngàn năm trước", p: "Trời đất có một cuốn Vạn Chữ Thiên Thư, chép đủ mọi chữ của nhân gian. Ai đọc được chữ, người ấy hiểu được lòng người và lẽ trời." },
  { zh: "魔劫", t: "Ma Vương xé sách", p: "Các Ma Vương thèm sức mạnh của chữ, xé nát Thiên Thư. Năm nghìn chữ rơi xuống nhân gian, tản mát khắp bảy vùng: từ Phàm Nhân Giới đến Tiên Giới." },
  { zh: "书院", t: "Sơn Hải Thư Viện", p: "Thư viện trên núi mở cửa nhận thư sinh. Mỗi chữ thu lại là một phần tu vi; mỗi cấp HSK vượt qua là một lần độ kiếp. Một sách giấu cả núi sông — lòng sáng thì đường xa cũng tới." },
];

export default function ThienThuPage() {
  const router = useRouter();
  const { isSignedIn, userId } = useAuth();
  const { u } = useTuVi();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [sug, setSug] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setSug(suggest()); }, []);
  useEffect(() => { if (u?.daoHieu?.vn && !name) setName(u.daoHieu.vn); }, [u]); // eslint-disable-line react-hooks/exhaustive-deps
  const zh = toZh(name);
  const valid = name.trim().length >= 2 && name.trim().length <= 24;

  const save = async () => {
    if (!valid) return; setBusy(true);
    const daoHieu = { vn: name.trim().replace(/\s+/g, " "), zh };
    try { localStorage.setItem("sh_intro_seen", "1"); localStorage.setItem("sh_dao_hieu", JSON.stringify(daoHieu)); } catch (_) {}
    if (userId) await setDoc(doc(db, "users", userId), { daoHieu }, { merge: true }).catch(() => {});
    router.push(u?.tuVi ? "/" : "/linh-can");
  };

  const pg = PAGES[Math.min(step, PAGES.length - 1)];
  return (
    <div className="min-h-screen bg-[#15141A] text-[#EFE7D6] flex flex-col" style={{ fontFamily: '"Be Vietnam Pro","Noto Sans SC",system-ui,sans-serif' }}>
      <style>{`@keyframes ttFall{0%{transform:translateY(-80px);opacity:0}20%{opacity:1}100%{transform:translateY(220px);opacity:0}}@keyframes ttIn{0%{opacity:0;transform:translateY(10px)}100%{opacity:1;transform:none}}@media (prefers-reduced-motion:reduce){.tt-a{animation:none!important}}`}</style>
      <div className="relative w-full max-w-[560px] mx-auto aspect-[499/420] overflow-hidden">
        <img src="/tt/thienthu.jpg" alt="Cuốn thiên thư phát sáng lơ lửng trên tế đàn đá, trang giấy bay tán loạn" className="absolute inset-0 w-full h-full object-cover object-[50%_30%]" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#15141A]" style={{ background: "linear-gradient(transparent 55%, #15141A)" }} />
        {["山", "水", "心", "道", "人", "火"].map((c, i) => <span key={i} aria-hidden="true" className="tt-a absolute font-bold text-[#F2D58C]" style={{ left: `${12 + i * 14}%`, top: "40%", fontSize: `${20 + (i % 3) * 6}px`, fontFamily: '"Noto Serif SC",serif', textShadow: "0 0 10px #E6B656", animation: `ttFall ${4.5 + (i % 3)}s linear ${i * 0.7}s infinite` }}>{c}</span>)}
      </div>
      <main className="flex-1 w-full max-w-[560px] mx-auto px-5 pb-10 -mt-6 relative flex flex-col gap-4">
        <div className="flex items-baseline gap-3"><span className="font-brush text-[42px] leading-none text-[#E6B656]">万字天书</span><span className="font-serif-vn text-[20px] font-extrabold">Vạn Chữ Thiên Thư</span></div>
        {step < PAGES.length ? (
          <>
            <article key={step} className="tt-a flex flex-col gap-2" style={{ animation: "ttIn .5s ease-out" }}>
              <div className="flex items-center gap-3"><span className="font-brush text-[30px] text-[#C9472F]" aria-hidden="true">{pg.zh}</span><h1 className="font-serif-vn text-[19px] font-extrabold">{pg.t}</h1></div>
              <p className="text-[16px] leading-[1.75] text-[#CFC6B4]">{pg.p}</p>
            </article>
            <div className="flex items-center gap-1.5" aria-hidden="true">{PAGES.map((_, i) => <span key={i} className={`h-1.5 flex-1 rounded ${i <= step ? "bg-[#E6B656]" : "bg-[#3A3644]"}`} />)}</div>
            <div className="flex gap-3">
              {step > 0 && <button onClick={() => setStep(step - 1)} className="h-12 px-5 rounded-[6px] border border-[#4A4656] font-bold">Trở lại</button>}
              <button onClick={() => setStep(step + 1)} className="flex-1 h-12 rounded-[6px] bg-[#9E2F22] hover:bg-[#7A2218] text-white font-extrabold">{step + 1 < PAGES.length ? "Lật trang" : "Ghi danh vào thư viện"}</button>
            </div>
            <Link href="/" onClick={() => { try { localStorage.setItem("sh_intro_seen", "1"); } catch (_) {} }} className="self-center text-sm text-[#8C8494] underline underline-offset-2">Bỏ qua</Link>
          </>
        ) : !isSignedIn ? (
          <div className="rounded-[10px] bg-[#22212A] border border-[#4A4656] p-5 flex flex-col gap-3">
            <p className="text-[15px] leading-relaxed">Đăng nhập để ghi danh, giữ đạo hiệu và tu vi trên mọi thiết bị.</p>
            <SignInButton mode="modal"><button className="h-12 rounded-[6px] bg-[#9E2F22] text-white font-extrabold">Đăng nhập</button></SignInButton>
          </div>
        ) : (
          <div className="tt-a rounded-[10px] bg-[#22212A] border border-[#4A4656] p-5 flex flex-col gap-3" style={{ animation: "ttIn .5s ease-out" }}>
            <label htmlFor="dh" className="text-sm font-bold text-[#E6B656]">Chọn đạo hiệu của bạn</label>
            <div className="flex items-center gap-2 h-12 px-3 rounded-[6px] bg-[#15141A] border-[1.5px] border-[#D9A23A]">
              <input id="dh" value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="Ví dụ: Thanh Phong" className="flex-1 min-w-0 bg-transparent outline-none font-serif-vn text-[18px] font-bold placeholder:text-[#5E5A68]" />
              {zh && <span className="text-[18px] text-[#8C8494]" style={{ fontFamily: '"Noto Serif SC",serif' }} lang="zh-CN">{zh}</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              {sug.map((s) => <button key={s} onClick={() => setName(s)} className="text-sm border border-[#4A4656] hover:border-[#E6B656] px-3 py-1.5 rounded-full text-[#CFC6B4]">{s} <span style={{ fontFamily: '"Noto Serif SC",serif' }}>{toZh(s)}</span></button>)}
              <button onClick={() => setSug(suggest())} className="text-sm border border-[#4A4656] px-3 py-1.5 rounded-full text-[#CFC6B4]">gợi ý khác ↻</button>
            </div>
            <p className="text-xs text-[#8C8494]">Đạo hiệu hiện trên Thiên Bảng và khi luận võ. Đổi được ở Đệ Tử Cư Sở.</p>
            <button onClick={save} disabled={!valid || busy} className="h-12 rounded-[6px] bg-[#9E2F22] disabled:bg-[#4A4656] text-white font-extrabold">{u?.tuVi ? "Lưu đạo hiệu" : "Bước vào Trắc Linh Đài →"}</button>
            <div className="text-center text-xs text-[#8C8494]">Đạo hiệu → linh căn → định cảnh giới → nhập môn</div>
          </div>
        )}
      </main>
    </div>
  );
}
