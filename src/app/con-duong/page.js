"use client";
// CON ĐƯỜNG TU LUYỆN — danh sách mọi bài giảng đã thành chuỗi ải, gom theo giáo trình (mỗi bài: /con-duong/<mã>-XX)
import Link from "next/link";
import { useEffect, useState } from "react";
import GardenNav from "../GardenNav";
import { useTuVi } from "../useTuVi";
import { loadIndex, courseOf } from "./engine";

export default function ConDuongList() {
  const { u } = useTuVi();
  const [list, setList] = useState([]);
  const [local, setLocal] = useState({});
  const [cur, setCur] = useState("");
  useEffect(() => {
    loadIndex().then((x) => {
      setList(x);
      const ks = [...new Set(x.map((l) => courseOf(l.id).label))];
      let want = ""; try { want = new URLSearchParams(location.search).get("gt") || ""; } catch (_) {}
      setCur(ks.includes(want) ? want : (ks.includes("HSK 6 · 2.0") ? "HSK 6 · 2.0" : ks[0] || ""));
      const m = {}; x.forEach((l) => { try { m[l.id] = JSON.parse(localStorage.getItem(`cd_${l.id}`) || "{}"); } catch (_) {} });
      setLocal(m);
    });
  }, []);
  const doneOf = (id) => Object.keys({ ...(u?.conDuong?.[id] || {}), ...(local[id] || {}) }).length;
  let unit = null;
  const courses = [...new Set(list.map((l) => courseOf(l.id).label))].sort((a, b) => a.localeCompare(b));
  const shown = list.filter((l) => courseOf(l.id).label === cur);
  return (
    <div className="min-h-screen bg-[#EFE7D6] text-[#1C1A17]" style={{ fontFamily: '"Be Vietnam Pro","Noto Sans SC",system-ui,sans-serif' }}>
      <GardenNav active="home" title="Con đường tu luyện" />
      <main className="max-w-[960px] mx-auto px-4 md:px-8 pt-6 pb-28 md:pb-16 flex flex-col gap-4">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="font-brush text-[44px] leading-none text-[#9E2F22]">修行之路</h1>
          <span className="font-serif-vn text-[22px] font-extrabold">Con đường tu luyện{cur ? ` · ${cur}` : ""}</span>
        </div>
        <p className="text-[15px] text-[#3A352C]">Mỗi bài giảng thành một chuỗi ải: từ mới → chiêu thức ngữ pháp → bài khóa → luyện tập → Thí luyện đề HSK → Ngộ đạo (bài viết). Mỗi ải 5–7 phút, đề rút ngẫu nhiên mỗi lần vào.</p>
        <div className="flex gap-2 flex-wrap">{courses.map((c) => <button key={c} onClick={() => setCur(c)} className={`px-3 py-1.5 rounded-full text-sm font-bold border ${c === cur ? "bg-[#1C1A17] text-white border-[#1C1A17]" : "bg-[#FBF8F1] border-[#D8CBAE] hover:border-[#1C1A17]"}`}>{c}</button>)}</div>
        <ol className="grid gap-2 sm:grid-cols-2">
          {shown.map((l) => {
            const num = l.num || +(l.id.split("-").pop());
            const head = l.unit?.n !== unit; unit = l.unit?.n; const d = doneOf(l.id);
            return (
              <li key={l.id} className={head ? "sm:col-span-2 flex flex-col gap-2" : ""}>
                {head && l.unit && <div className="mt-3 font-serif-vn text-xs font-bold tracking-[0.14em] text-[#6B6253] uppercase">Chủ đề {l.unit.n} · <span className="normal-case" style={{ fontFamily: '"Noto Serif SC",serif' }}>{l.unit.zh}</span> · {l.unit.vn}</div>}
                <Link href={`/con-duong/${l.id}`} className={`flex items-center gap-3 rounded-[10px] bg-[#FBF8F1] border border-[#D8CBAE] hover:border-[#1C1A17] px-3 py-3 ${head ? "sm:w-[calc(50%-4px)]" : ""}`}>
                  <span className={`w-12 h-12 rounded-full grid place-items-center font-extrabold shrink-0 ${d >= 10 ? "bg-[#E6B656]" : d ? "bg-[#9E2F22] text-white" : "bg-[#D8CBAE] text-[#6B6253]"}`}>{num}</span>
                  <span className="flex-1 min-w-0"><b className="block text-[17px] truncate" style={{ fontFamily: '"Noto Serif SC",serif' }} lang="zh-CN">{l.title}</b>{l.vn && <span className="block text-sm text-[#6B6253] truncate">{l.vn}</span>}</span>
                  {d > 0 && <span className="text-xs font-bold text-[#2F6E5A] shrink-0">{d} ải</span>}
                </Link>
              </li>
            );
          })}
        </ol>
      </main>
    </div>
  );
}
