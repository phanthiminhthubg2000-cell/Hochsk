"use client";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";

// THIẾT LẬP THANG ĐIỂM (5000 EXP MỖI CẤP)
const HSK_LEVELS = [
  { name: "HSK 1", requiredExp: 0 },
  { name: "HSK 2", requiredExp: 5000 },
  { name: "HSK 3", requiredExp: 10000 },
  { name: "HSK 4", requiredExp: 15000 },
  { name: "HSK 5", requiredExp: 20000 },
  { name: "HSK 6", requiredExp: 25000 },
];

export default function DictationPage() {
  const [selectedHsk, setSelectedHsk] = useState("HSK 1");
  const [userExp, setUserExp] = useState(0); 
  
  const [currentSentence, setCurrentSentence] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const [userInput, setUserInput] = useState("");
  const [showAnswer, setShowAnswer] = useState(false);
  const [isCorrect, setIsCorrect] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  
  const [sentenceHistory, setSentenceHistory] = useState([]);
  const inputRef = useRef(null);

  // Tải dữ liệu lưu trữ khi mở trang
  useEffect(() => {
    const savedExp = localStorage.getItem("ai_dictation_exp");
    const savedHistory = localStorage.getItem("ai_dictation_history");
    
    if (savedExp) setUserExp(parseInt(savedExp));
    
    let historyArr = [];
    if (savedHistory) {
        historyArr = JSON.parse(savedHistory);
        setSentenceHistory(historyArr);
    }
    
    generateNewSentence("HSK 1", historyArr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lưu lại EXP mỗi khi có thay đổi
  useEffect(() => {
    localStorage.setItem("ai_dictation_exp", userExp);
  }, [userExp]);

  // HÀM PHÁT ÂM THÔNG MINH (Tách biệt Tiếng Trung & Tiếng Việt)
  const playAudio = (text, language = "zh-CN") => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // Dừng ngay giọng đọc cũ nếu đang đọc dở
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language; 
      utterance.rate = 0.85; // Đọc chậm lại một chút cho dễ nghe chép
      window.speechSynthesis.speak(utterance);
    } else {
      alert("Trình duyệt của bạn không hỗ trợ tính năng phát âm!");
    }
  };

  // GỌI AI ĐỂ LẤY CÂU HỎI MỚI
  const generateNewSentence = async (level, history = sentenceHistory) => {
    setIsLoading(true);
    setIsCorrect(null);
    setUserInput("");
    setShowAnswer(false);
    setErrorMsg(null);
    setCurrentSentence(null);
    
    try {
      const res = await fetch('/api/dictation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            level: level,
            recentSentences: history.slice(-5) // Gửi 5 câu gần nhất để tránh lặp
        })
      });

      if (!res.ok) {
         const errData = await res.json();
         throw new Error(errData.error || "Lỗi kết nối AI");
      }
      
      const result = await res.json();
      setCurrentSentence(result);
      
      // Auto đọc câu tiếng Trung ngay khi load xong
      setTimeout(() => playAudio(result.chinese, "zh-CN"), 500);

      // Cập nhật lịch sử
      const newHistory = [...history, result.chinese].slice(-50);
      setSentenceHistory(newHistory);
      localStorage.setItem("ai_dictation_history", JSON.stringify(newHistory));

    } catch (error) {
      setErrorMsg(error.message);
    } finally {
      setIsLoading(false);
      if(inputRef.current) inputRef.current.focus();
    }
  };

  // KIỂM TRA ĐÁP ÁN (Nghe chép thì phải gõ đúng chữ Hán)
  const checkAnswer = () => {
      if (!currentSentence || !userInput.trim()) return;
      
      // So sánh loại bỏ dấu câu và khoảng trắng để tránh lỗi nhỏ
      const cleanUser = userInput.replace(/[.,!?，。？！\s]/g, "");
      const cleanTarget = currentSentence.chinese.replace(/[.,!?，。？！\s]/g, "");

      if (cleanUser === cleanTarget) {
          setIsCorrect(true);
          setUserExp(prev => prev + 20); // Thưởng 20 EXP
          playAudio("太棒了", "zh-CN"); // Khen ngợi bằng tiếng Trung
      } else {
          setIsCorrect(false);
      }
  };

  const handleKeyDown = (e) => {
      if (e.key === 'Enter' && !isLoading && userInput.trim() && !isCorrect) {
          checkAnswer();
      }
  };

  // TÍNH TOÁN THANH TIẾN ĐỘ EXP
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
        
        {/* === SIDEBAR (CỘT TRÁI) === */}
        <div className="w-full lg:w-1/3 flex flex-col gap-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 sticky top-10">
                <Link href="/">
                    <button className="w-full mb-6 px-4 py-3 bg-slate-100 font-bold text-slate-600 rounded-xl hover:bg-slate-200 text-center transition">
                      ← Trở về Trang Chủ
                    </button>
                </Link>

                <p className="font-bold text-slate-600 mb-2 uppercase tracking-widest text-sm">CHỌN CẤP ĐỘ LUYỆN TẬP</p>
                <select 
                    value={selectedHsk} 
                    onChange={(e) => {
                        setSelectedHsk(e.target.value);
                        generateNewSentence(e.target.value);
                    }}
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
                  className="w-full py-4 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 font-bold hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <span>🔄</span> {isLoading ? "Đang lấy câu..." : "Bỏ qua & Đổi câu khác"}
                </button>
            </div>
        </div>

        {/* === KHU VỰC LUYỆN NGHE CHÉP (CỘT PHẢI) === */}
        <div className="w-full lg:w-2/3 flex flex-col gap-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Chế độ Sinh Tồn ({selectedHsk})</h2>
                  <p className="text-slate-500 text-sm mt-1">Luyện nghe chép không giới hạn. Gõ đúng để nhận +20 EXP!</p>
                </div>
                
                {/* Nút bấm nghe lại tiếng Trung */}
                <button 
                    onClick={() => currentSentence && playAudio(currentSentence.chinese, "zh-CN")}
                    disabled={!currentSentence || isLoading}
                    className="p-4 bg-emerald-100 text-emerald-700 rounded-2xl hover:bg-emerald-200 transition disabled:opacity-50 text-2xl"
                    title="Nghe lại câu hỏi"
                >
                    🎧
                </button>
            </div>

            <div className="w-full bg-white p-10 rounded-3xl shadow-xl border-t-8 border-emerald-500 text-center flex flex-col justify-center items-center relative min-h-[450px]">
                
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center animate-pulse">
                        <div className="text-6xl mb-4">🤖</div>
                        <h3 className="text-2xl font-bold text-slate-700">Giáo viên AI đang ra đề...</h3>
                        <p className="text-slate-400 mt-2">Vui lòng đợi vài giây nhé!</p>
                    </div>
                ) : errorMsg ? (
                   <div className="text-center bg-red-50 p-8 rounded-2xl border border-red-200 w-full max-w-lg">
                       <p className="text-red-600 font-bold text-2xl mb-4">Opps! Có lỗi xảy ra.</p>
                       <p className="text-red-500 font-medium mb-6">{errorMsg}</p>
                       <button 
                            onClick={() => generateNewSentence(selectedHsk)}
                            className="px-6 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition"
                        >
                            🔄 Thử lại ngay
                       </button>
                   </div>
                ) : currentSentence ? (
                    <div className="w-full flex flex-col items-center animate-fade-in">
                        <h3 className="text-slate-400 font-bold tracking-widest uppercase mb-4">Hãy nghe và gõ lại tiếng Trung</h3>
                        
                        <input 
                            ref={inputRef}
                            type="text"
                            value={userInput}
                            onChange={(e) => {
                                setUserInput(e.target.value);
                                setIsCorrect(null);
                            }}
                            onKeyDown={handleKeyDown}
                            placeholder="Gõ chữ Hán vào đây..."
                            className={`w-full max-w-lg text-center text-2xl p-4 rounded-xl border-2 outline-none transition-all ${
                                isCorrect === true ? 'border-emerald-500 bg-emerald-50 text-emerald-700' :
                                isCorrect === false ? 'border-red-500 bg-red-50 text-red-700' :
                                'border-slate-300 focus:border-emerald-500 text-slate-800'
                            }`}
                            disabled={isCorrect}
                        />

                        {isCorrect === false && (
                            <p className="text-red-500 font-bold mt-4 animate-bounce">❌ Sai rồi, hãy thử lại nhé!</p>
                        )}

                        {isCorrect === true && (
                            <div className="mt-6 p-6 rounded-2xl w-full max-w-lg bg-emerald-50 border border-emerald-200 animate-fade-in">
                                <p className="font-black text-2xl text-emerald-700 mb-2">✨ Chính xác! (+20 EXP)</p>
                                <p className="text-xl text-slate-800 font-medium">{currentSentence.chinese}</p>
                                <p className="text-lg text-slate-600 mb-2">{currentSentence.pinyin}</p>
                                <p className="text-emerald-700">{currentSentence.vietnamese}</p>
                                
                                <button 
                                    onClick={() => generateNewSentence(selectedHsk)} 
                                    className="mt-6 px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition w-full"
                                >
                                    Tiếp tục câu hỏi mới ➔
                                </button>
                            </div>
                        )}

                        {!isCorrect && (
                            <button 
                                onClick={checkAnswer}
                                disabled={!userInput.trim()}
                                className="w-full max-w-lg mt-6 py-4 rounded-xl font-bold text-xl transition-all shadow-md bg-slate-800 text-white hover:bg-slate-700 hover:shadow-lg disabled:opacity-50"
                            >
                                Kiểm tra đáp án
                            </button>
                        )}

                        {/* Nút Xem Gợi ý */}
                        {!isCorrect && (
                            <div className="mt-6 w-full max-w-lg flex flex-col items-center">
                                <button 
                                    onClick={() => setShowAnswer(!showAnswer)}
                                    className="text-slate-400 font-bold underline hover:text-emerald-600 transition mb-4"
                                >
                                    {showAnswer ? "Ẩn gợi ý" : "Nghe không ra? Bấm để xem gợi ý"}
                                </button>
                                
                                {showAnswer && (
                                    <div className="w-full p-6 bg-slate-100 rounded-2xl text-center animate-fade-in">
                                        <p className="text-slate-700 font-medium text-lg mb-4">{currentSentence.vietnamese}</p>
                                        
                                        <div className="flex gap-4 justify-center">
                                            {/* Nút đọc tiếng Việt - Tách biệt giọng vi-VN */}
                                            <button 
                                                onClick={() => playAudio(currentSentence.vietnamese, "vi-VN")}
                                                className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-600 font-bold hover:bg-slate-200 transition flex items-center gap-2"
                                            >
                                                🔊 Đọc nghĩa tiếng Việt
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ) : null}
            </div>
        </div>
      </div>
    </main>
  );
}