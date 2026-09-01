"use client";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";

export default function HskkPage() {
  const [hskkLevel, setHskkLevel] = useState("HSK Cấp 3");
  const [examQuestions, setExamQuestions] = useState([]); 
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [examAnswers, setExamAnswers] = useState([]); 
  
  const [examState, setExamState] = useState("idle"); 
  const [timeLeft, setTimeLeft] = useState(0);
  const [spokenText, setSpokenText] = useState("");
  const [hskkFinalResult, setHskkFinalResult] = useState(null);
  
  const recognitionRef = useRef(null);

  const speak = (text) => {
    window.speechSynthesis.cancel(); 
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN"; 
    utterance.rate = 0.8; 
    window.speechSynthesis.speak(utterance);
  };

  const getTimesForType = (type) => {
    switch(type) {
      case 'repeat': return { prep: 10, speak: 30 };
      case 'retell': return { prep: 45, speak: 90 };
      case 'picture': return { prep: 60, speak: 120 };
      case 'short': return { prep: 60, speak: 120 };
      default: return { prep: 30, speak: 60 };
    }
  };

  useEffect(() => {
    let timer;
    if ((examState === "prep" || examState === "speaking") && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (timeLeft === 0 && (examState === "prep" || examState === "speaking")) {
      const currentQ = examQuestions[currentQIndex];
      if (!currentQ) return;
      if (examState === "prep") {
        setExamState("speaking");
        setTimeLeft(getTimesForType(currentQ.type).speak);
        startRecording();
      } else if (examState === "speaking") {
        handleNextQuestion(spokenText);
      }
    }
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examState, timeLeft, spokenText, currentQIndex, examQuestions]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const generateHskkExam = async () => {
    setExamState("scoring");
    setExamAnswers([]); setSpokenText(""); setHskkFinalResult(null); 
    
    try {
      const res = await fetch('/api/hskk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: "generate", level: hskkLevel })
      });
      const data = await res.json();
      if(data.error) throw new Error(data.error);

      const fullExam = data.map(q => q.type === 'picture' ? { ...q, image: `https://picsum.photos/seed/${Math.random()}/800/400` } : q);
      setExamQuestions(fullExam);
      setCurrentQIndex(0);
      setExamState("prep");
      setTimeLeft(getTimesForType(fullExam[0].type).prep);
    } catch (e) {
      alert("Lỗi AI ra đề thi! Hãy kiểm tra lại API Key.");
      setExamState("idle");
    }
  };

  const startRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.continuous = true; 
    recognition.interimResults = false;
    
    recognition.onresult = (e) => {
      let currentTranscript = "";
      for (let i = e.resultIndex; i < e.results.length; ++i) {
        currentTranscript += e.results[i][0].transcript;
      }
      setSpokenText(prev => prev ? prev + "，" + currentTranscript : currentTranscript); 
    };
    
    recognition.start();
    recognitionRef.current = recognition;
  };

  const stopRecording = () => {
    if (recognitionRef.current) recognitionRef.current.stop();
  };

  const handleNextQuestion = (currentText) => {
    stopRecording();
    const currentQ = examQuestions[currentQIndex];
    const newAnswers = [...examAnswers, { type: currentQ.type, question: currentQ.text, answer: currentText || "(Không trả lời)" }];
    setExamAnswers(newAnswers);
    setSpokenText("");

    if (currentQIndex < examQuestions.length - 1) {
      const nextQIndex = currentQIndex + 1;
      setCurrentQIndex(nextQIndex);
      setExamState("prep");
      setTimeLeft(getTimesForType(examQuestions[nextQIndex].type).prep);
    } else {
      submitFullExam(newAnswers);
    }
  };

  const submitFullExam = async (allAnswers) => {
    setExamState("scoring");
    try {
      const res = await fetch('/api/hskk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: "grade", level: hskkLevel, answers: allAnswers })
      });
      const data = await res.json();
      setHskkFinalResult(data);
    } catch (error) {
      alert("Lỗi chấm điểm bài thi!");
    } finally {
      setExamState("done");
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center py-10 bg-slate-50 px-4">
      <div className="w-full max-w-4xl flex justify-between items-center mb-8">
        <Link href="/">
          <button className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl shadow-sm hover:bg-slate-100 transition flex items-center gap-2">
            <span>←</span> Về Trang Chủ
          </button>
        </Link>
        <h1 className="text-3xl font-extrabold text-slate-800">Phòng Khảo Thí HSKK</h1>
      </div>

      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-xl border-t-8 border-rose-600 p-8">
        {examState === "idle" && (
          <div className="text-center py-10">
            <div className="mb-8">
              <select 
                value={hskkLevel} 
                onChange={(e) => setHskkLevel(e.target.value)} 
                className="border-2 border-rose-200 text-rose-800 rounded-lg px-6 py-3 text-xl font-bold outline-none cursor-pointer"
              >
                <option value="HSK Cấp 3">HSKK Sơ Cấp (Cấp 3)</option>
                <option value="HSK Cấp 4">HSKK Trung Cấp (Cấp 4)</option>
                <option value="HSK Cấp 5">HSKK Cao Cấp (Cấp 5)</option>
                <option value="HSK Cấp 6">HSKK Cao Cấp (Cấp 6)</option>
              </select>
            </div>
            <div className="py-12 border-2 border-dashed border-rose-200 rounded-2xl bg-rose-50/50">
              <p className="text-slate-600 font-medium text-lg mb-2">Bài thi mô phỏng sẽ diễn ra liên tục không ngừng.</p>
              <p className="text-rose-600 font-bold mb-6">Hết thời gian đếm ngược, hệ thống tự động ngắt mic và chuyển câu.</p>
              <button onClick={generateHskkExam} className="px-10 py-5 bg-rose-600 text-white font-bold text-2xl rounded-2xl shadow-xl hover:bg-rose-700 hover:scale-105 transition-all">
                🚀 Bắt Đầu Thi
              </button>
            </div>
          </div>
        )}

        {examState === "scoring" && !hskkFinalResult && (
           <div className="text-center py-24 flex flex-col items-center">
             <div className="w-16 h-16 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mb-6"></div>
             <h2 className="text-3xl font-bold text-rose-600">Hệ thống đang xử lý qua AI...</h2>
           </div>
        )}

        {(examState === "prep" || examState === "speaking") && examQuestions.length > 0 && (
          <div className="flex flex-col gap-6">
            <div className="flex justify-between items-center bg-slate-100 p-4 rounded-xl">
               <span className="font-bold text-slate-500 tracking-widest uppercase">
                 Câu hỏi {currentQIndex + 1} / {examQuestions.length}
               </span>
               <span className="px-4 py-1 bg-white rounded-md text-rose-600 font-bold shadow-sm">
                 {examQuestions[currentQIndex].type === "repeat" ? "Nghe Nhắc Lại" : examQuestions[currentQIndex].type === "retell" ? "Nghe Thuật Lại" : examQuestions[currentQIndex].type === "picture" ? "Nhìn Tranh" : "Trả Lời Câu Hỏi"}
               </span>
            </div>

            <div className={`p-6 text-center rounded-2xl border-4 transition-all ${examState === "prep" ? "bg-blue-50 border-blue-200" : "bg-red-50 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.2)]"}`}>
              <p className={`font-black uppercase tracking-widest text-lg mb-2 ${examState === "prep" ? "text-blue-500" : "text-red-500 animate-pulse"}`}>
                {examState === "prep" ? "THỜI GIAN NHÁP Ý" : "🎙️ MICRO ĐANG MỞ - BẮT ĐẦU NÓI!"}
              </p>
              <p className={`text-7xl font-black font-mono ${examState === "prep" ? "text-blue-700" : "text-red-600"}`}>
                {formatTime(timeLeft)}
              </p>
            </div>

            <div className="text-center py-4">
              {examQuestions[currentQIndex].type === "picture" ? (
                <div className="flex flex-col items-center">
                  <img src={examQuestions[currentQIndex].image} alt="HSKK" className="max-w-[500px] w-full rounded-2xl shadow-md border-4 border-slate-200 mb-6" />
                  <h3 className="text-2xl font-bold text-rose-900">{examQuestions[currentQIndex].text}</h3>
                </div>
              ) : (examQuestions[currentQIndex].type === "repeat" || examQuestions[currentQIndex].type === "retell") ? (
                <div className="flex flex-col items-center py-6">
                  <button onClick={() => speak(examQuestions[currentQIndex].text)} className="w-28 h-28 bg-rose-100 text-rose-600 rounded-full text-6xl shadow-md mb-6 hover:bg-rose-200 transition-colors animate-bounce">🔊</button>
                  <p className="text-slate-500 font-medium">Bấm vào biểu tượng loa để nghe lại câu hỏi.</p>
                </div>
              ) : (
                <div>
                  <h3 className="text-4xl font-bold text-rose-900 leading-normal mb-6">{examQuestions[currentQIndex].text}</h3>
                  <button onClick={() => speak(examQuestions[currentQIndex].text)} className="w-16 h-16 inline-flex items-center justify-center bg-rose-50 text-rose-600 rounded-full text-3xl shadow-sm hover:bg-rose-100">🔊</button>
                </div>
              )}
            </div>

            {examState === "speaking" && (
              <div className="flex flex-col animate-fade-in-up">
                <p className="text-xs font-bold text-slate-400 uppercase mb-2">Băng ghi âm trực tiếp (Có thể gõ đè nếu hệ thống nghe sai)</p>
                <textarea rows="4" value={spokenText} onChange={(e) => setSpokenText(e.target.value)} className="w-full px-5 py-4 rounded-xl border-2 border-red-200 focus:border-red-500 focus:outline-none text-xl bg-white shadow-inner" />
                
                <button onClick={() => handleNextQuestion(spokenText)} className="mt-6 w-full bg-slate-800 text-white font-bold py-5 text-xl rounded-xl shadow-xl hover:scale-[1.02] hover:bg-slate-900 transition-all">
                  {currentQIndex < examQuestions.length - 1 ? "Bỏ Qua Thời Gian Chờ ➔ Chuyển Câu Tiếp" : "📝 Hoàn Thành Bài Thi"}
                </button>
              </div>
            )}
          </div>
        )}

        {examState === "done" && hskkFinalResult && (
          <div className="flex flex-col gap-6 animate-fade-in">
            <div className="p-8 rounded-3xl bg-gradient-to-br from-slate-800 to-slate-900 text-white text-center shadow-2xl relative overflow-hidden">
              <h3 className="text-2xl font-bold text-slate-300 mb-2">ĐIỂM TỔNG KẾT HSKK</h3>
              <div className={`text-9xl font-black mb-4 ${hskkFinalResult.totalScore >= 80 ? 'text-green-400' : hskkFinalResult.totalScore >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                {hskkFinalResult.totalScore}
              </div>
              <p className="text-xl leading-relaxed text-slate-200 font-medium px-4">{hskkFinalResult.overallFeedback}</p>
            </div>

            <h4 className="text-2xl font-black text-slate-800 mt-4 border-b-2 border-slate-100 pb-4">Chi tiết từng câu hỏi:</h4>
            
            <div className="flex flex-col gap-4">
              {hskkFinalResult.details?.map((detail, idx) => (
                <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex gap-6 items-start">
                  <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-slate-100 flex flex-col items-center justify-center font-bold text-slate-700">
                    <span className="text-xs text-slate-400 uppercase">Điểm</span>
                    <span className="text-2xl">{detail.score}</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-slate-400 mb-2 font-bold uppercase">Câu hỏi gốc / Chủ đề</p>
                    <p className="text-lg font-bold text-slate-800 mb-4 bg-slate-50 p-3 rounded-lg">{detail.question}</p>
                    <p className="text-slate-600 leading-relaxed"><span className="font-bold text-rose-600">Nhận xét:</span> {detail.feedback}</p>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={() => setExamState("idle")} className="mt-8 w-full py-5 bg-rose-600 text-white rounded-xl font-bold text-xl shadow-xl hover:bg-rose-700 transition-colors">
              🔄 Thi Lại Đề Khác
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
