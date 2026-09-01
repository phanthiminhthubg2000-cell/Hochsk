"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { localArrangements } from "../data";

export default function ArrangePage() {
  const [loading, setLoading] = useState(true);
  const [filterLevel, setFilterLevel] = useState("");
  const [arrangedSentences, setArrangedSentences] = useState([]);
  const [arrangeIndex, setArrangeIndex] = useState(0);
  const [availableChars, setAvailableChars] = useState([]);
  const [selectedChars, setSelectedChars] = useState([]);
  const [arrangeFeedback, setArrangeFeedback] = useState(null);

  const speak = (text) => {
    window.speechSynthesis.cancel(); 
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN"; utterance.rate = 0.8; 
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    const savedArr = JSON.parse(localStorage.getItem("hsk_arranged") || "[]");
    setArrangedSentences(savedArr);
    const normalizeLevel = (lvl) => lvl ? lvl.toString().trim().toUpperCase().replace(/HSK\s*(\d+)/, 'HSK $1') : "";
    const allLevels = [...new Set(localArrangements.map(a => normalizeLevel(a.level)).filter(Boolean))].sort((a, b) => (parseInt(a.replace(/[^\d]/g, '')) || 0) - (parseInt(b.replace(/[^\d]/g, '')) || 0));
    if (allLevels.length > 0) setFilterLevel(allLevels[0]);
    setLoading(false);
  }, []);

  const normalizeLevel = (lvl) => lvl ? lvl.toString().trim().toUpperCase().replace(/HSK\s*(\d+)/, 'HSK $1') : "";
  const arrangements = localArrangements.map(a => ({ ...a, level: normalizeLevel(a.level), is_arranged: arrangedSentences.includes(a.id) }));
  const filteredArrangements = arrangements.filter(arr => arr.level === filterLevel);
  const uniqueLevels = [...new Set(arrangements.map(a => a.level).filter(Boolean))];

  useEffect(() => {
    setArrangeIndex(0); setArrangeFeedback(null);
  }, [filterLevel]);

  useEffect(() => {
    if (filteredArrangements.length > 0) {
      const currentSent = filteredArrangements[arrangeIndex];
      const cleanChinese = currentSent.chinese.replace(/[.,!?。，！？]/g, '').trim();
      const charsArray = cleanChinese.split('');
      const shuffled = charsArray.map(value => ({ value, sort: Math.random() })).sort((a, b) => a.sort - b.sort).map(({ value }, index) => ({ id: index, char: value }));
      setAvailableChars(shuffled); setSelectedChars([]); setArrangeFeedback(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrangeIndex, filterLevel]);

  const handleSelectChar = (charObj) => { setAvailableChars(availableChars.filter(c => c.id !== charObj.id)); setSelectedChars([...selectedChars, charObj]); };
  const handleDeselectChar = (charObj) => { setSelectedChars(selectedChars.filter(c => c.id !== charObj.id)); setAvailableChars([...availableChars, charObj]); };

  const checkArrangement = () => {
    const currentSent = filteredArrangements[arrangeIndex];
    const cleanChinese = currentSent.chinese.replace(/[.,!?。，！？]/g, '').trim();
    const userString = selectedChars.map(c => c.char).join('');
    if (userString === cleanChinese) {
      setArrangeFeedback("correct");
      if (!currentSent.is_arranged) {
        const newSaved = [...arrangedSentences, currentSent.id];
        setArrangedSentences(newSaved); localStorage.setItem("hsk_arranged", JSON.stringify(newSaved));
      }
    } else { setArrangeFeedback("incorrect"); }
  };

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-slate-50">Đang tải...</main>;

  return (
    <main className="flex min-h-screen flex-col items-center py-10 bg-slate-50 px-4">
      <div className="w-full max-w-2xl flex justify-between items-center mb-8">
        <Link href="/"><button className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl shadow-sm hover:bg-slate-100 transition flex items-center gap-2"><span>←</span> Về Trang Chủ</button></Link>
        <h1 className="text-3xl font-extrabold text-orange-600">Sắp Xếp Câu</h1>
      </div>
      
      <div className="w-full max-w-2xl bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8 flex items-center gap-3">
        <span className="font-bold text-slate-600">Cấp độ:</span>
        <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)} className="border border-slate-300 bg-slate-50 text-slate-800 rounded-lg px-4 py-2 outline-none font-bold cursor-pointer">
          {uniqueLevels.map(lvl => <option key={lvl} value={lvl}>{lvl}</option>)}
        </select>
        <span className="ml-auto font-bold text-orange-500 text-sm bg-orange-50 px-3 py-1 rounded-full">Hoàn thành: {filteredArrangements.filter(c => c.is_arranged).length} / {filteredArrangements.length}</span>
      </div>

      <div className="flex flex-col items-center w-full max-w-2xl">
        {filteredArrangements.length === 0 ? <div className="bg-orange-50 text-orange-700 border border-orange-200 p-6 rounded-2xl w-full text-center"><h3 className="font-bold">Chưa có bài tập!</h3></div> : (
          <div className="w-full bg-white rounded-3xl shadow-xl p-8 relative overflow-hidden border">
            {filteredArrangements[arrangeIndex].is_arranged && <div className="absolute top-4 right-[-35px] bg-green-500 text-white font-bold text-xs py-1 px-10 rotate-45 shadow-sm">ĐÃ QUA</div>}
            <div className="mb-6 text-center">
              <p className="text-sm font-bold text-slate-400 mb-2 uppercase tracking-widest">Gợi ý nghĩa tiếng Việt</p>
              <h3 className="text-2xl font-bold text-slate-800 leading-normal">"{filteredArrangements[arrangeIndex].vietnamese}"</h3>
            </div>
            <div className="bg-slate-50 p-6 rounded-2xl border-2 border-slate-100">
              <div className="min-h-[80px] bg-white border-2 border-dashed border-orange-300 rounded-xl p-4 mb-6 flex flex-wrap gap-2 items-center justify-center">
                {selectedChars.length === 0 && <span className="text-slate-400 font-medium">Chạm vào ô bên dưới để xếp câu...</span>}
                {selectedChars.map((charObj) => (
                  <button key={charObj.id} onClick={() => handleDeselectChar(charObj)} className="px-4 py-3 bg-orange-500 text-white font-bold text-2xl rounded-lg shadow-md hover:bg-orange-600 active:scale-95 transition-transform">{charObj.char}</button>
                ))}
              </div>
              <div className="flex flex-wrap justify-center gap-3 mb-8 min-h-[60px]">
                {availableChars.map((charObj) => (
                  <button key={charObj.id} onClick={() => handleSelectChar(charObj)} className="px-4 py-3 bg-white border-2 border-slate-200 text-slate-700 font-bold text-2xl rounded-lg shadow-sm hover:border-orange-500 hover:text-orange-500 active:scale-95 transition-all">{charObj.char}</button>
                ))}
              </div>
              <div className="flex flex-col gap-4">
                {!arrangeFeedback && availableChars.length === 0 && <button onClick={checkArrangement} className="w-full py-4 bg-orange-600 text-white font-bold rounded-xl text-lg animate-bounce shadow-md">Kiểm Tra</button>}
                {arrangeFeedback && (
                  <div className={`p-4 flex items-center justify-between rounded-xl border font-bold text-lg ${arrangeFeedback === 'correct' ? 'bg-green-100 text-green-800 border-green-300' : 'bg-red-100 text-red-800 border-red-300'}`}>
                    <span>{arrangeFeedback === 'correct' ? '🎉 Chính xác hoàn toàn!' : '❌ Sai thứ tự rồi, hãy thử lại!'}</span>
                    {arrangeFeedback === 'correct' && (
                       <button onClick={() => speak(filteredArrangements[arrangeIndex].chinese)} className="w-10 h-10 flex items-center justify-center bg-white text-green-600 rounded-full shadow-sm text-xl">🔊</button>
                    )}
                  </div>
                )}
                <div className="flex justify-between mt-2">
                  <button onClick={() => setArrangeIndex(arrangeIndex - 1)} disabled={arrangeIndex === 0} className="px-6 py-3 bg-white border rounded-xl font-bold disabled:opacity-30">Câu Trước</button>
                  {arrangeFeedback === 'incorrect' ? (
                     <button onClick={() => { setArrangeFeedback(null); setAvailableChars([...availableChars, ...selectedChars].sort((a,b) => Math.random() - 0.5)); setSelectedChars([]); }} className="px-6 py-3 bg-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-300">Làm lại</button>
                  ) : (
                     <button onClick={() => setArrangeIndex(arrangeIndex + 1)} disabled={arrangeIndex === filteredArrangements.length - 1} className="px-8 py-3 bg-orange-600 text-white rounded-xl font-bold shadow-md disabled:opacity-50">Câu Tiếp ➔</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}