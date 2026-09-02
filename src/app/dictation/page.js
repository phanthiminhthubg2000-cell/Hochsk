"use client";
import Link from "next/link";
import { useState, useEffect } from "react";

const HSK_LEVELS = [
  { name: "HSK 1", requiredExp: 0 },
  { name: "HSK 2", requiredExp: 1000 },
  { name: "HSK 3", requiredExp: 2000 },
  { name: "HSK 4", requiredExp: 3000 },
  { name: "HSK 5", requiredExp: 4000 },
  { name: "HSK 6", requiredExp: 5000 },
];

export default function EndlessDictationPage() {
  const [selectedHsk, setSelectedHsk] = useState("HSK 1");
  const [userExp, setUserExp] = useState(0);
  
  const [currentSentence, setCurrentSentence] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const [userInput, setUserInput] = useState("");
  const [showAnswer, setShowAnswer] = useState(false);
  const [feedback, setFeedback] = useState(null); 
  const [errorMsg, setErrorMsg] = useState(null);
  
  const [sentenceHistory, setSentenceHistory] = useState([]);

  useEffect(() => {
    const savedExp = localStorage.getItem("ai_dictation_exp");
    const savedHistory = localStorage.getItem("ai_dictation_history");
    
    if (savedExp) setUserExp(parseInt(savedExp));
    if (savedHistory) setSentenceHistory(JSON.parse(savedHistory));
    
    // Đảm bảo load giọng nói ngay khi mở web để không bị delay ở câu đầu tiên
    window.speechSynthesis.getVoices();
    
    generateNewSentence("HSK 1", savedHistory ? JSON.parse(savedHistory) : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    localStorage.setItem("ai_dictation_exp", userExp);
  }, [userExp]);

  useEffect(() => {
    if (sentenceHistory.length > 0) {
      const recent = sentenceHistory.slice(-20);
      localStorage.setItem("ai_dictation_history", JSON.stringify(recent));
    }
  }, [sentenceHistory]);

  const generateNewSentence = async (level, history = sentenceHistory) => {
    setIsLoading(true);
    setFeedback(null);
    setUserInput("");
    setShowAnswer(false);
    setErrorMsg(null); 
    
    try {
      const recentTexts = history.slice(-5); 
      
      const res = await fetch('/api/dictation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: level, recentSentences: recentTexts })
      });
      
      if (!res.ok) {
          const errorInfo = await res.json().catch(() => ({}));
          const detailedError = `Lỗi ${res.status}: ${errorInfo.error || errorInfo.message || "Không thể kết nối API"}`;
          console.error("🚨 CHI TIẾT LỖI:", errorInfo);
          throw new Error(detailedError);
      }
      
      const data = await res.json();
      setCurrentSentence(data);
      speak(data.chinese);
      
    } catch (error) {
      console.error(error);
      setCurrentSentence(null); 
      setErrorMsg(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const speak = (text) => {
    if (!text) return;
    
    // Hủy các giọng đọc trước đó nếu bấm liên tục
    window.speechSynthesis.cancel(); 

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    
    // Điều chỉnh để dễ nghe chép chính tả
    utterance.rate = 0.85; 
    utterance.pitch = 1.05; 

    // Tìm giọng đọc chất lượng cao
    const voices = window.speechSynthesis.getVoices();
    const chineseVoices = voices.filter(v => v.lang.includes("zh-"));
    
    if (chineseVoices.length > 0) {
        const bestVoice = chineseVoices.find(v => v.name.includes("Natural") || v.name.includes("Online"))
            || chineseVoices.find(v => v.name.includes("Google"))
            || chineseVoices.find(v => v.name.includes("Xiaoxiao"))
            || chineseVoices.find(v => v.name.includes("Ting-Ting"))
            || chineseVoices[0];
            
        utterance.voice = bestVoice;
    }

    window.speechSynthesis.speak(utterance);
  };

  const checkAnswer = () => {
    if (!currentSentence || !userInput.trim()) return;
    
    if (userInput.trim() === currentSentence.chinese.trim()) {
        setFeedback("correct");
        setUserExp(prev => prev + 20); 
        
        setSentenceHistory(prev => [...prev, currentSentence.chinese]);
        
        setTimeout(() => {
            generateNewSentence(selectedHsk);
        }, 1500);
    } else {
        setFeedback("incorrect");
    }
  };

  const handleKeyDown = (e) => {
      if (e.key === 'Enter' && !isLoading && userInput.trim() && feedback !== 'correct') {
          checkAnswer();
      }
  };

  const handleLevelChange = (e) => {
    const targetLevel = e.target.value;
    setSelectedHsk(targetLevel);
    generateNewSentence(targetLevel);
  };

  const currentLevelIndex = HSK_LEVELS.findIndex(
    (l, idx) => userExp >= l.requiredExp && (idx === HSK_LEVELS.length - 1 || userExp < HSK_LEVELS[idx + 1].requiredExp)
  );
  const currentLvlObj = HSK_LEVELS[currentLevelIndex !== -1 ? currentLevelIndex : 0];
  const nextLvlObj = HSK_LEVELS[currentLevelIndex + 1];
  
  let expPercent = 100;
  if (nextLvlObj) {
      const expInCurrentLevel = userExp - currentLvlObj.requiredExp;
      const expNeeded = nextLvlObj.requiredExp - currentLvlObj.requiredExp;
      expPercent = Math.min(Math.round((expInCurrentLevel / expNeeded) * 100), 100);
  }

  return (
    <main className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-6">
        
        {/* SIDEBAR */}
        <div className="w-full lg:w-1/3 flex flex-col gap-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 sticky top-10">
                <Link href="/">
                    <button className="w-full mb-6 px-4 py-3 bg-slate-100 font-bold text-slate-600 rounded-xl hover:bg-slate-200 text-center transition">
                      ← Trở về Trang Chủ
                    </button>
                </Link>

                <p className="font-bold text-slate-600 mb-2 uppercase tracking-widest text-sm">Chọn Cấp Độ Luyện Tập</p>
                <select 
                    value={selectedHsk} 
                    onChange={handleLevelChange}
                    className="w-full bg-emerald-50 border-2 border-emerald-200 text-emerald-700 font-bold py-3 px-4 rounded-xl outline-none cursor-pointer hover:bg-emerald-100 transition mb-6"
                >
                    {HSK_LEVELS.map(lvl => {
                        const isUnlocked = userExp >= lvl.requiredExp;
                        return (
                            <option key={lvl.name} value={lvl.name} disabled={!isUnlocked}>
                                {lvl.name} {isUnlocked ? "" : `(Cần ${lvl.requiredExp} EXP)`}
                            </option>
                        );
                    })}
                </select>

                <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 mb-6">
                    <p className="text-sm font-bold text-slate-500 mb-1">ĐIỂM KINH NGHIỆM</p>
                    <p className="text-3xl font-black text-emerald-500 mb-2">{userExp} <span className="text-sm text-slate-400">EXP</span></p>
                    
                    <div className="h-3 bg-slate-200 rounded-full overflow-hidden mb-2">
                        <div className="h-full bg-emerald-400 transition-all duration-500" style={{ width: `${expPercent}%` }}></div>
                    </div>
                    
                    {nextLvlObj ? (
                        <p className="text-xs font-bold text-slate-500 text-right">
                            {expPercent}% (Cần thêm {nextLvlObj.requiredExp - userExp} EXP để mở {nextLvlObj.name})
                        </p>
                    ) : (
                        <p className="text-xs font-bold text-emerald-500 text-right">ĐÃ MỞ KHÓA TẤT CẢ CẤP ĐỘ!</p>
                    )}
                </div>

                <button 
                  onClick={() => generateNewSentence(selectedHsk)}
                  disabled={isLoading}
                  className="w-full py-4 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 font-bold hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  🔄 {isLoading ? "Đang tạo..." : "Bỏ qua & Đổi câu khác"}
                </button>
            </div>
        </div>

        {/* KHU VỰC CHÍNH TẢ */}
        <div className="w-full lg:w-2/3 flex flex-col gap-6">
            
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Chế độ Sinh Tồn ({selectedHsk})</h2>
                  <p className="text-slate-500 text-sm mt-1">Luyện nghe chép không giới hạn. Gõ đúng để nhận +20 EXP!</p>
                </div>
                <div className="text-4xl">🎧</div>
            </div>

            <div className="w-full bg-white p-10 rounded-3xl shadow-xl border-t-8 border-emerald-500 text-center flex flex-col justify-center items-center relative min-h-[450px]">
                
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center animate-pulse">
                        <div className="text-6xl mb-4">✨</div>
                        <h3 className="text-2xl font-bold text-slate-700">Đang chuẩn bị câu mới...</h3>
                        <p className="text-slate-500 mt-2">Đảm bảo đúng chuẩn {selectedHsk} của bạn.</p>
                    </div>
                ) : currentSentence ? (
                    <div className="w-full flex flex-col items-center animate-fade-in">
                        <h3 className="text-slate-400 font-bold tracking-widest uppercase mb-8">Nghe và Gõ lại chữ Hán</h3>

                        <button 
                            onClick={() => speak(currentSentence.chinese)} 
                            className="w-24 h-24 bg-emerald-50 text-emerald-600 rounded-full text-4xl shadow-md hover:scale-110 hover:bg-emerald-100 transition-transform mb-10 flex items-center justify-center border-4 border-white outline outline-1 outline-emerald-100"
                        >
                            🔊
                        </button>

                        <input 
                            type="text"
                            value={userInput}
                            onChange={(e) => {
                                setUserInput(e.target.value);
                                setFeedback(null);
                            }}
                            onKeyDown={handleKeyDown}
                            placeholder="Gõ chính xác những gì bạn nghe được..."
                            className={`w-full max-w-lg text-center text-2xl p-4 rounded-xl border-2 outline-none transition-all ${
                                feedback === 'correct' ? 'border-green-500 bg-green-50 text-green-700' :
                                feedback === 'incorrect' ? 'border-red-500 bg-red-50 text-red-700' :
                                'border-slate-300 focus:border-emerald-500 text-slate-800'
                            }`}
                            disabled={feedback === 'correct'}
                        />

                        {feedback === 'correct' && (
                            <p className="text-green-600 font-bold mt-4 animate-bounce">✨ Chính xác! (+20 EXP)</p>
                        )}
                        {feedback === 'incorrect' && (
                            <p className="text-red-500 font-bold mt-4">❌ Chưa chính xác, hãy thử lại!</p>
                        )}

                        <button 
                            onClick={checkAnswer}
                            disabled={feedback === 'correct' || !userInput.trim()}
                            className={`w-full max-w-lg mt-6 py-4 rounded-xl font-bold text-xl transition-all shadow-md ${
                                feedback === 'correct' 
                                ? 'bg-slate-300 text-slate-500 cursor-not-allowed' 
                                : 'bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow-lg'
                            }`}
                        >
                            Kiểm tra
                        </button>

                        <button 
                            onClick={() => setShowAnswer(!showAnswer)}
                            className="mt-6 text-slate-500 underline hover:text-emerald-600 transition"
                        >
                            {showAnswer ? "Ẩn đáp án" : "Nghe không ra? Xem đáp án"}
                        </button>

                        {showAnswer && (
                            <div className="mt-6 p-6 bg-slate-50 rounded-2xl border border-slate-200 animate-fade-in w-full max-w-lg text-center">
                                <p className="text-4xl font-black text-slate-800 mb-4">{currentSentence.chinese}</p>
                                <p className="text-xl text-slate-600 font-medium mb-2">{currentSentence.pinyin}</p>
                                <p className="text-emerald-700 font-bold">{currentSentence.vietnamese}</p>
                            </div>
                        )}
                    </div>
                ) : (
                   <div className="text-center bg-red-50 p-6 rounded-2xl border border-red-200">
                       <p className="text-red-600 font-bold text-xl mb-2">Opps! Có lỗi xảy ra.</p>
                       <p className="text-red-500 font-mono text-sm mb-6 max-w-md mx-auto">{errorMsg || "Lỗi không xác định"}</p>
                       <button onClick={() => generateNewSentence(selectedHsk)} className="px-8 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition shadow-sm">🔄 Thử lại ngay</button>
                   </div>
                )}
            </div>
        </div>
      </div>
    </main>
  );
}