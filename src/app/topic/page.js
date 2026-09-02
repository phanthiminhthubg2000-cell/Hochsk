"use client";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
// Import data từ topics.json
import myCustomData from "../topics.json"; 
import { useUser } from "@clerk/nextjs";
import { db } from "../../firebase";
import { doc, setDoc } from "firebase/firestore";

const generateLevelsFromData = (data, wordsPerLevel = 10) => {
  const levels = [];
  const dataArray = Array.isArray(data) ? data : [];
  for (let i = 0; i < dataArray.length; i += wordsPerLevel) {
    const levelNumber = Math.floor(i / wordsPerLevel) + 1;
    levels.push({
      level: levelNumber,
      words: dataArray.slice(i, i + wordsPerLevel)
    });
  }
  return levels.length > 0 ? levels : [{ level: 1, words: [] }];
};

export default function TopicFlashcardPage() {
  // BƯỚC 2: Gọi tài khoản người dùng
  const { user } = useUser();

  const availableCategories = [...new Set(myCustomData.map(item => item.topic || item.category || item.level))].filter(Boolean).sort();
  const [selectedCategory, setSelectedCategory] = useState(availableCategories[0] || "");
  
  const [levelsData, setLevelsData] = useState([]);
  const [userExp, setUserExp] = useState(0);
  const [viewingLevel, setViewingLevel] = useState(1);
  const [wordProgress, setWordProgress] = useState({}); 
  const [filter, setFilter] = useState("all"); 
  
  const [activeWordIndex, setActiveWordIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [shadowingResult, setShadowingResult] = useState(null);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Lọc data theo chủ đề, loại bỏ từ trùng lặp và chia bài học
  useEffect(() => {
    const dataForCategory = selectedCategory 
      ? myCustomData.filter(item => (item.topic || item.category || item.level) === selectedCategory) 
      : myCustomData;
      
    // LỌC TỪ TRÙNG LẶP CHO TAB TOPIC
    const uniqueData = dataForCategory.filter((item, index, self) => {
      const currentWord = item.front || item.text || item.word;
      return index === self.findIndex((t) => (t.front || t.text || t.word) === currentWord);
    });
      
    const generatedLevels = generateLevelsFromData(uniqueData, 10); 
    setLevelsData(generatedLevels);
    setViewingLevel(1); 
    setActiveWordIndex(0);
    setIsFlipped(false);
  }, [selectedCategory]);

  // Load tiến độ độc lập cho tab Topic (Không bị đè bởi tab HSK)
  useEffect(() => {
    const savedExp = localStorage.getItem("topic_exp");
    const savedProgress = localStorage.getItem("topic_word_progress");
    if (savedExp) setUserExp(parseInt(savedExp));
    if (savedProgress) setWordProgress(JSON.parse(savedProgress));
  }, []);

  useEffect(() => {
    localStorage.setItem("topic_exp", userExp);
  }, [userExp]);

  useEffect(() => {
    if (Object.keys(wordProgress).length > 0) {
      localStorage.setItem("topic_word_progress", JSON.stringify(wordProgress));
    }
  }, [wordProgress]);

  if (levelsData.length === 0) return <div className="p-10 text-center">Đang tải dữ liệu từ vựng Chủ đề...</div>;

  const activeLevelData = levelsData.find(l => l.level === viewingLevel) || levelsData[0];
  
  const filteredWords = activeLevelData.words.filter(word => {
    const wordId = word.front || word.text || word.word;
    const status = wordProgress[wordId] || "learning";
    if (filter === "all") return true;
    return filter === status;
  });

  const activeWord = filteredWords[activeWordIndex];
  
  const masteredCount = activeLevelData.words.filter(w => {
    const wordId = w.front || w.text || w.word;
    return wordProgress[wordId] === "mastered";
  }).length;
  
  const progressPercent = activeLevelData.words.length > 0 
    ? Math.round((masteredCount / activeLevelData.words.length) * 100) 
    : 0;

  const speak = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    window.speechSynthesis.speak(utterance);
  };

  // BƯỚC 3: Đồng bộ điểm Topic lên Firebase khi chọn "Đã thuộc"
  const markWord = async (status) => {
    if (!activeWord) return;
    const wordId = activeWord.front || activeWord.text || activeWord.word;
    const isAlreadyMastered = wordProgress[wordId] === "mastered";
    
    setWordProgress(prev => ({ ...prev, [wordId]: status }));
    
    if (status === "mastered" && !isAlreadyMastered) {
      const newExp = userExp + 20;
      setUserExp(newExp); 

      // --- ĐOẠN CODE ĐỒNG BỘ ĐÁM MÂY ---
      if (user) {
        try {
          const studentRef = doc(db, "progress", user.id);
          await setDoc(studentRef, { topicExp: newExp }, { merge: true });
        } catch (error) {
          console.error("Lỗi đồng bộ điểm Chủ đề:", error);
        }
      }
      // ---------------------------------
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

  // CHUYỂN BÀI HỌC TỰ DO (Không có khóa cấp độ)
  const handleLevelChange = (levelObj) => {
    setViewingLevel(levelObj.level);
    setActiveWordIndex(0);
    setIsFlipped(false);
    setFilter("all");
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
            const targetText = activeWord.front || activeWord.text || activeWord.word;
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

  const wordDisplay = activeWord ? (activeWord.front || activeWord.text || activeWord.word) : "";
  const pinyinDisplay = activeWord ? (activeWord.ipa || activeWord.pinyin) : "";
  const meaningDisplay = activeWord ? (activeWord.back || activeWord.meaning) : "";
  const exampleDisplay = activeWord ? activeWord.example : "";

  return (
    <main className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-6">
        
        {/* THANH SIDEBAR TOPIC (MÀU XANH LAM) */}
        <div className="w-full lg:w-1/3 flex flex-col gap-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 sticky top-10">
                <Link href="/">
                    <button className="w-full mb-6 px-4 py-3 bg-slate-100 font-bold text-slate-600 rounded-xl hover:bg-slate-200 text-center transition">← Trở về Trang Chủ</button>
                </Link>

                {availableCategories.length > 0 && (
                  <>
                    <p className="font-bold text-slate-600 mb-2 uppercase tracking-widest text-sm">Chọn Chủ Đề</p>
                    <select 
                        value={selectedCategory} 
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="w-full bg-blue-50 border-2 border-blue-200 text-blue-700 font-bold py-3 px-4 rounded-xl outline-none cursor-pointer hover:bg-blue-100 transition mb-6"
                    >
                        {availableCategories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                  </>
                )}

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 flex justify-between items-center">
                    <div>
                        <p className="text-sm font-bold text-slate-500 mb-1">TỔNG EXP CHỦ ĐỀ</p>
                        <p className="text-3xl font-black text-blue-500">{userExp} <span className="text-sm text-slate-400">EXP</span></p>
                    </div>
                    <div className="text-4xl">🏅</div>
                </div>

                <p className="font-bold text-slate-800 mb-4">Danh sách Bài học</p>
                <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {levelsData.map(lvl => {
                        const isActive = lvl.level === viewingLevel;
                        
                        return (
                            <button 
                                key={lvl.level}
                                onClick={() => handleLevelChange(lvl)}
                                className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                                    isActive ? 'border-blue-500 bg-blue-50 shadow-md' : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm'
                                }`}
                            >
                                <div className="text-left">
                                    <p className={`font-bold text-lg ${isActive ? 'text-blue-600' : 'text-slate-700'}`}>
                                        Bài {lvl.level}
                                    </p>
                                    <p className="text-xs text-slate-500 font-medium mt-1">
                                        {lvl.words.length} từ vựng
                                    </p>
                                </div>
                                <div className="text-2xl">
                                    {isActive ? '🔥' : '📖'}
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
                    <span className="font-black text-blue-600">{progressPercent}%</span>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden mb-6">
                    <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
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
                className="w-full bg-white p-10 rounded-3xl shadow-xl border-b-8 border-blue-600 text-center cursor-pointer transition-all hover:-translate-y-2 relative min-h-[400px] flex flex-col justify-center items-center"
                >
                <div className="absolute right-6 top-6 flex gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${wordProgress[wordDisplay] === 'mastered' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                    {wordProgress[wordDisplay] === 'mastered' ? '✓ Đã thuộc' : 'Đang học'}
                    </span>
                </div>

                <button 
                    onClick={(e) => { e.stopPropagation(); speak(wordDisplay); }} 
                    className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full text-3xl shadow-sm hover:scale-110 transition-transform mb-6 z-10"
                >
                    🔊
                </button>
                
                <h3 className="text-8xl font-black text-slate-800 mb-6">{wordDisplay}</h3>
                
                {isFlipped ? (
                    <div className="animate-fade-in w-full px-4">
                    <p className="text-3xl font-medium text-slate-500 mb-2 tracking-widest">{pinyinDisplay}</p>
                    <p className="text-2xl font-bold text-blue-600 mb-4">{meaningDisplay}</p>
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

                    {shadowingResult === "loading" && <p className="text-blue-500 font-bold mt-4 animate-bounce">AI đang nghe và phân tích...</p>}
                    
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
                <h3 className="text-2xl font-bold text-slate-800">Bạn đã hoàn thành danh sách này!</h3>
                <p className="text-slate-500 mt-2">Tuyệt vời! Hãy chọn bài học khác ở cột bên trái để tiếp tục nhé.</p>
            </div>
            )}
        </div>
      </div>
    </main>
  );
}