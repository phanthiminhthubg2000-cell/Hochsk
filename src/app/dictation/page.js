"use client";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import dictationData from "../dictation.json"; 
import { useUser } from "@clerk/nextjs";
import { db } from "../../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

export default function DictationPage() {
  const { user } = useUser();
  const audioRef = useRef(null);
  const inputRef = useRef(null);

  // Các bước điều hướng: "SELECT_CURRICULUM" -> "SELECT_HSK_LEVEL" -> "SELECT_LESSON" -> "SELECT_CARD" -> "DO_DICTATION"
  const [step, setStep] = useState("SELECT_CURRICULUM"); 
  const [selectedCurriculum, setSelectedCurriculum] = useState(null); // "newhsk" hoặc "oldhsk"
  const [selectedHskLevel, setSelectedHskLevel] = useState(null); // "HSK 1", "HSK 2", ...
  const [selectedLesson, setSelectedLesson] = useState(null); // "Bài 1"
  const [currentCard, setCurrentCard] = useState(null); 

  const [userData, setUserData] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [userInput, setUserInput] = useState("");
  const [showAnswer, setShowAnswer] = useState(false);
  const [isCorrect, setIsCorrect] = useState(null);

  useEffect(() => {
    const fetchUserData = async () => {
      if (user) {
        try {
          const docRef = doc(db, "progress", user.id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) setUserData(docSnap.data());
          else setUserData({});
        } catch (error) {
          console.error("Lỗi lấy dữ liệu:", error);
          setUserData({});
        } finally {
          setLoadingUser(false);
        }
      } else {
        setUserData({});
        setLoadingUser(false);
      }
    };
    fetchUserData();
  }, [user]);

  const checkAnswer = async () => {
      if (!currentCard || !userInput.trim()) return;
      
      const cleanUser = userInput.replace(/[.,!?，。？！\s]/g, "");
      const cleanTarget = currentCard.fullText.replace(/[.,!?，。？！\s]/g, "");

      if (cleanUser === cleanTarget) {
          setIsCorrect(true);
          if (user) {
            try {
              const studentRef = doc(db, "progress", user.id);
              await setDoc(studentRef, { lastActiveDictation: currentCard.id }, { merge: true });
            } catch (error) {
              console.error("Lỗi đồng bộ Firebase:", error);
            }
          }
      } else {
          setIsCorrect(false);
      }
  };

  if (loadingUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="text-5xl animate-bounce">🐼</div>
          <p className="font-black text-emerald-800 tracking-wider">Đang tải không gian học tập...</p>
        </div>
      </div>
    );
  }

  // --- CẤP 1: CHỌN PHIÊN BẢN (GIÁO TRÌNH) ---
  if (step === "SELECT_CURRICULUM") {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-teal-50/50 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-10">
            <Link href="/">
              <button className="px-5 py-2.5 bg-white font-bold text-slate-700 rounded-2xl shadow-sm hover:shadow-md hover:bg-slate-50 transition border border-slate-200 cursor-pointer flex items-center gap-2">
                <span>←</span> Về Trang Chủ
              </button>
            </Link>
            <div className="flex items-center gap-2 bg-emerald-100 text-emerald-800 px-4 py-1.5 rounded-full text-xs font-black shadow-xs">
              ✨ Nền tảng luyện nghe thông minh
            </div>
          </div>

          <div className="text-center mb-10">
            <span className="text-5xl mb-3 inline-block">🎧</span>
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">Chọn Hệ Thống Luyện Nghe Chép</h1>
            <p className="text-slate-500 mt-2 font-medium">Lựa chọn giáo trình phù hợp để bắt đầu hành trình chinh phục tiếng Trung của bạn.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div 
              onClick={() => { setSelectedCurriculum("newhsk"); setStep("SELECT_HSK_LEVEL"); }}
              className="bg-white p-8 rounded-3xl shadow-md border-2 border-emerald-100 hover:border-emerald-500 hover:shadow-xl transition-all cursor-pointer flex flex-col items-center text-center group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] font-black px-4 py-1 rounded-bl-2xl uppercase tracking-wider">Khuyên dùng</div>
              <div className="w-20 h-20 bg-emerald-50 rounded-2xl flex items-center justify-center text-4xl mb-6 group-hover:scale-110 group-hover:rotate-3 transition duration-300">📚</div>
              <h3 className="text-2xl font-black text-slate-800 group-hover:text-emerald-700 transition mb-2">HSK Standard Course (3.0)</h3>
              <p className="text-slate-500 text-sm leading-relaxed">Giáo trình chuẩn mới nhất, từ vựng và cấu trúc cập nhật sát thực tế kỳ thi.</p>
            </div>

            <div 
              onClick={() => { setSelectedCurriculum("oldhsk"); setStep("SELECT_HSK_LEVEL"); }}
              className="bg-white p-8 rounded-3xl shadow-md border-2 border-blue-100 hover:border-blue-500 hover:shadow-xl transition-all cursor-pointer flex flex-col items-center text-center group relative overflow-hidden"
            >
              <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center text-4xl mb-6 group-hover:scale-110 group-hover:rotate-3 transition duration-300">📖</div>
              <h3 className="text-2xl font-black text-slate-800 group-hover:text-blue-700 transition mb-2">HSK 2.0 (Cũ)</h3>
              <p className="text-slate-500 text-sm leading-relaxed">Hệ thống giáo trình truyền thống quen thuộc, lý tưởng cho người tự học.</p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // --- CẤP 2: CHỌN CẤP ĐỘ HSK (TỰ ĐỘNG KIỂM TRA DATA ĐỂ HIỆN ĐANG UPDATE) ---
  if (step === "SELECT_HSK_LEVEL") {
    const hskLevels = [
      { level: "HSK 1", desc: "Cơ bản cấp độ 1", color: "from-emerald-500 to-teal-600" },
      { level: "HSK 2", desc: "Cơ bản cấp độ 2", color: "from-blue-500 to-indigo-600" },
      { level: "HSK 3", desc: "Trung cấp cấp độ 3", color: "from-amber-500 to-orange-600" },
      { level: "HSK 4", desc: "Trung cấp cấp độ 4", color: "from-rose-500 to-pink-600" },
      { level: "HSK 5", desc: "Cao cấp cấp độ 5", color: "from-purple-500 to-violet-600" },
      { level: "HSK 6", desc: "Cao cấp cấp độ 6", color: "from-slate-700 to-slate-900" },
    ];

    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/20 to-teal-50/40 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <button 
              onClick={() => setStep("SELECT_CURRICULUM")}
              className="px-4 py-2 bg-white font-bold text-slate-700 rounded-2xl shadow-sm hover:shadow transition border border-slate-200 cursor-pointer flex items-center gap-2"
            >
              <span>←</span> Quay lại chọn giáo trình
            </button>
            <div className="bg-emerald-600 text-white px-4 py-1.5 rounded-full text-xs font-black shadow-sm">
              {selectedCurriculum === "newhsk" ? "📚 HSK 3.0" : "📖 HSK 2.0"}
            </div>
          </div>

          <div className="mb-8 text-center sm:text-left">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Chọn Cấp Độ HSK</h2>
            <p className="text-slate-500 text-sm mt-1">Lựa chọn trình độ học tập phù hợp. Các cấp chưa có dữ liệu sẽ tự động hiển thị trạng thái đang cập nhật.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            {hskLevels.map((item) => {
              // Kiểm tra xem trong file dictation.json có câu nào thuộc cấp độ này không
              const countInLevel = dictationData.filter(d => {
                const matchesCurriculum = selectedCurriculum === "newhsk" ? d.audioUrl?.includes("newhsk") : (d.audioUrl?.includes("oldhsk") || !d.audioUrl?.includes("newhsk"));
                const matchesLevel = d.level?.toLowerCase().includes(item.level.toLowerCase()) || d.lesson?.toLowerCase().includes(item.level.toLowerCase());
                // Mặc định cho phép HSK 1 luôn có data mẫu nếu chưa nhập
                if (item.level === "HSK 1") return matchesCurriculum; 
                return matchesCurriculum && matchesLevel;
              }).length;

              const hasData = countInLevel > 0;

              return (
                <div 
                  key={item.level}
                  onClick={() => {
                    if (hasData) {
                      setSelectedHskLevel(item.level);
                      setStep("SELECT_LESSON");
                    }
                  }}
                  className={`rounded-3xl shadow-sm border transition-all duration-300 overflow-hidden group flex flex-col justify-between ${
                    hasData 
                      ? "bg-white border-slate-200/80 hover:shadow-xl hover:-translate-y-1.5 cursor-pointer" 
                      : "bg-slate-100 border-slate-200/60 opacity-75 cursor-not-allowed select-none"
                  }`}
                >
                  <div className={`p-6 bg-gradient-to-r ${hasData ? item.color : "from-slate-400 to-slate-500"} text-white relative`}>
                    <div className="absolute top-4 right-4 text-[10px] font-black uppercase tracking-wider bg-white/20 px-3 py-1 rounded-full backdrop-blur-xs">
                      {hasData ? item.level : "🔒 Đang update"}
                    </div>
                    <span className="text-xs font-bold uppercase tracking-widest opacity-80 block mb-1">Trình độ</span>
                    <h3 className="text-3xl font-black tracking-tight">{item.level}</h3>
                  </div>

                  <div className="p-6 flex flex-col gap-4">
                    <p className="text-slate-500 text-xs font-medium">
                      {hasData ? item.desc : "Nội dung bài học đang được biên soạn..."}
                    </p>

                    {hasData ? (
                      <div className="w-full py-2.5 bg-slate-50 group-hover:bg-emerald-600 group-hover:text-white text-slate-700 font-black text-xs rounded-2xl transition duration-300 text-center shadow-xs flex items-center justify-center gap-1">
                        Vào học cấp độ <span>→</span>
                      </div>
                    ) : (
                      <div className="w-full py-2.5 bg-slate-200 text-slate-400 font-bold text-xs rounded-2xl text-center">
                        Sắp ra mắt
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    );
  }

  // Lọc dữ liệu theo giáo trình và cấp độ HSK
  const filteredByCurriculum = dictationData.filter(item => {
    const isNew = selectedCurriculum === "newhsk" ? item.audioUrl?.includes("newhsk") : (item.audioUrl?.includes("oldhsk") || !item.audioUrl?.includes("newhsk"));
    const matchesLevel = item.level?.toLowerCase().includes(selectedHskLevel?.toLowerCase()) || item.lesson?.toLowerCase().includes(selectedHskLevel?.toLowerCase()) || selectedHskLevel === "HSK 1";
    return isNew && matchesLevel;
  });

  const lessonsMap = {};
  filteredByCurriculum.forEach(item => {
    const lessonKey = item.lesson ? item.lesson.split("-")[0].trim() : "Bài 1";
    if (!lessonsMap[lessonKey]) lessonsMap[lessonKey] = [];
    lessonsMap[lessonKey].push(item);
  });

  const totalStandardLessons = ["Bài 1", "Bài 2", "Bài 3", "Bài 4", "Bài 5", "Bài 6", "Bài 7", "Bài 8", "Bài 9", "Bài 10", "Bài 11", "Bài 12", "Bài 13", "Bài 14", "Bài 15"];

  // --- CẤP 3: CHỌN LESSON (BÀI HỌC) ---
  if (step === "SELECT_LESSON") {
    const cardGradients = [
      "from-emerald-500 to-teal-600",
      "from-indigo-500 to-purple-600",
      "from-amber-500 to-orange-600",
      "from-rose-500 to-pink-600",
      "from-cyan-500 to-blue-600",
      "from-violet-500 to-fuchsia-600"
    ];

    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/20 to-teal-50/40 py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <button 
              onClick={() => setStep("SELECT_HSK_LEVEL")}
              className="px-4 py-2 bg-white font-bold text-slate-700 rounded-2xl shadow-sm hover:shadow transition border border-slate-200 cursor-pointer flex items-center gap-2"
            >
              <span>←</span> Chọn lại cấp độ
            </button>
            <div className="bg-emerald-600 text-white px-4 py-1.5 rounded-full text-xs font-black shadow-sm flex items-center gap-1.5">
              <span>✨</span> {selectedHskLevel}
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-black text-slate-900">Danh Sách Bài Học ({selectedHskLevel})</h2>
            <p className="text-slate-500 text-sm">Chọn một bài học để khám phá các bài khóa luyện nghe chi tiết.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {totalStandardLessons.map((lessonName, index) => {
              const lessonCards = lessonsMap[lessonName] || [];
              const hasData = lessonCards.length > 0 || (selectedHskLevel === "HSK 1" && index < 2); // Mở sẵn vài bài đầu cho HSK 1 test
              const gradientColor = cardGradients[index % cardGradients.length];

              return (
                <div 
                  key={lessonName}
                  onClick={() => {
                    if (hasData) {
                      setSelectedLesson(lessonName);
                      setStep("SELECT_CARD"); 
                    }
                  }}
                  className={`rounded-3xl shadow-md border transition-all duration-300 flex flex-col justify-between overflow-hidden group ${
                    hasData 
                      ? "bg-white border-slate-200 hover:shadow-xl hover:-translate-y-1.5 cursor-pointer" 
                      : "bg-slate-100 border-slate-200/60 opacity-75 cursor-not-allowed select-none"
                  }`}
                >
                  <div className={`p-6 bg-gradient-to-r ${hasData ? gradientColor : "from-slate-400 to-slate-500"} text-white relative`}>
                    <div className="absolute top-4 right-4 text-[10px] font-black uppercase tracking-wider bg-white/20 px-3 py-1 rounded-full backdrop-blur-xs">
                      {hasData ? "Lesson" : "🔒 Đang update"}
                    </div>
                    <span className="text-3xl font-black opacity-80 block mb-1">0{index + 1}</span>
                    <h3 className="text-2xl font-black tracking-tight">{lessonName}</h3>
                  </div>

                  <div className="p-6 flex flex-col gap-4">
                    <div className="flex items-center gap-2 text-slate-500 text-xs font-bold">
                      {hasData ? (
                        <>
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                          🎧 {lessonCards.length > 0 ? `${lessonCards.length} bài khóa` : "Sẵn sàng nội dung"}
                        </>
                      ) : (
                        <>
                          <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                          ⏳ Nội dung đang cập nhật...
                        </>
                      )}
                    </div>

                    {hasData ? (
                      <div className="w-full py-3 bg-slate-50 group-hover:bg-emerald-600 group-hover:text-white text-slate-700 font-black text-xs rounded-2xl transition duration-300 text-center shadow-xs flex items-center justify-center gap-1">
                        Khám phá bài học <span>→</span>
                      </div>
                    ) : (
                      <div className="w-full py-3 bg-slate-200 text-slate-400 font-bold text-xs rounded-2xl text-center">
                        Sắp ra mắt
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    );
  }

  // --- CẤP 4: HIỂN THỊ DANH SÁCH BÀI KHÓA ---
  if (step === "SELECT_CARD") {
    let cardsInLesson = lessonsMap[selectedLesson] || [];
    if (cardsInLesson.length === 0) {
      cardsInLesson = [
        { id: `${selectedLesson}-1`, lesson: `${selectedLesson} - Câu 1`, audioUrl: "/audio/newhsk/hsk1_new/1-1.mp3", fullText: "你好！" },
        { id: `${selectedLesson}-3`, lesson: `${selectedLesson} - Câu 3`, audioUrl: "/audio/newhsk/hsk1_new/1-3.mp3", fullText: "很高兴认识你。" },
        { id: `${selectedLesson}-5`, lesson: `${selectedLesson} - Câu 5`, audioUrl: "/audio/newhsk/hsk1_new/1-5.mp3", fullText: "再见！" }
      ];
    }

    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/20 to-teal-50/40 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <button 
              onClick={() => setStep("SELECT_LESSON")}
              className="px-4 py-2.5 bg-white font-bold text-slate-700 rounded-2xl shadow-sm hover:shadow-md transition border border-slate-200 cursor-pointer flex items-center gap-2 group"
            >
              <span className="group-hover:-translate-x-1 transition-transform">←</span> Danh sách bài học
            </button>
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-5 py-2 rounded-2xl font-black text-sm shadow-md flex items-center gap-2">
              <span>✨</span> {selectedHskLevel} - {selectedLesson}
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Danh Sách Bài Khóa</h2>
            <p className="text-slate-500 text-sm mt-1">Lựa chọn một bài khóa bên dưới để bắt đầu luyện nghe chép và phản xạ.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {cardsInLesson.map((card, idx) => (
              <div 
                key={card.id || idx}
                onClick={() => {
                  setCurrentCard(card);
                  setUserInput("");
                  setIsCorrect(null);
                  setShowAnswer(false);
                  setStep("DO_DICTATION");
                }}
                className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200/80 hover:border-emerald-500 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer flex justify-between items-center group relative overflow-hidden"
              >
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>

                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-100 text-emerald-700 flex items-center justify-center font-black text-base group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white transition duration-300 shadow-xs">
                    0{idx + 1}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-lg group-hover:text-emerald-700 transition">
                      Bài khóa {idx + 1}
                    </h4>
                    <p className="text-xs text-slate-400 font-medium mt-0.5 flex items-center gap-1">
                      <span>🎧</span> Bấm để bắt đầu luyện nghe
                    </p>
                  </div>
                </div>

                <div className="w-11 h-11 rounded-2xl bg-slate-50 group-hover:bg-emerald-500 group-hover:text-white text-slate-400 flex items-center justify-center transition duration-300 shadow-xs">
                  <span className="text-sm font-black ml-0.5">▶</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  // --- CẤP 5: GIAO DIỆN LÀM BÀI CHI TIẾT (DO DICTATION) ---
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/20 to-teal-50/40 py-10 px-4 flex flex-col justify-center">
      <div className="max-w-2xl mx-auto w-full bg-white p-8 sm:p-10 rounded-3xl shadow-xl border-t-8 border-emerald-500 flex flex-col items-center relative overflow-hidden">
        
        <div className="w-full flex justify-between items-center mb-6">
          <button 
            onClick={() => { setStep("SELECT_CARD"); setCurrentCard(null); }}
            className="px-3.5 py-2 bg-slate-100 font-bold text-slate-600 rounded-xl hover:bg-slate-200 transition text-xs cursor-pointer flex items-center gap-1"
          >
            ← Danh sách bài khóa
          </button>
          <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full uppercase tracking-wider border border-emerald-100">{selectedHskLevel} - {selectedLesson}</span>
        </div>

        {currentCard ? (
          <div className="w-full flex flex-col items-center animate-fade-in">
            <h3 className="text-xl font-black text-slate-800 mb-6 text-center">{currentCard.lesson}</h3>
            
            <div className="w-full mb-6 bg-gradient-to-r from-emerald-50 to-teal-50 p-5 rounded-2xl border border-emerald-100/80 shadow-sm flex flex-col items-center">
              <audio 
                ref={audioRef}
                src={currentCard.audioUrl}
                controls
                className="w-full accent-emerald-600"
              />
              <span className="text-xs font-semibold text-emerald-800/70 mt-2.5 flex items-center gap-1.5">
                💡 Mẹo: Nghe kỹ và tua lại thoải mái trước khi gõ chữ Hán.
              </span>
            </div>
            
            <input 
                ref={inputRef}
                type="text"
                value={userInput}
                onChange={(e) => {
                    setUserInput(e.target.value);
                    setIsCorrect(null);
                }}
                onKeyDown={(e) => { if (e.key === 'Enter' && userInput.trim() && !isCorrect) checkAnswer(); }}
                placeholder="Gõ chữ Hán vào đây..."
                className={`w-full text-center text-2xl font-medium p-4 rounded-2xl border-2 outline-none transition-all mb-4 shadow-inner ${
                    isCorrect === true ? 'border-emerald-500 bg-emerald-50/50 text-emerald-700' :
                    isCorrect === false ? 'border-rose-400 bg-rose-50/50 text-rose-700 animate-shake' :
                    'border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 text-slate-800'
                }`}
                disabled={isCorrect}
            />

            {isCorrect === false && (
                <div className="w-full p-3.5 mb-4 bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl text-center font-bold text-sm animate-bounce flex items-center justify-center gap-2">
                  <span>❌</span> Chưa chính xác, hãy nghe kỹ âm thanh và thử lại nhé!
                </div>
            )}

            {isCorrect === true && (
                <div className="w-full mb-6 p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-center animate-fade-in shadow-sm">
                    <p className="font-black text-2xl text-emerald-700 mb-1">✨ Chính xác hoàn toàn!</p>
                    <p className="text-xl text-slate-800 font-bold mt-2">{currentCard.fullText}</p>
                </div>
            )}

            {!isCorrect ? (
                <button 
                    onClick={checkAnswer}
                    disabled={!userInput.trim()}
                    className="w-full py-4 rounded-2xl font-black text-base shadow-lg bg-slate-900 text-white hover:bg-slate-800 transition disabled:opacity-50 cursor-pointer uppercase tracking-wider"
                >
                    Kiểm tra đáp án
                </button>
            ) : (
                <button 
                    onClick={() => { setUserInput(""); setIsCorrect(null); setShowAnswer(false); setStep("SELECT_CARD"); }}
                    className="w-full py-4 rounded-2xl font-black text-base shadow-lg bg-emerald-600 text-white hover:bg-emerald-700 transition cursor-pointer uppercase tracking-wider flex items-center justify-center gap-2"
                >
                    Tiếp tục học bài khóa khác ➔
                </button>
            )}

            {!isCorrect && (
                <div className="mt-6 text-center">
                    <button 
                        onClick={() => setShowAnswer(!showAnswer)}
                        className="text-slate-400 font-bold hover:text-emerald-600 transition text-xs cursor-pointer underline underline-offset-4"
                    >
                        {showAnswer ? "Ẩn đáp án gốc" : "Nghe không ra? Bấm để xem đáp án gốc"}
                    </button>
                    
                    {showAnswer && (
                        <div className="mt-3 p-4 bg-slate-100 rounded-2xl text-slate-800 font-black text-xl animate-fade-in border border-slate-200">
                            {currentCard.fullText}
                        </div>
                    )}
                </div>
            )}
          </div>
        ) : null}

      </div>
    </main>
  );
}