"use client";
import { useState, useEffect, useRef } from "react";
import { useUser, useAuth, UserButton } from "@clerk/nextjs";
import { db } from "../../firebase";
import { doc, getDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";
import Link from "next/link";

// Import dữ liệu lấy trực tiếp từ arrange và sentences
import arrangeData from "../arrange.json";    
import sentencesData from "../sentences.json"; 

// --- HÀM HỖ TRỢ CƠ BẢN ---
function shuffleArray(array) {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
}

function getRandomItems(arr, n) {
  if (!arr || !Array.isArray(arr)) return [];
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, n);
}

const segmentWords = (text) => {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' });
    return [...segmenter.segment(text)]
      .map(s => s.segment)
      .filter(s => !/^[.,?!。，？！、\s]+$/.test(s)); 
  }
  return text.replace(/[.!?。，？！、\s]/g, '').split(''); 
};

// Hàm phát Audio dùng AI đọc nếu không có link file
const playAudio = (item) => {
  if (item.audioUrl) {
    new Audio(item.audioUrl).play();
  } else if (item.audio) {
    new Audio(item.audio).play();
  } else {
    // Dùng Text-to-Speech đọc trường chinese lấy từ arrange.json
    const textToSpeak = item.chinese || item.front || item.text || item.sentence || "没有文本";
    const ut = new SpeechSynthesisUtterance(textToSpeak);
    ut.lang = 'zh-CN';
    window.speechSynthesis.speak(ut);
  }
};

// --- COMPONENT: SẮP XẾP CÂU CLICK-TO-SELECT ---
function ArrangeQuestion({ item, index, onChange }) {
  const [available, setAvailable] = useState([]);
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    const words = segmentWords(item.chinese || item.front || "");
    const initialScrambled = shuffleArray([...words]).map((w, i) => ({ id: i, text: w }));
    setAvailable(initialScrambled);
    setSelected([]);
  }, [item]);

  useEffect(() => {
    onChange(selected.map(s => s.text).join(""));
  }, [selected]);

  const handleSelect = (word) => {
    setAvailable(available.filter(w => w.id !== word.id));
    setSelected([...selected, word]);
  };

  const handleDeselect = (word) => {
    setSelected(selected.filter(w => w.id !== word.id));
    setAvailable([...available, word]);
  };

  return (
    <div className="bg-[#EEF5E9]/50 p-6 rounded-[24px] border border-[#8FD9A8]/40">
      <div className="flex items-start gap-3 mb-4">
        <span className="w-8 h-8 shrink-0 rounded-full bg-white text-[#2F8F6E] text-xs font-black flex items-center justify-center shadow-sm border border-[#8FD9A8]">{index + 1}</span>
        <div className="flex-1 w-full">
          <p className="text-xs font-black text-[#1B5E4B] uppercase tracking-widest mb-3">Sắp xếp các từ sau thành câu đúng:</p>
          
          <div className="min-h-[70px] p-5 bg-white border-2 border-dashed border-[#8FD9A8] rounded-2xl mb-4 flex flex-wrap gap-2 items-center transition-all shadow-inner">
            {selected.length === 0 && <span className="text-slate-400 text-sm font-medium italic opacity-70">Chạm vào từ bên dưới để ghép lên đây...</span>}
            {selected.map(w => (
              <button 
                key={w.id} onClick={() => handleDeselect(w)} 
                className="px-4 py-2 bg-[#8FD9A8]/30 text-[#1B5E4B] border border-[#8FD9A8] font-black rounded-xl shadow-sm text-lg hover:bg-[#FFF1F2] hover:text-[#BE123C] hover:border-[#FECDD3] hover:line-through transition-all"
              >{w.text}</button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 p-2 bg-[#F4F7F6] rounded-2xl border border-[#E2E8F0]">
            {available.map(w => (
              <button 
                key={w.id} onClick={() => handleSelect(w)} 
                className="px-4 py-2 bg-white border border-[#E2E8F0] text-[#2F8F6E] font-black rounded-xl shadow-sm text-lg hover:border-[#2F8F6E] hover:bg-[#2F8F6E] hover:text-white hover:-translate-y-1 transition-all"
              >{w.text}</button>
            ))}
            {available.length === 0 && <span className="text-slate-400 text-sm font-bold w-full text-center py-2 opacity-60">Bạn đã dùng hết từ</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- COMPONENT: GHI ÂM (DÀNH CHO PHẦN THI NÓI & NGHE) ---
function AudioRecorder({ onRecord }) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      mediaRecorderRef.current.ondataavailable = (e) => chunksRef.current.push(e.data);
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => onRecord(reader.result);
        chunksRef.current = [];
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      alert("Vui lòng cấp quyền micro để ghi âm!");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
    }
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="flex items-center gap-3">
        {!isRecording ? (
          <button onClick={startRecording} className="bg-[#FFF1F2] text-[#BE123C] border border-[#FECDD3] px-4 py-2.5 rounded-xl font-black text-sm flex items-center gap-2 hover:bg-[#FECDD3] transition-colors shadow-sm w-fit">
            🎙️ Nhấn để ghi âm
          </button>
        ) : (
          <button onClick={stopRecording} className="bg-[#BE123C] text-white px-4 py-2.5 rounded-xl font-black text-sm flex items-center gap-2 animate-pulse shadow-md w-fit">
            ⏹️ Dừng ghi âm
          </button>
        )}
      </div>
      {audioUrl && (
        <div className="bg-[#F8FAFC] p-3 rounded-xl border border-[#E2E8F0] w-full max-w-sm">
          <span className="text-[10px] font-black uppercase tracking-widest text-[#64748B] block mb-1">Bản ghi của bạn:</span>
          <audio src={audioUrl} controls className="w-full h-8 outline-none" />
        </div>
      )}
    </div>
  );
}

// --- MAIN COMPONENT ---
export default function PlacementTestPage() {
  const { user, isLoaded } = useUser();
  const { userId } = useAuth();
  
  const [testMode, setTestMode] = useState(null); 
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [testData, setTestData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- STATE ĐỒNG BỘ XP/WATER TOÀN HỆ THỐNG ---
  const [hskXp, setHskXp] = useState(0);
  const [water, setWater] = useState(0);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    async function fetchGlobalData() {
      if (userId) {
        try {
          const userRef = doc(db, "users", userId);
          const userSnap = await getDoc(userRef);
          
          let currentXp = 0; let currentWater = 0; let currentStreak = 0;

          if (userSnap.exists()) {
            const data = userSnap.data();
            currentXp = data.xp || 0;
            currentWater = data.water || 0;
            currentStreak = data.streak || 0;
          }

          const newStudentRef = doc(db, "user_progress", userId);
          const newDocSnap = await getDoc(newStudentRef);
          if (newDocSnap.exists()) {
            const newData = newDocSnap.data();
            if (currentXp === 0) currentXp = newData.profile?.hsk_xp || 0;
            if (currentStreak === 0) currentStreak = newData.profile?.streak_days || 0;
          }

          setHskXp(currentXp); setWater(currentWater); setStreak(currentStreak);
        } catch (error) { console.error("Lỗi:", error); }
      }
    }
    if (isLoaded) fetchGlobalData();
  }, [userId, isLoaded, user]);

  const startLevelTest = async (level) => {
    setTestMode('level'); setSelectedLevel(level); setLoading(true);
    let levelStr = `HSK${level}`; let levelStrSpace = `HSK ${level}`;
    const filterByLevel = (item) => item.level === levelStr || item.level === levelStrSpace || item.level == level;

    const translateFiltered = arrangeData.filter(filterByLevel);
    const arrangeFiltered = sentencesData.filter(filterByLevel);

    const testPackage = {
      level: level, type: 'level',
      sections: {
        translate: getRandomItems(translateFiltered.length >= 10 ? translateFiltered : arrangeData, 10),
        arrange: getRandomItems(arrangeFiltered.length >= 10 ? arrangeFiltered : sentencesData, 10),
        essay: []
      }
    };

    if (level >= 3) {
      try {
        const shortData = await import(`@/app/data/hskk/hskk${level}/short.json`).catch(() => ({ default: [] }));
        const rawArr = shortData.default || [];
        testPackage.sections.essay = getRandomItems(rawArr, 2).map(item => typeof item === 'string' ? { prompt: item } : item);
      } catch (e) {
        testPackage.sections.essay = [
          { prompt: `Phần viết luận 1 (HSK ${level}): Hãy chia sẻ quan điểm của bạn bằng tiếng Trung.` },
          { prompt: `Phần viết luận 2 (HSK ${level}): Bạn nghĩ tiếng Trung giúp ích gì cho công việc của bạn?` }
        ];
      }
    }

    setTestData(testPackage); setAnswers({}); setResult(null); setLoading(false);
  };

  const startComprehensiveTest = async () => {
    setTestMode('comprehensive'); setLoading(true);
    
    const translateQuestions = [];
    const arrangeQuestions = [];
    const dictationQuestions = [];
    let pictureQuestions = [];
    const essayQuestions = [];

    // 1 & 2 & 3. Dịch, Sắp xếp, Nghe (HSK 1 - 6)
    for (let i = 1; i <= 6; i++) {
      let lvlStr = `HSK ${i}`; let lvlStr2 = `HSK${i}`;
      
      // Bốc 1 câu Dịch
      const transData = arrangeData.filter(item => item.level === lvlStr || item.level === lvlStr2 || item.level == i);
      if (transData.length > 0) translateQuestions.push({...getRandomItems(transData, 1)[0], originLevel: i});
      
      // Bốc 1 câu Sắp xếp
      const arrData = sentencesData.filter(item => item.level === lvlStr || item.level === lvlStr2 || item.level == i);
      if (arrData.length > 0) arrangeQuestions.push({...getRandomItems(arrData, 1)[0], originLevel: i});
      
      // Bốc 1 câu Nghe từ arrangeData thay vì dictation.json
      if (transData.length > 0) {
         dictationQuestions.push({...getRandomItems(transData, 1)[0], originLevel: i});
      } else {
         dictationQuestions.push({ chinese: `这是第${i}级的听力测试。`, vietnamese: `Đây là câu test nghe cấp độ ${i}.`, originLevel: i});
      }
    }

    // 4. Nhìn tranh nói (HSKK 3)
    try {
      const picData = await import(`@/app/data/hskk/hskk3/picture.json`).catch(()=>({default:[]}));
      if (picData.default && picData.default.length > 0) {
         pictureQuestions.push(...picData.default.map(item => ({...item, originLevel: 3})));
      } else {
         pictureQuestions.push({ images: ["https://placehold.co/400x300?text=Picture+Test"], originLevel: 3 });
      }
    } catch(e) {
      pictureQuestions.push({ images: ["https://placehold.co/400x300?text=Picture+Test"], originLevel: 3 });
    }

    // 5. Viết luận (HSKK 3 và HSKK 5)
    try {
      const essay3 = await import(`@/app/data/hskk/hskk3/short.json`).catch(()=>({default:[]}));
      if (essay3.default && essay3.default.length > 0) {
         let item = getRandomItems(essay3.default, 1)[0];
         essayQuestions.push({ prompt: typeof item === 'string' ? item : item.prompt, originLevel: 3});
      } else { essayQuestions.push({ prompt: "Bạn nghĩ gì về việc học trực tuyến?", originLevel: 3 }); }
      
      const essay5 = await import(`@/app/data/hskk/hskk5/short.json`).catch(()=>({default:[]}));
      if (essay5.default && essay5.default.length > 0) {
         let item = getRandomItems(essay5.default, 1)[0];
         essayQuestions.push({ prompt: typeof item === 'string' ? item : item.prompt, originLevel: 5});
      } else { essayQuestions.push({ prompt: "Bảo vệ môi trường có ý nghĩa như thế nào đối với sự phát triển kinh tế?", originLevel: 5 }); }
    } catch(e) {
      essayQuestions.push({ prompt: "Bạn nghĩ gì về việc học trực tuyến?", originLevel: 3 });
      essayQuestions.push({ prompt: "Bảo vệ môi trường có ý nghĩa như thế nào đối với sự phát triển kinh tế?", originLevel: 5 });
    }

    setTestData({
      type: 'comprehensive',
      sections: { 
        translate: translateQuestions,
        arrange: arrangeQuestions,
        dictation: dictationQuestions,
        picture: pictureQuestions,
        essay: essayQuestions
      }
    });
    setAnswers({}); setResult(null); setLoading(false);
  };

  const handleAnswerChange = (section, index, value) => {
    setAnswers(prev => ({ ...prev, [`${section}_${index}`]: value }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      if (!userId) {
        alert("Lỗi: Bạn chưa đăng nhập, không thể lưu bài thi!");
        setIsSubmitting(false);
        return;
      }

      const fallbackName = user?.primaryEmailAddress?.emailAddress?.split('@')[0] || "Học viên ẩn danh";
      const finalUserName = user?.fullName || fallbackName;

      const examsRef = collection(db, "test_submissions");
      await addDoc(examsRef, {
        userId: userId,
        userName: finalUserName,
        userEmail: user?.primaryEmailAddress?.emailAddress || "",
        testMode: testMode,
        level: selectedLevel || "Comprehensive",
        submittedAt: serverTimestamp(),
        status: "pending_teacher",
        teacherScore: null,
        teacherFeedback: null,
        testData: testData,
        answers: answers
      });

      setResult({ 
        status: "PENDING", 
        message: "Bài thi Đánh giá Năng lực toàn diện của bạn đã được gửi thành công. Giáo viên chuyên môn sẽ phân tích 4 kỹ năng (Nghe, Nói, Đọc, Viết) và phản hồi lại sớm nhất nhé!"
      });
      
    } catch (e) {
      alert("Hệ thống đang bảo trì, vui lòng thử lại sau!");
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- UI: MÀN HÌNH CHỌN CHẾ ĐỘ THI ---
  if (!testMode && !testData) {
    return (
      <main className="min-h-screen bg-[#F4F7F6] relative selection:bg-[#8FD9A8]/50">
        <div className="fixed inset-0 z-0 pointer-events-none">
           <div className="absolute inset-0 bg-[url('/hskk/kiemtra.jpg')] bg-cover bg-center opacity-10"></div>
           <div className="absolute inset-0 bg-[#EEF5E9]/90 backdrop-blur-[2px]"></div>
        </div>

        <header className="relative z-30 h-[76px] border-b border-[#8FD9A8]/30 bg-white/50 px-5 md:px-8 flex items-center justify-between backdrop-blur-xl">
          <Link href="/">
            <button className="flex items-center gap-2 rounded-2xl bg-white shadow-sm px-4 py-2.5 text-sm font-black text-[#1B5E4B] hover:bg-[#8FD9A8]/20 transition-all border border-[#E2E8F0] hover:border-[#8FD9A8]">
              ← Trở về Vườn
            </button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 rounded-2xl bg-white shadow-sm px-4 py-2.5 border border-slate-100"><span className="text-lg drop-shadow-sm">🔥</span><span className="text-xs font-black text-[#F2765B]">{streak} ngày</span></div>
            <div className="hidden sm:flex items-center gap-1.5 rounded-2xl bg-[#4FB6C7]/10 border border-[#4FB6C7]/30 shadow-sm px-4 py-2.5"><span className="text-lg drop-shadow-sm">💧</span><span className="text-xs font-black text-[#4FB6C7]">{water} giọt</span></div>
            <div className="flex items-center gap-1.5 rounded-2xl bg-[#FFD666]/20 border border-[#FFD666]/50 shadow-sm px-4 py-2.5"><span className="text-lg drop-shadow-sm">⭐</span><span className="text-xs font-black text-[#1B5E4B]">{hskXp.toLocaleString()} XP</span></div>
            {isLoaded && <UserButton afterSignOutUrl="/"/>}
          </div>
        </header>

        <div className="relative z-10 max-w-5xl mx-auto px-6 py-12 md:py-20 flex flex-col items-center animate-fade-in">
          <div className="text-center mb-12">
            <div className="w-20 h-20 bg-white rounded-[40%_60%_70%_30%/40%_50%_60%_50%] mx-auto flex items-center justify-center text-4xl mb-6 shadow-sm border border-[#8FD9A8]">🎯</div>
            <h1 className="text-4xl md:text-5xl font-black text-[#1B5E4B] tracking-tight mb-4 drop-shadow-sm">Đánh Giá Năng Lực</h1>
            <p className="text-[#2F8F6E] font-medium max-w-lg mx-auto leading-relaxed">Thực hiện bài kiểm tra để gửi về hệ thống. Giáo viên chuyên môn sẽ đánh giá trực tiếp năng lực của bạn.</p>
          </div>

          <div onClick={startComprehensiveTest} className="w-full max-w-2xl bg-[#1B5E4B] p-8 rounded-[32px] shadow-xl hover:shadow-2xl hover:-translate-y-2 transition-all cursor-pointer mb-10 flex items-center gap-6 group border-b-[8px] border-[#2F8F6E]">
            <div className="w-20 h-20 bg-[#EEF5E9]/20 rounded-full flex items-center justify-center text-4xl shadow-inner group-hover:scale-110 transition-transform border border-white/20">📋</div>
            <div className="flex-1 text-left text-white">
              <h2 className="text-2xl font-black mb-2 flex items-center gap-2 drop-shadow-sm">Test Chẩn Đoán Toàn Diện <span className="bg-[#F2765B] text-white text-[10px] px-2 py-0.5 rounded uppercase tracking-widest shadow-sm">Khuyên dùng</span></h2>
              <p className="text-[#8FD9A8] text-sm font-medium">Đánh giá 4 Kỹ năng: Nghe, Nói, Đọc, Viết rút ngẫu nhiên từ 6 cấp độ HSK.</p>
            </div>
          </div>

          <div className="w-full max-w-4xl text-left mb-6">
            <h3 className="font-black text-[#2F8F6E] uppercase tracking-widest text-sm ml-2 bg-[#8FD9A8]/20 px-4 py-2 rounded-xl inline-block border border-[#8FD9A8]/40">Hoặc chọn bài thi theo cấp độ</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 w-full max-w-4xl">
            {[1, 2, 3, 4, 5, 6].map((lvl) => (
              <div key={lvl} onClick={() => startLevelTest(lvl)} className="bg-white p-6 rounded-[32px] shadow-sm border border-[#E2E8F0] hover:border-[#8FD9A8] hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group flex flex-col items-center text-center">
                <div className="w-14 h-14 bg-[#F4F7F6] rounded-[40%_60%_70%_30%/40%_50%_60%_50%] mb-4 flex items-center justify-center text-2xl group-hover:bg-[#EEF5E9] group-hover:border-[#8FD9A8] border border-transparent transition-colors">📘</div>
                <h2 className="text-2xl font-black text-[#1B5E4B] group-hover:text-[#2F8F6E] transition-colors mb-2">HSK {lvl}</h2>
                <p className="text-xs text-slate-500 font-bold bg-slate-50 px-3 py-1 rounded-lg">{lvl <= 2 ? "2 Phần (Dịch, Sắp xếp)" : "3 Phần (Dịch, Xếp, Viết)"}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  // --- UI: LOADING ---
  if (loading || isSubmitting) {
    return (
      <div className="min-h-screen bg-[#EEF5E9] flex flex-col items-center justify-center relative selection:bg-[#8FD9A8]/50">
        <div className="w-16 h-16 border-[6px] border-[#2F8F6E] border-t-transparent rounded-full animate-spin mb-6"></div>
        <h3 className="text-xl font-black text-[#1B5E4B] uppercase tracking-widest animate-pulse">
          {isSubmitting ? "Đang gửi bài lên hệ thống..." : "Hệ thống đang chuẩn bị đề..."}
        </h3>
      </div>
    );
  }

  // --- UI: KẾT QUẢ ĐÃ NỘP (PENDING) ---
  if (result && result.status === "PENDING") {
    return (
      <main className="min-h-screen bg-[#F4F7F6] flex flex-col items-center justify-center p-6 relative overflow-hidden selection:bg-[#8FD9A8]/50">
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat z-0 opacity-10" style={{ backgroundImage: "url('/hskk/kiemtra.jpg')" }}></div>
        <div className="absolute inset-0 bg-[#F4F7F6]/80 backdrop-blur-md"></div>
        
        <div className="bg-white p-10 md:p-14 rounded-[40px] shadow-2xl border border-white max-w-lg w-full text-center relative z-10 flex flex-col items-center animate-slide-up-fade">
          <div className="w-28 h-28 rounded-[40%_60%_70%_30%/40%_50%_60%_50%] bg-[#FFF8E8] flex items-center justify-center text-6xl shadow-inner border border-[#FFD666]/50 mb-6 relative">⏳</div>
          <h2 className="text-3xl font-black mb-2 drop-shadow-sm text-[#F59E0B]">Nộp bài thành công!</h2>
          <div className="p-6 rounded-[24px] w-full my-6 bg-[#F4F7F6] border border-[#E2E8F0]">
            <p className="text-[#1B5E4B] font-bold leading-relaxed text-sm">{result.message}</p>
          </div>
          <Link className="w-full" href="/">
            <button className="w-full px-6 py-4.5 bg-[#1B5E4B] text-white rounded-2xl font-black text-sm shadow-xl transition-colors uppercase tracking-widest border-b-[4px] hover:bg-[#2F8F6E] border-[#0F3F31]">Về Trang Chủ</button>
          </Link>
        </div>
      </main>
    );
  }

  // --- MÀN HÌNH LÀM BÀI CHÍNH ---
  const isHSK12 = testMode === 'level' ? selectedLevel <= 2 : true; 

  return (
    <main className="min-h-screen bg-[#F4F7F6] pb-20 relative selection:bg-[#8FD9A8]/50">
      <header className="bg-white/90 backdrop-blur-xl border-b border-[#E2E8F0] sticky top-0 z-30 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 h-20 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#EEF5E9] rounded-[40%_60%_70%_30%/40%_50%_60%_50%] flex items-center justify-center text-[#2F8F6E] text-2xl shadow-inner border border-[#8FD9A8]">🎯</div>
            <div>
              <h1 className="font-black text-[#1B5E4B] text-lg drop-shadow-sm">
                {testMode === 'level' ? `Bài Thi Năng Lực HSK ${selectedLevel}` : `Bài Test Tổng Hợp Toàn Diện`}
              </h1>
              <p className="text-[10px] font-bold text-[#2F8F6E] uppercase tracking-widest bg-[#8FD9A8]/20 px-2 py-0.5 rounded-md inline-block mt-1 border border-[#8FD9A8]/50">
                {testMode === 'comprehensive' ? "Đánh giá 4 kỹ năng" : (isHSK12 ? "2 Phần • Đọc, Dịch" : "3 Phần • Đọc, Dịch, Viết")}
              </p>
            </div>
          </div>
          <button 
            onClick={() => {
              if (window.confirm("Bạn có chắc chắn muốn thoát? Bài thi hiện tại sẽ không được lưu.")) {
                setTestMode(null); setSelectedLevel(null);
              }
            }} 
            className="px-4 py-2 bg-[#FFF1F2] text-[#BE123C] hover:bg-[#FECDD3] rounded-xl text-xs font-black transition-colors border border-[#FECDD3]/50 shadow-sm"
          >
            Thoát bài thi
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 mt-10 space-y-10 animate-fade-in">
        
        {/* ========================================================
            PHẦN 1: ĐỌC DỊCH (TRANSLATE)
            ======================================================== */}
        {testData?.sections?.translate && testData.sections.translate.length > 0 && (
          <div className="bg-white rounded-[40px] p-8 md:p-12 shadow-sm border border-[#E2E8F0]">
            <div className="flex items-center gap-3 mb-8 border-b border-[#F4F7F6] pb-5">
              <span className="text-3xl">📖</span>
              <div>
                <h3 className="text-2xl font-black text-[#1B5E4B]">Phần 1: Đọc Hiểu / Dịch Câu</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{testData.sections.translate.length} Câu</p>
              </div>
            </div>
            
            <div className="space-y-6">
              {testData.sections.translate.map((item, idx) => (
                <div key={`trans-${idx}`} className="bg-[#F4F7F6] p-6 md:p-8 rounded-[32px] border border-[#E2E8F0] shadow-sm">
                  <div className="flex items-start gap-4 mb-5">
                    <span className="w-8 h-8 shrink-0 rounded-full bg-[#1B5E4B] text-white text-sm font-black flex items-center justify-center shadow-md">{idx + 1}</span>
                    <p className="font-bold text-[#1B5E4B] text-lg mt-0.5 bg-white px-4 py-2 rounded-2xl shadow-sm border border-[#E2E8F0]">
                      {item.vietnamese || item.front}
                    </p>
                  </div>
                  <input 
                    type="text" placeholder="Nhập bản dịch tiếng Trung (Chữ Hán)..."
                    value={answers[`translate_${idx}`] || ""}
                    onChange={(e) => handleAnswerChange("translate", idx, e.target.value)}
                    className="w-full p-5 border-2 border-[#E2E8F0] rounded-2xl text-base outline-none focus:border-[#2F8F6E] focus:ring-4 focus:ring-[#8FD9A8]/20 bg-white font-medium text-[#1B5E4B] transition-all placeholder:text-slate-400 shadow-inner"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================
            PHẦN 2: NGỮ PHÁP (ARRANGE)
            ======================================================== */}
        {testData?.sections?.arrange && testData.sections.arrange.length > 0 && (
          <div className="bg-white rounded-[40px] p-8 md:p-12 shadow-sm border border-[#E2E8F0]">
            <div className="flex items-center gap-3 mb-8 border-b border-[#F4F7F6] pb-5">
              <span className="text-3xl">🧩</span>
              <div>
                <h3 className="text-2xl font-black text-[#1B5E4B]">Phần 2: Ngữ Pháp / Sắp Xếp Câu</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{testData.sections.arrange.length} Câu</p>
              </div>
            </div>
            
            <div className="space-y-6">
              {testData.sections.arrange.map((item, idx) => (
                <ArrangeQuestion 
                  key={`arr-${idx}`} 
                  index={idx} 
                  item={item} 
                  onChange={(val) => handleAnswerChange("arrange", idx, val)} 
                />
              ))}
            </div>
          </div>
        )}

        {/* ========================================================
            PHẦN 3: KỸ NĂNG NGHE (DICTATION / REPEAT) 
            ======================================================== */}
        {testMode === 'comprehensive' && testData?.sections?.dictation && testData.sections.dictation.length > 0 && (
          <div className="bg-white rounded-[40px] p-8 md:p-12 shadow-sm border border-[#E2E8F0]">
            <div className="flex items-center gap-3 mb-8 border-b border-[#F4F7F6] pb-5">
              <span className="text-3xl">🎧</span>
              <div>
                <h3 className="text-2xl font-black text-[#1B5E4B]">Phần 3: Kỹ năng Nghe (Nghe & Nhắc lại / Chép chính tả)</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{testData.sections.dictation.length} Câu</p>
              </div>
            </div>
            
            <div className="space-y-8">
              {testData.sections.dictation.map((item, idx) => (
                <div key={`dict-${idx}`} className="bg-[#F4F7F6] p-6 md:p-8 rounded-[32px] border border-[#E2E8F0] shadow-sm">
                  <div className="flex items-center justify-between mb-5 bg-white p-4 rounded-2xl border border-[#E2E8F0]">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-[#1B5E4B] text-white font-black flex items-center justify-center">{idx + 1}</span>
                      <p className="font-bold text-[#142033]">Bấm nghe audio và ghi âm nhắc lại.</p>
                    </div>
                    <button onClick={() => playAudio(item)} className="bg-[#EEF5E9] text-[#2F8F6E] px-4 py-2 rounded-xl font-black text-sm flex items-center gap-2 hover:bg-[#8FD9A8] transition-colors border border-[#8FD9A8]/50 shadow-sm">
                      🔊 Nghe Audio
                    </button>
                  </div>
                  
                  <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0]">
                    <AudioRecorder onRecord={(base64) => handleAnswerChange("dictation", idx, base64)} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================
            PHẦN 4: KỸ NĂNG NÓI (PICTURE)
            ======================================================== */}
        {testMode === 'comprehensive' && testData?.sections?.picture && testData.sections.picture.length > 0 && (
          <div className="bg-white rounded-[40px] p-8 md:p-12 shadow-sm border border-[#E2E8F0]">
            <div className="flex items-center gap-3 mb-8 border-b border-[#F4F7F6] pb-5">
              <span className="text-3xl">🗣️</span>
              <div>
                <h3 className="text-2xl font-black text-[#1B5E4B]">Phần 4: Kỹ năng Nói (Nhìn tranh miêu tả)</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{testData.sections.picture.length} Câu</p>
              </div>
            </div>
            
            <div className="space-y-8">
              {testData.sections.picture.map((item, idx) => (
                <div key={`pic-${idx}`} className="bg-[#F4F7F6] p-6 md:p-8 rounded-[32px] border border-[#E2E8F0] shadow-sm">
                  <div className="flex items-center gap-3 mb-5">
                    <span className="w-8 h-8 rounded-full bg-[#1B5E4B] text-white font-black flex items-center justify-center">{idx + 1}</span>
                    <p className="font-bold text-[#142033]">Miêu tả bức tranh sau bằng tiếng Trung:</p>
                  </div>
                  
                  {item.images && item.images.length > 0 && (
                    <div className="mb-6 flex justify-center bg-white p-4 rounded-2xl border border-[#E2E8F0]">
                      {item.images.map((img, i) => (
                        <img key={i} src={img} alt="đề bài" className="max-w-xs md:max-w-md w-full rounded-xl shadow-sm border border-[#E2E8F0] object-cover" />
                      ))}
                    </div>
                  )}

                  <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0]">
                    <AudioRecorder onRecord={(base64) => handleAnswerChange("picture", idx, base64)} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================
            PHẦN 5: KỸ NĂNG VIẾT (ESSAY)
            ======================================================== */}
        {testData?.sections?.essay && testData.sections.essay.length > 0 && (
          <div className="bg-white rounded-[40px] p-8 md:p-12 shadow-sm border border-[#E2E8F0]">
            <div className="flex items-center gap-3 mb-8 border-b border-[#F4F7F6] pb-5">
              <span className="text-3xl">📝</span>
              <div>
                <h3 className="text-2xl font-black text-[#1B5E4B]">{testMode === 'comprehensive' ? 'Phần 5: Kỹ năng Viết (Luận)' : 'Phần 3: Viết Luận / Phản Xạ'}</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{testData.sections.essay.length} Câu</p>
              </div>
            </div>
            
            <div className="space-y-8">
              {testData.sections.essay.map((item, idx) => (
                <div key={`essay-${idx}`} className="bg-[#F4F7F6] p-8 rounded-[32px] border border-[#E2E8F0] shadow-sm">
                  <div className="bg-[#1B5E4B] p-5 rounded-2xl shadow-md mb-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
                    <p className="font-bold text-white text-base leading-relaxed relative z-10 flex items-start gap-3">
                      <span className="bg-[#F2765B] text-white px-2 py-0.5 rounded text-sm font-black shrink-0 shadow-sm mt-0.5">Q{idx + 1}</span>
                      {item.prompt}
                    </p>
                  </div>
                  <textarea 
                    rows={5}
                    placeholder="Viết câu trả lời bằng tiếng Trung tại đây..."
                    value={answers[`essay_${idx}`] || ""}
                    onChange={(e) => handleAnswerChange("essay", idx, e.target.value)}
                    className="w-full p-6 border-2 border-[#E2E8F0] rounded-3xl text-base outline-none focus:border-[#2F8F6E] focus:ring-4 focus:ring-[#8FD9A8]/20 bg-white font-medium text-[#1B5E4B] transition-all resize-none placeholder:text-slate-400 shadow-inner leading-relaxed"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Nút Submit */}
        <div className="pt-8 pb-12 flex justify-center">
          <button 
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={`w-full md:w-auto md:min-w-[320px] py-5 px-10 text-white rounded-[24px] font-black shadow-xl transition-all text-lg tracking-widest flex items-center justify-center gap-3 uppercase border-b-[6px] ${isSubmitting ? 'bg-[#94A3B8] border-[#64748B] cursor-not-allowed' : 'bg-[#1B5E4B] border-[#0F3F31] shadow-[#8FD9A8]/40 hover:bg-[#2F8F6E] hover:-translate-y-1'}`}
          >
            {isSubmitting ? "Đang gửi..." : "✓ Nộp Bài"}
          </button>
        </div>

      </div>
    </main>
  );
}