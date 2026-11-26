"use client";
// GIÁO TRÌNH — tủ sách HSK 3.0 / 2.0; mở sách đọc như lật trang thật (StPageFlip), ảnh trang tải dần theo trang đang đọc.
import { useCallback, useEffect, useRef, useState } from "react";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "../../firebase";
import GardenNav from "../GardenNav";
import { useTuVi } from "../useTuVi";
import { BOOK_COL, PAGE_COL, pageId, CATALOG } from "@/lib/books";
import "page-flip/src/Style/stPageFlip.css";

const zh = { fontFamily: '"Noto Serif SC","Noto Sans SC",serif' };
const lastKey = (id) => "book_last_" + id;

export default function GiaoTrinh() {
  const { isSignedIn, loaded } = useTuVi();
  const [books, setBooks] = useState(null);
  const [open, setOpen] = useState(null);
  useEffect(() => { getDocs(collection(db, BOOK_COL)).then((s) => { const m = {}; s.forEach((d) => { const b = d.data(); if (!b.hidden && b.done > 0) m[d.id] = { ...b, id: d.id }; }); setBooks(m); }).catch(() => setBooks({})); }, []);
  useEffect(() => { const q = new URLSearchParams(location.search).get("b"); if (q && books?.[q]) setOpen(books[q]); }, [books]);

  return (
    <div className="min-h-screen bg-[#EFE7D6] text-[#1C1A17]" style={{ fontFamily: '"Be Vietnam Pro","Noto Sans SC",system-ui,sans-serif' }}>
      <GardenNav active="books" title="Giáo trình" />
      <main className="max-w-[1280px] mx-auto px-3 md:px-6 pt-5 pb-28 md:pb-14">
        {open ? <Reader book={open} onClose={() => { setOpen(null); try { history.replaceState(null, "", "/giao-trinh"); } catch {} }} /> : (
          <>
            <header className="mb-5">
              <div className="text-[12px] tracking-[0.2em] font-bold text-[#8C7550] uppercase">书阁 · Tàng thư</div>
              <h1 className="font-serif-vn text-[28px] md:text-[34px] font-extrabold">Giáo trình</h1>
              <p className="text-[14px] text-[#6B6253]">Bấm vào một cuốn để mở — vuốt hoặc bấm mép trang để lật. Tài liệu chỉ dùng cho học viên của lớp.</p>
            </header>
            {loaded && !isSignedIn ? <p className="rounded-[8px] bg-white border border-[#D8CBAE] p-4">Đăng nhập để xem giáo trình.</p>
              : !books ? <p className="text-[#6B6253]">Đang tải tủ sách…</p>
              : CATALOG.map((g) => { const list = g.items.filter((b) => books[b.id]); return list.length ? (
                <section key={g.group} className="mb-8">
                  <h2 className="font-serif-vn text-[20px] font-bold mb-3 border-b-2 border-[#1C1A17] pb-1">{g.group}</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {list.map((m) => { const b = books[m.id]; return (
                      <button key={m.id} onClick={() => { setOpen(b); try { history.replaceState(null, "", "/giao-trinh?b=" + m.id); } catch {} }} className="group text-left">
                        <div className="relative rounded-[3px_8px_8px_3px] overflow-hidden shadow-[4px_6px_14px_rgba(0,0,0,.25)] border border-[#D8CBAE] bg-white transition-transform group-hover:-translate-y-1" style={{ aspectRatio: `1 / ${b.ratio || 1.4}` }}>
                          {b.cover && <img src={b.cover} alt={m.zh} className="w-full h-full object-cover" />}
                          <span className="absolute inset-y-0 left-0 w-2 bg-gradient-to-r from-black/25 to-transparent" aria-hidden="true" />
                        </div>
                        <div className="mt-2 font-bold text-[14px] leading-tight" style={zh}>{m.zh}</div>
                        <div className="text-[12px] text-[#6B6253]">{m.vi} · {b.done < b.pages ? `${b.done}/${b.pages}` : b.pages} trang</div>
                      </button>
                    ); })}
                  </div>
                </section>
              ) : null; })}
            {books && !Object.keys(books).length && <p className="text-[#6B6253]">Chưa có giáo trình nào được tải lên.</p>}
          </>
        )}
      </main>
    </div>
  );
}

function Reader({ book, onClose }) {
  const host = useRef(null), pf = useRef(null), styleEl = useRef(null), cache = useRef(new Map());
  const [cur, setCur] = useState(0); const [jump, setJump] = useState(""); const [zoom, setZoom] = useState(null);
  const total = book.done || book.pages;
  const start = (() => { try { return Math.min(total - 1, Math.max(0, +localStorage.getItem(lastKey(book.id)) || 0)); } catch { return 0; } })();

  // ảnh trang đặt bằng CSS theo lớp .pg-n để cả bản sao (chế độ dọc) cũng nhận ảnh
  const ensure = useCallback(async (from, to) => {
    const need = []; for (let n = Math.max(1, from); n <= Math.min(total, to); n++) if (!cache.current.has(n)) { cache.current.set(n, null); need.push(n); }
    await Promise.all(need.map(async (n) => {
      const s = await getDoc(doc(db, PAGE_COL, pageId(book.id, n))).catch(() => null);
      const img = s?.data()?.img; if (!img) return;
      cache.current.set(n, img);
      styleEl.current?.sheet?.insertRule(`.pg-${n}{background-image:url("${img}")}`, 0);
    }));
  }, [book.id, total]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { PageFlip } = await import("page-flip");
      if (!alive || !host.current) return;
      const el = host.current; el.innerHTML = "";
      const pages = []; for (let n = 1; n <= total; n++) { const d = document.createElement("div"); d.className = `bk-page pg-${n}`; d.dataset.density = n === 1 || n === total ? "hard" : "soft"; d.innerHTML = `<span class="bk-no">${n}</span>`; el.appendChild(d); pages.push(d); }
      const R = book.ratio || 1.4, W = 560, H = Math.round(W * R);
      const fitW = Math.max(260, Math.min(620, Math.floor((window.innerHeight - 190) / R))); // cả trang vừa màn hình
      const f = new PageFlip(el, { width: W, height: H, size: "stretch", minWidth: 260, maxWidth: fitW, minHeight: Math.round(260 * R), maxHeight: Math.round(fitW * R), showCover: true, usePortrait: true, mobileScrollSupport: true, maxShadowOpacity: 0.45, flippingTime: 700, startPage: start, drawShadow: true });
      f.on("flip", (e) => { const p = e.data; setCur(p); try { localStorage.setItem(lastKey(book.id), String(p)); } catch {} ensure(p - 2, p + 6); });
      f.loadFromHTML(pages);
      pf.current = f; setCur(start); ensure(start - 2, start + 6);
    })();
    return () => { alive = false; try { pf.current?.destroy(); } catch {} pf.current = null; };
  }, [book.id]); // eslint-disable-line

  useEffect(() => {
    const k = (e) => { if (zoom) { if (e.key === "Escape") setZoom(null); return; } if (e.key === "ArrowRight") pf.current?.flipNext(); if (e.key === "ArrowLeft") pf.current?.flipPrev(); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [zoom]);

  const go = (n) => { const p = Math.min(total, Math.max(1, n)) - 1; ensure(p - 2, p + 6); pf.current?.turnToPage(p); setCur(p); try { localStorage.setItem(lastKey(book.id), String(p)); } catch {} };
  const openZoom = () => { const n = cur + 1; ensure(n, n).then(() => setZoom(n)); };

  return (
    <div>
      <style ref={styleEl}>{`.bk-page{background-color:#fff;background-position:center;background-size:100% 100%;background-repeat:no-repeat;box-shadow:inset 0 0 0 1px #E4D9C3}.bk-page .bk-no{position:absolute;bottom:6px;right:10px;font-size:11px;color:#B8AD98}.bk-page.--left .bk-no{left:10px;right:auto}`}</style>
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <button onClick={onClose} className="h-9 px-3 rounded-[6px] border border-[#D8CBAE] bg-white text-[14px] font-bold">‹ Tủ sách</button>
        <b className="text-[16px]" style={zh}>{book.zh}</b>
        <span className="text-[13px] text-[#6B6253]">Trang {cur + 1}/{total}</span>
        <form onSubmit={(e) => { e.preventDefault(); go(+jump); setJump(""); }} className="flex items-center gap-1 ml-auto">
          <input value={jump} onChange={(e) => setJump(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="Trang" aria-label="Đến trang" className="w-16 h-9 px-2 rounded-[6px] border border-[#D8CBAE] bg-white text-[14px]" />
          <button className="h-9 px-3 rounded-[6px] bg-[#1C1A17] text-[#F3EEE2] text-[13px] font-bold">Đến</button>
        </form>
        <button onClick={openZoom} className="h-9 px-3 rounded-[6px] border border-[#D8CBAE] bg-white text-[13px] font-bold">🔍 Phóng to</button>
      </div>
      <div className="relative mx-auto" style={{ maxWidth: 1800 }}>
        <div ref={host} className="mx-auto" />
      </div>
      <div className="flex items-center justify-center gap-3 mt-4">
        <button onClick={() => pf.current?.flipPrev()} className="h-11 w-24 rounded-[8px] border border-[#D8CBAE] bg-white font-bold">‹ Trước</button>
        <input type="range" min={1} max={total} value={cur + 1} onChange={(e) => go(+e.target.value)} className="w-40 md:w-80" aria-label="Thanh trang" />
        <button onClick={() => pf.current?.flipNext()} className="h-11 w-24 rounded-[8px] bg-[#1C1A17] text-[#F3EEE2] font-bold">Sau ›</button>
      </div>
      {zoom && (
        <div className="fixed inset-0 z-50 bg-black/85 overflow-auto" onClick={() => setZoom(null)} role="dialog" aria-label="Trang phóng to">
          <div className="sticky top-0 flex items-center justify-between gap-2 p-2 bg-black/60 text-white text-[14px]" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => { const n = Math.max(1, zoom - 1); ensure(n, n).then(() => setZoom(n)); }} className="px-3 py-1.5 rounded bg-white/15">‹</button>
            <span>Trang {zoom}/{total}</span>
            <button onClick={() => { const n = Math.min(total, zoom + 1); ensure(n, n).then(() => setZoom(n)); }} className="px-3 py-1.5 rounded bg-white/15">›</button>
            <button onClick={() => setZoom(null)} className="px-3 py-1.5 rounded bg-white/15">✕ Đóng</button>
          </div>
          {cache.current.get(zoom) ? <img src={cache.current.get(zoom)} alt={`Trang ${zoom}`} className="block mx-auto max-w-none w-[min(1400px,180vw)] md:w-[min(1400px,100vw)]" onClick={(e) => e.stopPropagation()} /> : <p className="text-white text-center mt-10">Đang tải…</p>}
        </div>
      )}
    </div>
  );
}
