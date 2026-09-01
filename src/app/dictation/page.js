"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { localSentences } from "../data";

export default function DictationPage() {
  const [loading, setLoading] = useState(true);
  const [filterLevel, setFilterLevel] = useState("");
  const [dictatedSentences, setDictatedSentences] = useState([]);
  const [dictationIndex, setDictationIndex] = useState(0);
  const [dictationInput, setDictationInput] = useState("");
  const [dictationFeedback, setDictationFeedback] = useState(null);
  const [showDictationAnswer, setShowDictationAnswer] = useState(false);

  const speak = (text) => {
    window.speechSynthesis.cancel(); 
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN"; 
    utterance.rate = 0.8; 
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    const savedDict = JSON.parse(localStorage.getItem("hsk_dictated") || "[]");
    setDictatedSentences(savedDict);
    const normalizeLevel = (lvl) => lvl ? lvl.toString().trim().toUpperCase().replace(/HSK\s*(\d+)/, 'HSK $1') : "";
    const allLevels = [...new Set(localSentences.map(s => normalizeLevel(s.level)).filter(Boolean))].sort((a, b) => (parseInt(a.replace(/[^\d]/g, '')) || 0) - (parseInt(b.replace(/[^\d]/g, '')) || 0));
    if (allLevels.length > 0) setFilterLevel(allLevels[0]);
    setLoading(false);
  }, []);

  useEffect(() => {
    setDictationIndex(0); setDictationInput(""); setDictationFeedback(null); setShowDictationAnswer(false);
  }, [filterLevel]);

  const normalizeLevel = (lvl) => lvl ? lvl.toString().trim().toUpperCase().replace(/HSK\s*(\d+)/, 'HSK $1') : "";
  const sentences = localSentences.map(s => ({ ...s, level: normalizeLevel(s.level), is_dictated: dictatedSentences.includes(s.id) }));
  const filteredSentences = sentences.filter(sent => sent.level === filterLevel);
  const uniqueLevels = [...new Set(sentences.map(s => s.level).filter(Boolean))];

  const handleDictationSubmit = (e) => {
    e.preventDefault();
    if (!dictationInput.trim() || filteredSentences.length === 0) return;
    const currentSent = filteredSentences[dictationIndex];
    const cleanTarget = currentSent.chinese.replace(/[.,!?。，！？\s]/g, '').trim();
    const cleanInput = dictationInput.replace(/[.,!?。，！？\s]/g, '').trim();
    if (cleanInput === cleanTarget) {
      setDictationFeedback("correct"); setShowDictationAnswer(true);
      if (!currentSent.is_dictated) {
        const newSaved = [...dictatedSentences, currentSent.id];
        setDictatedSentences(newSaved); localStorage.setItem("hsk_dictated", JSON.stringify(newSaved));
      }
    } else { setDictationFeedback("incorrect"); }
  };

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-slate-50">Đang tải...</main>;

  return (
    <main className="flex min-h-screen flex-col items-center py-10 bg-slate-50 px-4">
      <div className="w-full max-w-2xl flex justify-between items-center mb-8">
        <Link href="/">
          <button className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl shadow-sm hover:bg-slate-100 transition flex items-center gap-2"><span>←</span> Về Trang Chủ</button>
        </Link>
        <h1 className="text-3xl font-extrabold text-teal-600">Nghe Chép Chính Tả</h1>
      </div>

      <div className="w-full max-w-2xl bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8 flex items-center gap-3">
        <span className="font-bold text-slate-600">Cấp độ:</span>
        <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)} className="border border-slate-300 bg-slate-50 text-slate-800 rounded-lg px-4 py-2 outline-none font-bold cursor-pointer">
          {uniqueLevels.map(lvl => <option key={lvl} value={lvl}>{lvl}</option>)}
        </select>
        <span className="ml-auto font-bold text-teal-500 text-sm bg-teal-50 px-3 py-1 rounded-full">
           Hoàn thành: {filteredSentences.filter(c => c.is_dictated).length} / {filteredSentences.length}
        </span>
      </div>

      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-xl border p-8 text-center">
        {filteredSentences.length === 0 ? <div className="text-slate-500">Chưa có dữ liệu bài tập nghe.</div> : (
          <div className="relative">
            {filteredSentences[dictationIndex].is_dictated && <div className="absolute -top-4 -right-4 bg-teal-100 text-teal-700 text-xs px-3 py-1 rounded-full font-bold shadow-sm">ĐÃ NGHE ĐÚNG</div>}
            <p className="text-sm font-bold text-slate-400 mb-6 uppercase tracking-widest">Nghe và Gõ lại chữ Hán</p>
            <button onClick={() => speak(filteredSentences[dictationIndex].chinese)} className="w-24 h-24 mx-auto flex items-center justify-center bg-teal-50 text-teal-600 rounded-full hover:bg-teal-100 hover:scale-105 transition-all shadow-md text-5xl mb-8 animate-pulse">🔊</button>
            {!showDictationAnswer ? (
              <form onSubmit={handleDictationSubmit} className="flex flex-col gap-4">
                <input type="text" placeholder="Gõ chính xác những gì bạn nghe được..." value={dictationInput} onChange={(e) => setDictationInput(e.target.value)} className="w-full px-5 py-4 rounded-xl border-2 focus:border-teal-500 outline-none text-xl text-center" />
                <button type="submit" className="w-full bg-teal-600 text-white font-bold py-4 rounded-xl shadow-md hover:bg-teal-700 transition">Kiểm tra</button>
                <button type="button" onClick={() => setShowDictationAnswer(true)} className="text-sm text-slate-500 underline mt-2 hover:text-slate-800">Nghe không ra? Xem đáp án</button>
              </form>
            ) : (
              <div className="flex flex-col gap-4 text-left">
                {dictationFeedback && (
                  <div className={`p-4 rounded-xl border ${dictationFeedback === "correct" ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                    <h4 className="font-bold">{dictationFeedback === "correct" ? '🎉 Đôi tai vàng! Hoàn toàn chính xác.' : '❌ Chưa chính xác rồi.'}</h4>
                  </div>
                )}
                <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 text-center mt-2">
                  <p className="text-xs font-bold text-teal-500 uppercase mb-2">Đáp án gốc</p>
                  <h3 className="text-3xl font-bold text-slate-800 mb-2">{filteredSentences[dictationIndex].chinese}</h3>
                  <p className="text-lg text-slate-600">{filteredSentences[dictationIndex].vietnamese}</p>
                </div>
                <div className="flex justify-between mt-4">
                  <button onClick={() => {setDictationIndex(dictationIndex - 1); setShowDictationAnswer(false); setDictationInput(""); setDictationFeedback(null);}} disabled={dictationIndex === 0} className="px-6 py-3 bg-white border rounded-xl font-bold disabled:opacity-30">Câu Trước</button>
                  <button onClick={() => {setDictationIndex(dictationIndex + 1); setShowDictationAnswer(false); setDictationInput(""); setDictationFeedback(null);}} disabled={dictationIndex === filteredSentences.length - 1} className="px-8 py-3 bg-teal-600 text-white rounded-xl font-bold shadow-md disabled:opacity-50">Câu Tiếp</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}