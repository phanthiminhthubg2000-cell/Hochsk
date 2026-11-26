"use client";
// HỌC VIÊN · BÀI CHỮA ĐỀ — các đề cô đã soạn phần chữa và bấm "Gửi cho học viên". Mở ra xem từng câu như trên lớp:
// đáp án, căn cứ, bẫy, kiến thức, từ vựng; nếu bạn đã làm đề này trên web thì hiện luôn đáp án bạn đã chọn.
import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "../../firebase";
import GardenNav from "../GardenNav";
import { useTuVi } from "../useTuVi";
import { GD_COL, buildItems, isRight, subAnswers } from "@/lib/giangde";
import { Present } from "../teacher/GiangDe";

const ms = (t) => (t?.toMillis ? t.toMillis() : t?.seconds ? t.seconds * 1000 : 0);

export default function GiangDePage() {
  const { userId } = useTuVi();
  const [list, setList] = useState(null);
  const [key, setKey] = useState("");
  const [view, setView] = useState(null); // { paper, lesson, built }
  const [mine, setMine] = useState(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(false); // false | "all" | "wrong"

  useEffect(() => {
    try { const p = new URLSearchParams(location.search).get("p"); if (p) setKey(p); } catch (_) {}
    getDocs(query(collection(db, GD_COL), where("published", "==", true)))
      .then((s) => { const a = []; s.forEach((d) => a.push({ id: d.id, ...d.data() })); setList(a.sort((x, y) => ms(y.publishedAt || y.updatedAt) - ms(x.publishedAt || x.updatedAt))); })
      .catch(() => setList([]));
  }, []);

  useEffect(() => {
    if (!key) { setView(null); setMine(null); return; }
    setErr(""); setView(null); setMine(null);
    (async () => {
      try {
        const s = await getDoc(doc(db, GD_COL, key));
        const lesson = s.exists() ? s.data() : null;
        if (!lesson?.published) { setErr("Cô chưa gửi bài chữa của đề này."); return; }
        const [dir, id] = key.split("__");
        const ps = await fetch(`/${dir}/papers.json`).then((r) => r.json());
        const meta = ps.find((x) => x.id === id);
        if (!meta) { setErr("Không tìm thấy đề."); return; }
        const paper = await fetch(`/${dir}/${meta.file}`).then((r) => r.json());
        paper.name = paper.name || meta.name;
        setView({ paper, lesson, built: buildItems(paper), dir, id });
      } catch (e) { setErr("Không tải được bài chữa."); }
    })();
  }, [key]);

  // bài làm gần nhất của chính mình cho đề này
  useEffect(() => {
    if (!view || !userId) return;
    getDocs(query(collection(db, "hsk3_submissions"), where("userId", "==", userId))).then((s) => {
      let best = null;
      s.forEach((d) => { const h = d.data(); if (h.examId === `${view.dir}/${view.id}` && (!best || ms(h.submittedAt) > ms(best.submittedAt))) best = h; });
      if (best) { const a = subAnswers(best); if (Object.keys(a).length) setMine(a); }
    }).catch(() => {});
  }, [view, userId]);

  const score = useMemo(() => {
    if (!view || !mine) return null;
    const its = view.built.items.filter((x) => x.type !== "w");
    const ok = its.filter((x) => isRight(x, mine[x.n])).length;
    return { ok, total: its.length, wrong: its.filter((x) => isRight(x, mine[x.n]) === false).map((x) => x.n) };
  }, [view, mine]);
  const go = (k) => { setKey(k); try { history.replaceState(null, "", k ? `/giang-de?p=${k}` : "/giang-de"); } catch (_) {} };

  return (
    <div className="min-h-screen bg-[#EFE7D6] text-[#1C1A17]" style={{ fontFamily: '"Be Vietnam Pro","Noto Sans SC",system-ui,sans-serif' }}>
      <GardenNav active="practice" title="Bài chữa đề" />
      <main className="max-w-[900px] mx-auto px-3 md:px-6 pt-5 pb-28 md:pb-14">
        <header className="mb-4">
          <div className="text-[12px] tracking-[0.2em] font-bold text-[#8C7550] uppercase">讲题 · Giảng đề</div>
          <h1 className="font-serif-vn text-[28px] md:text-[34px] font-extrabold">Bài chữa đề của cô</h1>
          <p className="text-[14px] text-[#6B6253]">Xem lại từng câu như trên lớp: đáp án, căn cứ trong bài, bẫy ở các phương án sai, kiến thức và từ vựng cần nhớ. Nếu bạn đã làm đề trên web, câu bạn chọn sai sẽ được tô đỏ.</p>
        </header>

        {key && (
          <div className="rounded-2xl bg-white border border-[#D9CDB4] p-4 mb-4 grid gap-2">
            {err ? <p className="text-[#9E2F22]">{err}</p> : !view ? <p className="text-[#6B6253]">Đang tải…</p> : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <b className="text-lg">HSK {view.paper.level} · {view.paper.name}</b>
                  <span className="ml-auto flex flex-wrap gap-2">
                    {score?.wrong.length > 0 && <button onClick={() => setOpen("wrong")} className="h-10 px-4 rounded-[6px] border-2 border-[#9E2F22] text-[#9E2F22] font-bold">Chỉ xem câu mình sai ({score.wrong.length})</button>}
                    <button onClick={() => setOpen("all")} className="h-10 px-4 rounded-[6px] bg-[#9E2F22] text-white font-bold">▶ Xem bài chữa</button>
                  </span>
                </div>
                {score ? <p className="text-sm">Bài làm của bạn: đúng <b>{score.ok}/{score.total}</b> câu tự chấm{score.wrong.length ? <> · câu sai: <span className="text-[#9E2F22] font-bold">{score.wrong.join(", ")}</span></> : ""}.</p>
                  : <p className="text-sm text-[#6B6253]">Bạn chưa làm đề này trên web (hoặc chưa đăng nhập), nên chỉ xem đáp án và phân tích.</p>}
              </>
            )}
            <button onClick={() => go("")} className="text-sm text-[#6B6253] underline justify-self-start">← Tất cả bài chữa</button>
          </div>
        )}

        {!key && (list === null ? <p className="text-[#6B6253]">Đang tải…</p> : !list.length ? <p className="text-[#6B6253]">Cô chưa gửi bài chữa đề nào.</p> : (
          <div className="grid gap-2">
            {list.map((x) => (
              <button key={x.id} onClick={() => go(x.id)} className="text-left rounded-2xl bg-white border border-[#D9CDB4] hover:border-[#9E2F22] p-4 flex items-center gap-3">
                <span className="shrink-0 w-12 h-12 rounded-xl bg-[#1C1A17] text-[#F2D58C] grid place-items-center font-black">H{x.level || "?"}</span>
                <span className="min-w-0"><b className="block truncate">{x.name || x.paperId}</b><span className="text-xs text-[#6B6253]">{x.dir === "hsk2-exam" ? "HSK 2.0" : "HSK 3.0"}{ms(x.publishedAt) ? ` · gửi ${new Date(ms(x.publishedAt)).toLocaleDateString("vi-VN")}` : ""}</span></span>
                <span className="ml-auto text-[#9E2F22] font-bold">Xem →</span>
              </button>
            ))}
          </div>
        ))}
      </main>
      {open && view && <Present student paper={view.paper} units={view.built.units} items={view.built.items} lesson={view.lesson} mine={mine} only={open === "wrong" && score?.wrong.length ? new Set(score.wrong) : null} startN={null} onClose={() => setOpen(false)} />}
    </div>
  );
}
