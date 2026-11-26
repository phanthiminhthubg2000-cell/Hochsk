"use client";
// TRANG GIÁO VIÊN · GIÁO TRÌNH — cô chọn file PDF giáo trình trên máy; trình duyệt chuyển từng trang thành ảnh
// rồi lưu lên web (Firestore) để học viên mở tab Giáo trình đọc như lật sách thật. Có thể dừng giữa chừng và tải tiếp.
import { useEffect, useRef, useState } from "react";
import { collection, doc, getDocs, setDoc, serverTimestamp } from "firebase/firestore";
import { BOOK_COL, PAGE_COL, pageId, CATALOG, loadPdfjs, renderPage } from "@/lib/books";

const btn = "rounded-xl font-bold text-sm transition-all disabled:opacity-50";

export default function BookManager({ db }) {
  const [books, setBooks] = useState({});
  const [job, setJob] = useState(null); // { id, n, total, msg }
  const stop = useRef(false);
  const fileFor = useRef(null);
  const load = async () => { const s = await getDocs(collection(db, BOOK_COL)).catch(() => null); const m = {}; s?.forEach((d) => (m[d.id] = d.data())); setBooks(m); };
  useEffect(() => { load(); }, []); // eslint-disable-line

  const upload = async (meta, file) => {
    if (!file) return;
    stop.current = false;
    setJob({ id: meta.id, n: 0, total: 0, msg: "Đang mở PDF…" });
    try {
      const pdfjs = await loadPdfjs();
      const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
      const total = pdf.numPages;
      const old = books[meta.id];
      let start = old && old.pages === total && old.file === file.name ? (old.done || 0) + 1 : 1; // tải tiếp nếu cùng file
      // bìa + tỉ lệ trang
      const first = await renderPage(pdf, 1, 1100);
      const t = document.createElement("canvas"); t.width = 320; t.height = Math.round(320 * first.ratio);
      t.getContext("2d").drawImage(first.c, 0, 0, t.width, t.height);
      const cover = t.toDataURL("image/jpeg", 0.7);
      const base = { id: meta.id, zh: meta.zh, vi: meta.vi, group: meta.group, lv: meta.lv, wb: !!meta.wb, file: file.name, pages: total, ratio: first.ratio, cover, hidden: false, updatedAt: serverTimestamp() };
      await setDoc(doc(db, BOOK_COL, meta.id), { ...base, done: start - 1 }, { merge: true });
      if (start === 1) { await setDoc(doc(db, PAGE_COL, pageId(meta.id, 1)), { book: meta.id, n: 1, img: first.img }); start = 2; }
      for (let n = start; n <= total; n += 2) {
        if (stop.current) throw new Error("Đã dừng — bấm chọn lại đúng file này để tải tiếp.");
        const ns = [n, n + 1].filter((x) => x <= total);
        const imgs = await Promise.all(ns.map((x) => renderPage(pdf, x, 1100)));
        await Promise.all(ns.map((x, i) => setDoc(doc(db, PAGE_COL, pageId(meta.id, x)), { book: meta.id, n: x, img: imgs[i].img })));
        const done = ns[ns.length - 1];
        setJob({ id: meta.id, n: done, total, msg: "" });
        if (done % 10 === 0 || done === total) await setDoc(doc(db, BOOK_COL, meta.id), { done }, { merge: true });
      }
      await setDoc(doc(db, BOOK_COL, meta.id), { done: total, updatedAt: serverTimestamp() }, { merge: true });
      setJob({ id: meta.id, n: total, total, msg: "✅ Xong" });
    } catch (e) {
      setJob((j) => ({ ...(j || { id: meta.id }), msg: "⚠️ " + (e.message || e) + (String(e.message || e).includes("permission") ? " — cần thêm books và book_pages vào quy tắc Firestore." : "") }));
    }
    load();
  };
  const toggleHide = async (id, hidden) => { await setDoc(doc(db, BOOK_COL, id), { hidden }, { merge: true }); load(); };
  const busy = job && !job.msg;

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5">
        <h2 className="text-xl font-black text-[#142033]">📚 Giáo trình</h2>
        <p className="text-sm text-slate-500 mt-1">Tải file PDF giáo trình từ Drive về máy trước, rồi bấm <b>Chọn PDF</b> ở đúng cuốn. Trình duyệt sẽ chuyển từng trang thành ảnh và đưa lên web (sách 250 trang mất khoảng 5–10 phút — giữ tab này mở). Đang tải dở mà tắt thì chọn lại đúng file đó để tải tiếp. Học viên đọc ở tab <b>Giáo trình</b> (書) như lật sách thật; chỉ tài khoản đã đăng nhập mới xem được.</p>
      </div>
      <input ref={fileFor} type="file" accept="application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; const meta = fileFor.current?._meta; e.target.value = ""; if (f && meta) upload(meta, f); }} />
      {CATALOG.map((g) => (
        <div key={g.group} className="rounded-2xl border border-[#E2E8F0] bg-white p-4">
          <h3 className="font-black text-[#142033] mb-2">{g.group}</h3>
          <div className="grid gap-2">
            {g.items.map((m) => {
              const b = books[m.id]; const j = job?.id === m.id ? job : null;
              const full = b && b.done >= b.pages;
              return (
                <div key={m.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-2.5">
                  <div className="w-10 h-14 rounded bg-slate-100 overflow-hidden shrink-0">{b?.cover && <img src={b.cover} alt="" className="w-full h-full object-cover" />}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm" style={{ fontFamily: '"Noto Sans SC",sans-serif' }}>{m.zh}{m.wb ? <span className="ml-1 text-[11px] font-normal text-slate-500">(sách bài tập)</span> : null}</div>
                    <div className="text-xs text-slate-500 truncate">{m.vi}{b?.file ? ` · ${b.file}` : ""}</div>
                    {j ? (
                      <div className="mt-1">
                        {j.total > 0 && <div className="h-1.5 rounded bg-slate-100 overflow-hidden"><div className="h-full bg-[#10B981]" style={{ width: `${(j.n / j.total) * 100}%` }} /></div>}
                        <div className="text-xs mt-0.5">{j.msg || `Đang chuyển trang ${j.n}/${j.total}…`}</div>
                      </div>
                    ) : b ? (
                      <div className={`text-xs mt-0.5 font-bold ${full ? "text-emerald-600" : "text-amber-600"}`}>{full ? `✓ Đã lên web · ${b.pages} trang` : `Tải dở ${b.done}/${b.pages} trang — chọn lại file để tải tiếp`}{b.hidden ? " · đang ẩn" : ""}</div>
                    ) : <div className="text-xs mt-0.5 text-slate-400">Chưa có</div>}
                  </div>
                  {busy && j ? (
                    <button onClick={() => (stop.current = true)} className={`${btn} px-3 py-2 bg-white border border-slate-300`}>Dừng</button>
                  ) : (
                    <div className="flex flex-col gap-1 items-end">
                      <button disabled={!!busy} onClick={() => { fileFor.current._meta = { ...m, group: g.group }; fileFor.current.click(); }} className={`${btn} px-3 py-2 bg-[#142033] text-white`}>{b ? (full ? "Thay PDF" : "Tải tiếp") : "Chọn PDF"}</button>
                      {b && <button onClick={() => toggleHide(m.id, !b.hidden)} className="text-[11px] underline text-slate-500">{b.hidden ? "Hiện với học viên" : "Ẩn với học viên"}</button>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
