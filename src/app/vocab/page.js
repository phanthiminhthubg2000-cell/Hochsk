"use client";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import myCustomData from "../cards.json";

// Hàm chia nhỏ data thành các bài học (mỗi bài 10 từ)
const generateLevelsFromData = (data, wordsPerLevel = 10) => {
  const levels = [];
  const dataArray = Array.isArray(data) ? data : [];
  for (let i = 0; i < dataArray.length; i += wordsPerLevel) {
    const levelNumber = Math.floor(i / wordsPerLevel) + 1;
    levels.push({
      level: levelNumber,
      requiredExp: (levelNumber - 1) * 100,
      words: dataArray.slice(i, i + wordsPerLevel)
    });
  }
  return levels.length > 0 ? levels : [{ level: 1, requiredExp: 0, words: [] }];
};

export default function FlashcardPage() {
  const availableHskLevels = [...new Set(myCustomData.map(item => item.level))].filter(Boolean).sort();
  const [selectedHsk, setSelectedHsk] = useState(availableHskLevels[0] || "");
  
  const [levelsData, setLevelsData] = useState([]);
  const [userExp, setUserExp] = useState(0);
  const [maxUnlockedLevel, setMaxUnlockedLevel] = useState(1);
  const [viewingLevel, setViewingLevel] = useState(1);
  
  const [wordProgress, setWordProgress] = useState({}); 
  const [filter, setFilter] = useState("all"); 
  
  const [activeWordIndex, setActiveWordIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [shadowingResult, setShadowingResult] = useState(null);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Lọc data, loại bỏ từ trùng lặp và chia bài học
  useEffect(() => {
    const dataForHsk = selectedHsk 
      ? myCustomData.filter(item => item.level === selectedHsk) 
      : myCustomData;
      
    // LỌC TỪ TRÙNG LẶP (Dựa trên chữ Hán - key "front")
    const uniqueData = dataForHsk.filter((item, index, self) =>
      index === self.findIndex((t) => t.front === item.front)
    );
      
    const generatedLevels = generateLevelsFromData(uniqueData, 10); 
    setLevelsData(generatedLevels);
    setViewingLevel(1); 
    setActiveWordIndex(0);
    setIsFlipped(false);
  }, [selectedHsk]);

  // Load tiến độ HSK từ LocalStorage
  useEffect(() => {
    const savedExp = localStorage.getItem("hskk_exp");
    const savedProgress = localStorage.getItem("hskk_word_progress");
    if (savedExp) setUserExp(parseInt(savedExp));
    if (savedProgress) setWordProgress(JSON.parse(savedProgress));
  }, []);

  // Tính cấp độ tối đa được mở khóa
  useEffect(() => {
    if (levelsData.length === 0) return;
    let newLevel = 1;
    for (let i = levelsData.length - 1; i >= 0; i--) {
      if (userExp >= levelsData[i].requiredExp) {
        newLevel = levelsData[i].level;
        break;
      }
    }
    setMaxUnlockedLevel(newLevel);
    localStorage.setItem("hskk_exp", userExp);
  }, [userExp, levelsData]);

  // Lưu trạng thái từ vựng
  useEffect(() => {
    if (Object.keys(wordProgress).length > 0) {
      localStorage.setItem("hskk_word_progress", JSON.stringify(wordProgress));
    }
  }, [wordProgress]);

  if (levelsData.length === 0) return <div className="p-10 text-center">Đang tải dữ liệu từ vựng...</div>;

  const activeLevelData = levelsData.find(l => l.level === viewingLevel) || levelsData[0];
  
  const filteredWords = activeLevelData.words.filter(word => {
    const wordId = word.front;
    const status = wordProgress[wordId] || "learning";
    if (filter === "all") return true;
    return filter === status;
  });

  const activeWord = filteredWords[activeWordIndex];
  
  const masteredCount = activeLevelData.words.filter(w => wordProgress[w.front] === "mastered").length;
  
  const progressPercent = activeLevelData.words.length > 0 
    ? Math.round((masteredCount / activeLevelData.words.length) * 100) 
    : 0;

  const speak = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    window.speechSynthesis.speak(utterance);
  };

  const markWord = (status) => {
    if (!activeWord) return;
    const wordId = activeWord.front;
    const isAlreadyMastered = wordProgress[wordId] === "mastered";
    
    setWordProgress(prev => ({ ...prev, [wordId]: status }));
    
    if (status === "mastered" && !isAlreadyMastered) {
      setUserExp(prev => prev + 20); 
    }

    setShadowingResult(null); 
    setIsFlipped(false);

    if (activeWordIndex < filteredWords.length - 1) {
      setActiveWordIndex(prev => prev + 1);
    } else {
      setActiveWordIndex(0);
    }
  };

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
    setActiveWordIndex(0);
    setIsFlipped(false);
    setShadowingResult(null);
  };

  const handleLevelChange = (levelObj) => {
      if (levelObj.level <= maxUnlockedLevel) {
          setViewingLevel(levelObj.level);
          setActiveWordIndex(0);
          setIsFlipped(false);
          setFilter("all");
      } else {
          alert(`🔒 Bạn cần đạt ${levelObj.requiredExp} EXP để mở khóa Bài ${levelObj.level}! Hãy học các bài trước để tích lũy EXP nhé.`);
      }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const options = { mimeType: 'audio/webm', audioBitsPerSecond: 16000 };
      const mediaRecorder = new MediaRecorder(stream, options);
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      setShadowingResult(null);
    } catch (err) {
      alert("Vui lòng cấp quyền Micro!");
    }
  };

  const stopRecordingAndGrade = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          setIsRecording(false);
          setShadowingResult("loading");
          
          try {
            const targetText = activeWord.front;
            const res = await fetch('/api/shadowing', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ targetText, audioBase64: reader.result })
            });
            const data = await res.json();
            setShadowingResult(data);
          } catch (e) {
            alert("Lỗi chấm điểm AI!");
            setShadowingResult(null);
          }
        };
      };
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const wordDisplay = activeWord ? activeWord.front : "";
  const pinyinDisplay = activeWord ? activeWord.ipa : "";
  const meaningDisplay = activeWord ? activeWord.back : "";
  const exampleDisplay = activeWord ? activeWord.example : "";

  return (
    <main className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-6">
        
        {/* THANH SIDEBAR HSK */}
        <div className="w-full lg:w-1/3 flex flex-col gap-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 sticky top-10">
                <Link href="/">
                    <button className="w-full mb-6 px-4 py-3 bg-slate-100 font-bold text-slate-600 rounded-xl hover:bg-slate-200 text-center transition">← Trở về Trang Chủ</button>
                </Link>

                <p className="font-bold text-slate-600 mb-2 uppercase tracking-widest text-sm">Chọn Bộ Từ Vựng</p>
                <select 
                    value={selectedHsk} 
                    onChange={(e) => setSelectedHsk(e.target.value)}
                    className="w-full bg-rose-50 border-2 border-rose-200 text-rose-700 font-bold py-3 px-4 rounded-xl outline-none cursor-pointer hover:bg-rose-100 transition mb-6"
                >
                    {availableHskLevels.map(lvl => (
                        <option key={lvl} value={lvl}>Bộ {lvl}</option>
                    ))}
                </select>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6">
                    <p className="text-sm font-bold text-slate-500 mb-1">TỔNG EXP CỦA BẠN</p>
                    <p className="text-3xl font-black text-yellow-500 mb-2">{userExp} <span className="text-sm text-slate-400">EXP</span></p>
                    
                    <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                        <div 
                        className="h-full bg-yellow-400 transition-all duration-500" 
                        style={{ width: `${Math.min((userExp / (levelsData.find(l => l.level === maxUnlockedLevel + 1)?.requiredExp || Math.max(userExp, 1))) * 100, 100)}%` }}
                        ></div>
                    </div>
                    <p className="text-xs font-medium text-slate-400 mt-2 text-right">
                        Cần {levelsData.find(l => l.level === maxUnlockedLevel + 1)?.requiredExp || 'MAX'} EXP để mở khóa bài tiếp theo
                    </p>
                </div>

                <p className="font-bold text-slate-800 mb-4">Lộ trình học tập</p>
                <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {levelsData.map(lvl => {
                        const isUnlocked = lvl.level <= maxUnlockedLevel;
                        const isActive = lvl.level === viewingLevel;
                        
                        return (
                            <button 
                                key={lvl.level}
                                onClick={() => handleLevelChange(lvl)}
                                className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                                    isActive ? 'border-rose-500 bg-rose-50 shadow-md' : 
                                    isUnlocked ? 'border-slate-200 bg-white hover:border-rose-300 hover:shadow-sm' : 'border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed'
                                }`}
                            >
                                <div className="text-left">
                                    <p className={`font-bold text-lg ${isActive ? 'text-rose-600' : isUnlocked ? 'text-slate-700' : 'text-slate-400'}`}>
                                        Bài {lvl.level}
                                    </p>
                                    <p className="text-xs text-slate-500 font-medium mt-1">
                                        {isUnlocked ? `${lvl.words.length} từ vựng` : `Cần ${lvl.requiredExp} EXP`}
                                    </p>
                                </div>
                                <div className="text-2xl">
                                    {isActive ? '🔥' : isUnlocked ? '🔓' : '🔒'}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>

        {/* KHU VỰC HỌC TẬP CHÍNH */}
        <div className="w-full lg:w-2/3 flex flex-col gap-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-slate-800">
                    Tiến độ Bài {viewingLevel}
                    </h2>
                    <span className="font-black text-rose-600">{progressPercent}%</span>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden mb-6">
                    <div className="h-full bg-rose-500 transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
                </div>
                
                <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-fit">
                    <button onClick={() => handleFilterChange("all")} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${filter === 'all' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>Tất cả</button>
                    <button onClick={() => handleFilterChange("learning")} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${filter === 'learning' ? 'bg-white shadow-sm text-red-500' : 'text-slate-500'}`}>Chưa thuộc</button>
                    <button onClick={() => handleFilterChange("mastered")} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${filter === 'mastered' ? 'bg-white shadow-sm text-green-500' : 'text-slate-500'}`}>Đã thuộc</button>
                </div>
            </div>

            {filteredWords.length > 0 && activeWord ? (
            <div className="flex flex-col items-center gap-6 animate-fade-in">
                <div 
                onClick={() => setIsFlipped(!isFlipped)}
                className="w-full bg-white p-10 rounded-3xl shadow-xl border-b-8 border-rose-600 text-center cursor-pointer transition-all hover:-translate-y-2 relative min-h-[400px] flex flex-col justify-center items-center"
                >
                <div className="absolute right-6 top-6 flex gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${wordProgress[wordDisplay] === 'mastered' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                    {wordProgress[wordDisplay] === 'mastered' ? '✓ Đã thuộc' : 'Đang học'}
                    </span>
                </div>

                <button 
                    onClick={(e) => { e.stopPropagation(); speak(wordDisplay); }} 
                    className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full text-3xl shadow-sm hover:scale-110 transition-transform mb-6 z-10"
                >
                    🔊
                </button>
                
                <h3 className="text-8xl font-black text-slate-800 mb-6">{wordDisplay}</h3>
                
                {isFlipped ? (
                    <div className="animate-fade-in w-full px-4">
                    <p className="text-3xl font-medium text-slate-500 mb-2 tracking-widest">{pinyinDisplay}</p>
                    <p className="text-2xl font-bold text-rose-600 mb-4">{meaningDisplay}</p>
                    {exampleDisplay && (
                        <p className="text-md italic text-slate-600 bg-slate-50 px-6 py-4 rounded-xl shadow-inner inline-block mt-2">
                        <span className="font-bold text-slate-400">VD:</span> {exampleDisplay}
                        </p>
                    )}
                    </div>
                ) : (
                    <p className="text-sm font-bold text-slate-400 mt-8 animate-pulse bg-slate-50 px-4 py-2 rounded-full">
                    👆 Chạm vào thẻ để lật xem nghĩa
                    </p>
                )}
                </div>

                <div className="w-full bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                <div className="w-full max-w-md mx-auto bg-slate-50 p-6 rounded-2xl border border-slate-100 mb-8 text-center">
                    <p className="font-bold text-slate-600 mb-4">Luyện Phát Âm (Shadowing)</p>
                    
                    {!isRecording ? (
                    <button onClick={startRecording} className="w-full py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 flex justify-center items-center gap-2 transition">
                        🎙️ Nhấn để Ghi âm
                    </button>
                    ) : (
                    <button onClick={stopRecordingAndGrade} className="w-full py-3 bg-red-500 text-white rounded-xl font-bold animate-pulse flex justify-center items-center gap-2 shadow-[0_0_15px_rgba(239,68,68,0.5)] transition">
                        ⏹️ Đang thu âm... Bấm để Nộp
                    </button>
                    )}

                    {shadowingResult === "loading" && <p className="text-rose-500 font-bold mt-4 animate-bounce">AI đang nghe và phân tích...</p>}
                    
                    {shadowingResult && shadowingResult !== "loading" && (
                    <div className="mt-4 p-4 bg-white rounded-xl shadow-sm border border-slate-200 text-left">
                        <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-slate-700">Điểm số:</span>
                        <span className={`text-2xl font-black ${shadowingResult.score >= 80 ? 'text-green-500' : 'text-red-500'}`}>{shadowingResult.score}/100</span>
                        </div>
                        <p className="text-sm text-slate-600"><span className="font-bold">Nhận xét:</span> {shadowingResult.feedback}</p>
                    </div>
                    )}
                </div>

                <div className="flex gap-4 w-full max-w-md mx-auto">
                    <button 
                    onClick={() => markWord("learning")}
                    className="flex-1 py-4 bg-white border-2 border-slate-200 text-slate-600 rounded-2xl font-bold text-lg hover:border-red-400 hover:bg-red-50 transition-colors shadow-sm"
                    >
                    ❌ Chưa thuộc
                    </button>
                    <button 
                    onClick={() => markWord("mastered")}
                    className="flex-1 py-4 bg-green-500 text-white rounded-2xl font-bold text-lg hover:bg-green-600 shadow-lg shadow-green-200 transition-colors"
                    >
                    ✓ Đã thuộc (+20 EXP)
                    </button>
                </div>
                </div>
            </div>
            ) : (
            <div className="bg-white p-10 rounded-3xl shadow-sm border border-slate-200 text-center">
                <div className="text-6xl mb-4">🎉</div>
                <h3 className="text-2xl font-bold text-slate-800">Bạn đã hoàn thành bộ lọc này!</h3>
                <p className="text-slate-500 mt-2">Hãy cày thêm EXP để mở khóa bài học tiếp theo nhé.</p>
            </div>
            )}
        </div>
      </div>
    </main>
  );
}