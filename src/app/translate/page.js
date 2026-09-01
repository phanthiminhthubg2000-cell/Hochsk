"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { localSentences } from "../data";

export default function TranslatePage() {
  const [loading, setLoading] = useState(true);
  const [filterLevel, setFilterLevel] = useState("");
  const [translatedSentences, setTranslatedSentences] = useState([]);
  const [transIndex, setTransIndex] = useState(0);
  const [transInput, setTransInput] = useState("");
  const [isGrading, setIsGrading] = useState(false);
  const [aiFeedback, setAiFeedback] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);

  const speak = (text) => {
    window.speechSynthesis.cancel(); 
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN"; utterance.rate = 0.8; 
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    const savedTrans = JSON.parse(localStorage.getItem("hsk_translated") || "[]");
    setTranslatedSentences(savedTrans);
    const normalizeLevel = (lvl) => lvl ? lvl.toString().trim().toUpperCase().replace(/HSK\s*(\d+)/, 'HSK $1') : "";
    const allLevels = [...new Set(localSentences.map(s => normalizeLevel(s.level)).filter(Boolean))].sort((a, b) => (parseInt(a.replace(/[^\d]/g, '')) || 0) - (parseInt(b.replace(/[^\d]/g, '')) || 0));
    if (allLevels.length > 0) setFilterLevel(allLevels[0]);
    setLoading(false);
  }, []);

  useEffect(() => {
    setTransIndex(0); setTransInput(""); setAiFeedback(null); setShowAnswer(false);
  }, [filterLevel]);

  const normalizeLevel = (lvl) => lvl ? lvl.toString().trim().toUpperCase().replace(/HSK\s*(\d+)/, 'HSK $1') : "";
  const sentences = localSentences.map(s => ({ ...s, level: normalizeLevel(s.level), is_translated: translatedSentences.includes(s.id) }));
  const filteredSentences = sentences.filter(sent => sent.level === filterLevel);
  const uniqueLevels = [...new Set(sentences.map(s => s.level).filter(Boolean))];

  const handleTranslateSubmit = async (e) => {
    e.preventDefault();
    if (!transInput.trim() || filteredSentences.length === 0) return;
    setIsGrading(true);
    const currentTransCard = filteredSentences[transIndex];
    try {
      const res = await fetch('/api/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vietnamese: currentTransCard.vietnamese, userTranslation: transInput })
      });
      const data = await res.json();
      setAiFeedback(data); setShowAnswer(true);
      if (data.isCorrect && !currentTransCard.is_translated) {
        const newSaved = [...translatedSentences, currentTransCard.id];
        setTranslatedSentences(newSaved); localStorage.setItem("hsk_translated", JSON.stringify(newSaved));
      }
    } catch (error) { alert("Lỗi kết nối Giáo viên AI!"); } finally { setIsGrading(false); }
  };

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-slate-50">Đang tải...</main>;

  return (
    <main className="flex min-h-screen flex-col items-center py-10 bg-slate-50 px-4">
      <div className="w-full max-w-2xl flex justify-between items-center mb-8">
        <Link href="/"><button className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl shadow-sm hover:bg-slate-100 transition flex items-center gap-2"><span>←</span> Về Trang Chủ</button></Link>
        <h1 className="text-3xl font-extrabold text-indigo-600">Dịch Câu Cùng AI</h1>
      </div>

      <div className="w-full max-w-2xl bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8 flex items-center gap-3">
        <span className="font-bold text-slate-600">Cấp độ:</span>
        <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)} className="border border-slate-300 bg-slate-50 text-slate-800 rounded-lg px-4 py-2 outline-none font-bold cursor-pointer">
          {uniqueLevels.map(lvl => <option key={lvl} value={lvl}>{lvl}</option>)}
        </select>
        <span className="ml-auto font-bold text-indigo-500 text-sm bg-indigo-50 px-3 py-1 rounded-full">Đã dịch chuẩn: {filteredSentences.filter(c => c.is_translated).length} / {filteredSentences.length}</span>
      </div>

      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-xl p-8 border">
         {filteredSentences.length === 0 ? <div className="text-center text-slate-500">Chưa có dữ liệu bài tập dịch.</div> : (
           <>
             <div className="text-center mb-6">
                <p className="text-sm font-bold text-slate-400 mb-2 uppercase tracking-widest">Dịch sang tiếng Trung</p>
                <h3 className="text-3xl font-bold text-indigo-900 leading-normal">"{filteredSentences[transIndex]?.vietnamese}"</h3>
             </div>
             {!showAnswer ? (
                <form onSubmit={handleTranslateSubmit} className="flex flex-col gap-4">
                  <textarea rows="3" placeholder="Gõ bản dịch tiếng Trung của bạn..." value={transInput} onChange={(e) => setTransInput(e.target.value)} className="w-full px-5 py-4 rounded-xl border-2 focus:border-indigo-500 outline-none text-xl" />
                  <button type="submit" disabled={isGrading} className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl hover:bg-indigo-700 disabled:opacity-70 transition">
                    {isGrading ? "⏳ AI Đang chấm bài..." : "Nộp bài cho AI"}
                  </button>
                  <button type="button" onClick={() => setShowAnswer(true)} className="text-sm text-slate-500 underline mt-2 hover:text-slate-800">Bỏ cuộc? Xem đáp án</button>
                </form>
             ) : (
                <div className="flex flex-col gap-4">
                  {aiFeedback && (
                    <div className={`p-4 rounded-xl border ${aiFeedback.isCorrect ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                      <h4 className="font-bold">{aiFeedback.isCorrect ? '🎉 Chính xác!' : '❌ Sai rồi'}</h4>
                      <p>{aiFeedback.feedback}</p>
                    </div>
                  )}
                  <div className="bg-slate-50 p-4 rounded-xl flex justify-between items-center mt-2 border">
                    <div>
                      <p className="text-xs font-bold text-indigo-400 uppercase">Đáp án gốc</p>
                      <p className="text-2xl font-bold text-slate-800 mt-1">{filteredSentences[transIndex]?.chinese}</p>
                    </div>
                    <button onClick={() => speak(filteredSentences[transIndex]?.chinese)} className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full text-xl hover:bg-indigo-200">🔊</button>
                  </div>
                  <div className="flex justify-between mt-4">
                    <button onClick={() => {setTransIndex(transIndex - 1); setShowAnswer(false); setTransInput("")}} disabled={transIndex === 0} className="px-6 py-2 bg-white border rounded-xl disabled:opacity-30 font-bold">Trước</button>
                    <button onClick={() => {setTransIndex(transIndex + 1); setShowAnswer(false); setTransInput("")}} disabled={transIndex === filteredSentences.length - 1} className="px-6 py-2 bg-indigo-600 text-white rounded-xl disabled:opacity-50 font-bold">Tiếp</button>
                  </div>
                </div>
             )}
           </>
         )}
      </div>
    </main>
  );
}