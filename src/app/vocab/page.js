"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { db } from "../../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { localCards } from "../data";

export default function VocabPage() {
  const { userId } = useAuth(); // Lấy mã định danh học sinh đang đăng nhập
  const [loading, setLoading] = useState(true);
  const [filterLevel, setFilterLevel] = useState("");
  const [learnedCards, setLearnedCards] = useState([]);
  const [vocabIndex, setVocabIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const speak = (text, e) => {
    if (e) e.stopPropagation(); 
    window.speechSynthesis.cancel(); 
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN"; 
    utterance.rate = 0.8; 
    window.speechSynthesis.speak(utterance);
  };

  // Tải dữ liệu tiến độ từ Firebase (hoặc localStorage nếu chưa đăng nhập)
  useEffect(() => {
    async function loadProgress() {
      if (userId) {
        try {
          const docRef = doc(db, "progress", userId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const cloudData = docSnap.data().learnedVocab || [];
            setLearnedCards(cloudData);
            localStorage.setItem("hsk_learnedCards", JSON.stringify(cloudData));
          } else {
            const savedCards = JSON.parse(localStorage.getItem("hsk_learnedCards") || "[]");
            setLearnedCards(savedCards);
            if (savedCards.length > 0) {
              await setDoc(docRef, { learnedVocab: savedCards, updatedAt: new Date() }, { merge: true });
            }
          }
        } catch (e) {
          console.error("Lỗi tải dữ liệu đám mây:", e);
          const savedCards = JSON.parse(localStorage.getItem("hsk_learnedCards") || "[]");
          setLearnedCards(savedCards);
        }
      } else {
        const savedCards = JSON.parse(localStorage.getItem("hsk_learnedCards") || "[]");
        setLearnedCards(savedCards);
      }

      const normalizeLevel = (lvl) => lvl ? lvl.toString().trim().toUpperCase().replace(/HSK\s*(\d+)/, 'HSK $1') : "";
      const allLevels = [...new Set(localCards.map(c => normalizeLevel(c.level)).filter(Boolean))].sort((a, b) => {
          return (parseInt(a.replace(/[^\d]/g, '')) || 0) - (parseInt(b.replace(/[^\d]/g, '')) || 0);
      });
      if (allLevels.length > 0) setFilterLevel(allLevels[0]);
      setLoading(false);
    }
    loadProgress();
  }, [userId]);

  useEffect(() => {
    setVocabIndex(0);
    setIsFlipped(false);
  }, [filterLevel]);

  const normalizeLevel = (lvl) => lvl ? lvl.toString().trim().toUpperCase().replace(/HSK\s*(\d+)/, 'HSK $1') : "";
  const vocabularies = localCards.map(c => ({ ...c, level: normalizeLevel(c.level), is_learned: learnedCards.includes(c.id) }));
  const filteredCards = vocabularies.filter(card => card.level === filterLevel);

  // Lưu trạng thái học tập lên Firebase khi bấm nút
  const toggleLearnedStatus = async () => {
    if (filteredCards.length === 0) return;
    const cardId = filteredCards[vocabIndex].id;
    let newSaved;
    if (learnedCards.includes(cardId)) { 
      newSaved = learnedCards.filter(id => id !== cardId); 
    } else { 
      newSaved = [...learnedCards, cardId]; 
    }
    
    setLearnedCards(newSaved); 
    localStorage.setItem("hsk_learnedCards", JSON.stringify(newSaved)); 

    // Đồng bộ lên Firestore Database ngay lập tức
    if (userId) {
      try {
        const docRef = doc(db, "progress", userId);
        await setDoc(docRef, { learnedVocab: newSaved, updatedAt: new Date() }, { merge: true });
      } catch (e) {
        console.error("Lỗi đồng bộ lên đám mây:", e);
      }
    }
  };

  const uniqueLevels = [...new Set(vocabularies.map(c => c.level).filter(Boolean))];

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-slate-50"><h1 className="text-xl font-bold animate-pulse text-blue-500">Đang tải dữ liệu học tập...</h1></main>;

  return (
    <main className="flex min-h-screen flex-col items-center py-10 bg-slate-50 px-4">
      <div className="w-full max-w-2xl flex justify-between items-center mb-8">
        <Link href="/">
          <button className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl shadow-sm hover:bg-slate-100 transition flex items-center gap-2">
            <span>←</span> Về Trang Chủ
          </button>
        </Link>
        <h1 className="text-3xl font-extrabold text-blue-600">Từ Vựng HSK</h1>
      </div>

      <div className="w-full max-w-2xl bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8 flex items-center gap-3">
        <span className="font-bold text-slate-600">Cấp độ:</span>
        <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)} className="border border-slate-300 bg-slate-50 text-slate-800 rounded-lg px-4 py-2 outline-none font-bold cursor-pointer">
          {uniqueLevels.map(lvl => <option key={lvl} value={lvl}>{lvl}</option>)}
        </select>
        <span className="ml-auto font-bold text-blue-500 text-sm bg-blue-50 px-3 py-1 rounded-full">
           Đã thuộc: {filteredCards.filter(c => c.is_learned).length} / {filteredCards.length}
        </span>
      </div>

      <div className="flex flex-col items-center w-full max-w-2xl">
        {filteredCards.length === 0 ? <div className="bg-white border border-slate-200 text-slate-500 p-8 rounded-2xl text-center w-full">Chưa có từ vựng.</div> : (
          <>
            <div className="w-80 h-[420px] [perspective:1000px] cursor-pointer" onClick={() => setIsFlipped(!isFlipped)}>
              <div className={`relative w-full h-full transition-transform duration-700 [transform-style:preserve-3d] ${isFlipped ? "[transform:rotateY(180deg)]" : ""}`}>
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white rounded-3xl shadow-xl border-2 p-6 [backface-visibility:hidden]">
                  <h2 className="text-7xl font-bold text-slate-800 mb-4">{filteredCards[vocabIndex].front}</h2>
                  <button onClick={(e) => speak(filteredCards[vocabIndex].front, e)} className="w-14 h-14 bg-blue-50 text-blue-500 rounded-full text-2xl hover:bg-blue-100 transition">🔊</button>
                </div>
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-blue-50 rounded-3xl shadow-xl border-2 border-blue-200 p-6 text-center [transform:rotateY(180deg)] [backface-visibility:hidden]">
                  <h2 className="text-4xl font-extrabold text-blue-800 mb-2">{filteredCards[vocabIndex].back}</h2>
                  <p className="text-slate-600 text-xl font-medium">{filteredCards[vocabIndex].ipa}</p>
                </div>
              </div>
            </div>
            <button onClick={toggleLearnedStatus} className={`mt-8 px-8 py-3 rounded-2xl font-bold text-white shadow-lg transition-colors ${filteredCards[vocabIndex].is_learned ? "bg-orange-500 hover:bg-orange-600" : "bg-emerald-500 hover:bg-emerald-600"}`}>
              {filteredCards[vocabIndex].is_learned ? "↺ Bỏ đánh dấu thuộc" : "✓ Chốt! Đã thuộc"}
            </button>
            <div className="flex items-center gap-6 mt-6">
              <button onClick={() => {setIsFlipped(false); setVocabIndex(vocabIndex - 1)}} disabled={vocabIndex === 0} className="w-12 h-12 bg-white rounded-full font-bold text-xl disabled:opacity-30 border">←</button>
              <span className="font-medium text-slate-500">{vocabIndex + 1} / {filteredCards.length}</span>
              <button onClick={() => {setIsFlipped(false); setVocabIndex(vocabIndex + 1)}} disabled={vocabIndex === filteredCards.length - 1} className="w-12 h-12 bg-blue-600 text-white rounded-full font-bold text-xl disabled:opacity-50">→</button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}