"use client";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { doc, collection, addDoc, serverTimestamp, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "../../firebase";

export default function HskkPage() {
  const { user, isLoaded } = useUser();

  const [hskkLevel, setHskkLevel] = useState("HSK Cấp 3");
  const [examQuestions, setExamQuestions] = useState([]); 
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [examAnswers, setExamAnswers] = useState([]); 
  
  const [examPhase, setExamPhase] = useState("idle"); 
  const [timeLeft, setTimeLeft] = useState(0);
  const [hasPrepped, setHasPrepped] = useState(false);
  const [scratchpad, setScratchpad] = useState("");
  
  const [isSpeakerTested, setIsSpeakerTested] = useState(false);
  const [isMicTested, setIsMicTested] = useState(false);
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [testAudioUrl, setTestAudioUrl] = useState(null);

  const [levelAvailability, setLevelAvailability] = useState({
    "HSK Cấp 3": { available: true, desc: "Sơ cấp • 15 câu hỏi (Đủ 3 phần)" },
    "HSK Cấp 4": { available: false, desc: "Trung cấp • Đang cập nhật ngân hàng đề" },
    "HSK Cấp 5": { available: false, desc: "Cao cấp • Đang cập nhật ngân hàng đề" },
    "HSK Cấp 6": { available: false, desc: "Cao cấp • Đang cập nhật ngân hàng đề" }
  });

  const [myHistory, setMyHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [selectedHistoryExam, setSelectedHistoryExam] = useState(null);
  const [examAnswersDetail, setExamAnswersDetail] = useState([]);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const utteranceRef = useRef(null);

  const examConfig = {
    "HSK Cấp 3": { prepTime: 420, repeat: 10, picture: 15, short: 90 },
    "HSK Cấp 4": { prepTime: 600, repeat: 40, picture: 120, short: 120 },
    "HSK Cấp 5": { prepTime: 600, repeat: 90, picture: 120, short: 150 },
    "HSK Cấp 6": { prepTime: 600, repeat: 90, picture: 120, short: 150 }
  };

  const introScripts = {
    "HSK Cấp 3": "欢迎参加汉语水平考试（HSK）三级口语考试！本次考试分为三个部分，共十五题。第一部分是听后重复，共八题。第二部分是看图说话，共五题。第三部分是回答问题，共两题。全部考试时间为十五分钟，其中包含准备时间六分钟。请做好准备。现在，考试开始。",
    "HSK Cấp 4": "欢迎参加汉语水平考试（HSK）四级口语考试！本次考试分为三个部分，共五题。第一部分是听后复述，共两题。第二部分是看图说话，共一题。第三部分是回答问题，共两题。全部考试时间为二十分钟，其中包含准备时间十分钟。请做好准备。现在，考试开始。",
    "HSK Cấp 5": "欢迎参加汉语水平考试（HSK）五级口语考试！本次考试分为三个部分，共五题。第一部分是听后复述，共两题。第二部分是看图说话，共一题。第三部分是回答问题，共两题。全部考试时间为二十三分钟，其中包含准备时间十分钟。请做好准备。现在，考试开始。",
    "HSK Cấp 6": "欢迎参加汉语水平考试（HSK）六级口语考试！本次考试分为三个部分，共五题。第一部分是听后复述，共两题。第二部分是看图说话，共一题。第三部分是回答问题，共两题。全部考试时间为二十三分钟，其中包含准备时间十分钟。请做好准备。现在，考试开始。"
  };

  useEffect(() => {
    async function fetchMyHistory() {
      if (!user) return;
      try {
        const q = query(
          collection(db, "hskk_exams"),
          where("userId", "==", user.id),
          orderBy("submittedAt", "desc")
        );
        const querySnapshot = await getDocs(q);
        const list = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setMyHistory(list);
      } catch (err) {
        console.error("Lỗi tải lịch sử:", err);
      } finally {
        setLoadingHistory(false);
      }
    }

    if (isLoaded && user) {
      fetchMyHistory();
    } else if (isLoaded && !user) {
      setLoadingHistory(false);
    }
  }, [user, isLoaded]);

  const openExamDetail = async (exam) => {
    setSelectedHistoryExam(exam);
    try {
      const answersRef = collection(db, "hskk_exams", exam.id, "answers");
      const snap = await getDocs(answersRef);
      const details = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      details.sort((a, b) => a.questionIndex - b.questionIndex);
      setExamAnswersDetail(details);
    } catch (err) {
      console.error("Lỗi lấy chi tiết bài thi:", err);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
    }
  }, []);

  const speak = (text, onEndCallback = () => {}) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      onEndCallback();
      return;
    }

    window.speechSynthesis.cancel(); 
    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(text);
      utteranceRef.current = utterance;
      utterance.lang = "zh-CN"; 
      utterance.rate = 0.85; 

      const voices = window.speechSynthesis.getVoices();
      const premiumVoice = voices.find(v => v.name.includes("Xiaoxiao")) 
                          || voices.find(v => v.name.includes("Google") && v.lang.includes("zh-CN"))
                          || voices.find(v => v.name.includes("Yaoyao"))
                          || voices.find(v => v.lang.includes("zh") || v.lang.includes("ZH"));
      
      if (premiumVoice) {
        utterance.voice = premiumVoice;
      }

      let isFinished = false;
      const safeEndCallback = () => {
        if (!isFinished) {
          isFinished = true;
          utteranceRef.current = null; 
          onEndCallback();
        }
      };

      utterance.onend = safeEndCallback;
      utterance.onerror = safeEndCallback; 
      window.speechSynthesis.speak(utterance);

      const safeTimeoutMs = (text.length * 250) + 3000;
      setTimeout(() => {
        safeEndCallback();
      }, safeTimeoutMs);
    }, 100);
  };

  const testSpeaker = () => {
    speak("欢迎参加汉语水平考试。设备测试。");
  };

  const testMic = async () => {
    setIsTestingMic(true);
    setTestAudioUrl(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { 
        mimeType: 'audio/webm',
        audioBitsPerSecond: 16000 
      });
      const chunks = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setTestAudioUrl(url);
        stream.getTracks().forEach(track => track.stop());
        setIsTestingMic(false);
      };

      mediaRecorder.start();
      
      setTimeout(() => {
        if (mediaRecorder.state !== "inactive") {
          mediaRecorder.stop();
        }
      }, 3000);

    } catch (err) {
      console.error("Lỗi truy cập Micro:", err);
      alert("Không thể truy cập Micro. Vui lòng cấp quyền trong cài đặt trình duyệt!");
      setIsTestingMic(false);
    }
  };

  useEffect(() => {
    let timer;
    if (["intro_countdown", "speaking", "global_prep"].includes(examPhase) && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (timeLeft === 0) {
      if (examPhase === "intro_countdown") {
        setCurrentQIndex(0);
        startQuestionLogic(0, false); 
      } else if (examPhase === "global_prep") {
        startQuestionLogic(currentQIndex, true);
      } else if (examPhase === "speaking") {
        stopRecordingAndNext();
      }
    }
    return () => clearInterval(timer);
  }, [examPhase, timeLeft, currentQIndex, hasPrepped]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const startExamSequence = async () => {
    setExamPhase("loading");
    setExamAnswers([]); 
    setHasPrepped(false); 
    setScratchpad("");
    setExamQuestions([]);
    
    try {
      const res = await fetch('/api/hskk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: "generate", level: hskkLevel })
      });
      const data = await res.json();
      if(data.error) throw new Error(data.error);

      let fullExam = data.map(q => {
        if (q.type === 'picture') {
          const images = q.images ? q.images : (q.image ? [q.image] : []);
          return { ...q, images };
        }
        return q;
      });
      
      const typeOrder = { 'repeat': 1, 'picture': 2, 'short': 3 };
      fullExam.sort((a, b) => (typeOrder[a.type] || 4) - (typeOrder[b.type] || 4));
      
      setExamQuestions(fullExam);

      setExamPhase("intro");
      const introText = introScripts[hskkLevel] || introScripts["HSK Cấp 3"];
      
      speak(introText, () => {
        setExamPhase("intro_countdown");
        setTimeLeft(10);
      });
    } catch (e) {
      alert("Lỗi AI ra đề thi! Vui lòng thử lại.");
      setExamPhase("idle");
    }
  };

  const startQuestionLogic = (index, prepped = hasPrepped, questions = examQuestions) => {
    const q = questions[index];
    if (!q) return;

    if (q.type !== 'repeat' && !prepped) {
      setExamPhase("global_prep");
      setTimeLeft(examConfig[hskkLevel].prepTime);
      setHasPrepped(true);
      return;
    }

    if (q.type === 'repeat' || q.type === 'short') {
      setExamPhase("reading");
      speak(q.text, () => {
        setExamPhase("speaking");
        setTimeLeft(examConfig[hskkLevel][q.type]);
        startRecording();
      });
    } else {
      setExamPhase("speaking");
      setTimeLeft(examConfig[hskkLevel].picture);
      startRecording();
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { 
        mimeType: 'audio/webm',
        audioBitsPerSecond: 16000 
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mediaRecorder.start();
    } catch (err) {
      console.error("Không truy cập được Micro", err);
    }
  };

  const stopRecordingAndNext = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          handleNextQuestion(reader.result);
        };
      };
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    } else {
      handleNextQuestion(null);
    }
  };

  const handleNextQuestion = (audioBase64) => {
    const currentQ = examQuestions[currentQIndex];
    const newAnswers = [
      ...examAnswers, 
      { 
        type: currentQ.type, 
        question: currentQ.text, 
        images: currentQ.images || [], 
        audioBase64 
      }
    ];
    setExamAnswers(newAnswers);

    if (currentQIndex < examQuestions.length - 1) {
      const nextIdx = currentQIndex + 1;
      setCurrentQIndex(nextIdx);
      startQuestionLogic(nextIdx, hasPrepped);
    } else {
      submitFullExam(newAnswers);
    }
  };

  const submitFullExam = async (allAnswers) => {
    setExamPhase("submitting");
    if (!user) {
      alert("Lỗi: Bạn chưa đăng nhập, không thể lưu bài thi!");
      setExamPhase("idle");
      return;
    }

    try {
      const fallbackName = user.primaryEmailAddress?.emailAddress?.split('@')[0] || "Học viên ẩn danh";
      const finalUserName = user.fullName || fallbackName;

      const examsRef = collection(db, "hskk_exams");
      const newExamDoc = await addDoc(examsRef, {
        userId: user.id,
        userName: finalUserName,
        userEmail: user.primaryEmailAddress?.emailAddress || "",
        level: hskkLevel,
        submittedAt: serverTimestamp(),
        status: "pending_teacher",
        teacherScore: null,
        teacherFeedback: null
      });

      const answersCollectionRef = collection(db, "hskk_exams", newExamDoc.id, "answers");
      for (let i = 0; i < allAnswers.length; i++) {
        await addDoc(answersCollectionRef, {
          questionIndex: i + 1,
          type: allAnswers[i].type,
          question: allAnswers[i].question || "",
          images: allAnswers[i].images || [],
          audioBase64: allAnswers[i].audioBase64 || null,
          teacherComment: "" 
        });
      }
      
      setExamPhase("done");
    } catch (error) {
      console.error("Lỗi nộp bài thi:", error);
      alert("Lỗi kết nối máy chủ! Quá trình nộp bài bị gián đoạn do mất mạng.");
      setExamPhase("idle");
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center py-12 bg-gradient-to-br from-slate-50 via-rose-50/20 to-teal-50/30 px-4">
      <div className="w-full max-w-5xl flex justify-between items-center mb-8">
        <Link href="/">
          <button className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-2xl shadow-sm hover:shadow transition flex items-center gap-2 cursor-pointer">
            <span>←</span> Về Trang Chủ
          </button>
        </Link>
        <div className="flex items-center gap-2 bg-rose-100 text-rose-800 px-4 py-1.5 rounded-full text-xs font-black shadow-xs">
          🎤 Phòng Khảo Thí HSKK Chuẩn Quốc Tế
        </div>
      </div>

      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-xl border-t-8 border-rose-600 p-6 md:p-10">
        
        {/* BƯỚC 1: CHỌN CẤP ĐỘ HSKK & LỊCH SỬ BÀI THI */}
        {examPhase === "idle" && (
          <div className="animate-fade-in">
            <div className="text-center pb-8 border-b border-slate-100 mb-8">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Chọn Cấp Độ Thi HSKK</h2>
              {/* Tiêu đề yêu cầu thêm */}
              <div className="inline-block bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-black px-4 py-1.5 rounded-full mb-4 shadow-2xs">
                ✨ Đề thi được cập nhật theo form New HSK 3.0
              </div>
              <p className="text-slate-500 text-sm mb-8">Chọn trình độ khảo thí bên dưới. Các cấp độ chưa đủ dữ liệu sẽ hiển thị trạng thái đang cập nhật.</p>

              {/* Giao diện Thẻ chọn Cấp độ sinh động */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {Object.keys(levelAvailability).map((lvl) => {
                  const info = levelAvailability[lvl];
                  const isSelected = hskkLevel === lvl;

                  return (
                    <div
                      key={lvl}
                      onClick={() => {
                        if (info.available) setHskkLevel(lvl);
                      }}
                      className={`p-5 rounded-2xl border-2 transition-all flex flex-col justify-between text-left relative overflow-hidden ${
                        !info.available 
                          ? 'bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed select-none' 
                          : isSelected 
                            ? 'border-rose-600 bg-rose-50/40 shadow-md ring-2 ring-rose-400/20 cursor-pointer' 
                            : 'border-slate-200 bg-white hover:border-rose-300 hover:shadow cursor-pointer'
                      }`}
                    >
                      {!info.available && (
                        <div className="absolute top-3 right-3 bg-slate-400 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase">
                          🔒 Đang update
                        </div>
                      )}
                      <div>
                        <span className="text-xs font-bold text-slate-400 block mb-1">Kỳ thi khẩu ngữ</span>
                        <h4 className="text-xl font-black text-slate-800">{lvl}</h4>
                        <p className="text-xs text-slate-500 mt-2 font-medium">{info.desc}</p>
                      </div>

                      {info.available && (
                        <div className="mt-4 flex items-center justify-between">
                          <span className={`text-xs font-bold ${isSelected ? 'text-rose-600' : 'text-slate-400'}`}>
                            {isSelected ? "✓ Đã chọn" : "Chọn đề"}
                          </span>
                          <span className="text-sm">➔</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {levelAvailability[hskkLevel]?.available ? (
                <div className="max-w-xl mx-auto py-6 px-4 border-2 border-dashed border-rose-200 rounded-2xl bg-rose-50/40 shadow-xs">
                  <p className="text-slate-700 font-bold text-base mb-1">Đã chọn: <span className="text-rose-600">{hskkLevel}</span></p>
                  <p className="text-slate-500 text-xs mb-4">Hệ thống sẽ bốc thăm đề ngẫu nhiên từ Ngân hàng Dữ liệu chuẩn quốc tế.</p>
                  <button onClick={() => setExamPhase("device_check")} className="px-8 py-3.5 bg-rose-600 text-white font-black text-lg rounded-2xl shadow-lg hover:bg-rose-700 hover:scale-105 transition-all cursor-pointer">
                    🚀 Chuẩn bị vào thi ngay
                  </button>
                </div>
              ) : (
                <div className="max-w-xl mx-auto py-4 px-4 bg-slate-100 rounded-2xl border border-slate-200 text-slate-500 text-sm font-bold">
                  ⚠️ Cấp độ này đang được đội ngũ biên soạn bổ sung dữ liệu. Vui lòng chọn HSK Cấp 3 để thi thử!
                </div>
              )}
            </div>

            {/* KHUNG LỊCH SỬ BÀI THI & NHẬN XÉT CỦA HỌC SINH */}
            <div>
              <h3 className="text-2xl font-black text-slate-800 mb-4 flex items-center gap-2">
                <span>📊</span> Lịch sử bài thi và kết quả của tôi
              </h3>
              {loadingHistory ? (
                <p className="text-slate-400 py-6 text-center">Đang tải lịch sử bài thi...</p>
              ) : myHistory.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 rounded-2xl border border-slate-200/80">
                  <p className="text-slate-500 font-medium">Bạn chưa hoàn thành bài thi HSKK nào.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3 max-h-[420px] overflow-y-auto pr-2">
                  {myHistory.map((exam) => {
                    const dateStr = exam.submittedAt?.toDate ? exam.submittedAt.toDate().toLocaleString("vi-VN") : "Vừa xong";
                    const isGraded = exam.status === "graded" || exam.teacherScore !== null;

                    return (
                      <div key={exam.id} className="p-5 rounded-2xl border border-slate-200 bg-white shadow-xs hover:shadow-md transition flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                          <div className="flex items-center gap-3 mb-1.5">
                            <span className="font-extrabold text-rose-700 bg-rose-50 px-3 py-1 rounded-xl text-sm border border-rose-100">{exam.level}</span>
                            <span className="text-slate-400 text-xs font-medium">Nộp lúc: {dateStr}</span>
                          </div>
                          <span className={`inline-block px-3 py-0.5 rounded-full text-xs font-bold ${isGraded ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>
                            {isGraded ? "✓ Đã có kết quả" : "⏳ Đang chờ giáo viên chấm"}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 w-full md:w-auto justify-between">
                          {isGraded && (
                            <div className="text-right">
                              <span className="text-xs text-slate-400 block font-medium">Tổng điểm:</span>
                              <span className="text-xl font-black text-rose-600">{exam.teacherScore} / 100</span>
                            </div>
                          )}
                          <button 
                            onClick={() => openExamDetail(exam)}
                            className="px-4 py-2 bg-slate-900 text-white font-bold rounded-xl text-xs hover:bg-slate-800 transition cursor-pointer">
                            Xem chi tiết ➔
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* MODAL XEM CHI TIẾT BÀI THI */}
        {selectedHistoryExam && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex justify-center items-center z-50 p-4 animate-fade-in">
            <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 md:p-8 shadow-2xl relative">
              <button 
                onClick={() => setSelectedHistoryExam(null)}
                className="absolute top-6 right-6 w-10 h-10 bg-slate-100 hover:bg-rose-100 hover:text-rose-600 font-bold rounded-full flex items-center justify-center text-xl transition cursor-pointer">
                ✕
              </button>

              <h2 className="text-2xl font-black text-slate-900 mb-1">Chi tiết bài thi: {selectedHistoryExam.level}</h2>
              <p className="text-slate-400 text-xs mb-6">Trạng thái: {selectedHistoryExam.teacherScore !== null ? "Đã chấm điểm" : "Đang chờ chấm"}</p>

              {selectedHistoryExam.teacherScore !== null && (
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-black text-rose-900 text-base">Đánh giá chung của giáo viên</h3>
                    <span className="text-2xl font-black text-rose-600">{selectedHistoryExam.teacherScore} / 100 điểm</span>
                  </div>
                  <p className="text-slate-700 font-medium italic bg-white p-4 rounded-xl border border-rose-100 text-sm">
                    &quot;{selectedHistoryExam.teacherFeedback || "Không có nhận xét tổng."}&quot;
                  </p>
                </div>
              )}

              <h3 className="text-lg font-black text-slate-800 mb-4">Nhận xét từng câu hỏi:</h3>
              <div className="flex flex-col gap-4">
                {examAnswersDetail.map((item, idx) => (
                  <div key={idx} className="p-4 rounded-2xl border border-slate-200 bg-slate-50">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Câu {item.questionIndex} ({item.type})</span>
                    <p className="font-bold text-slate-800 text-sm mb-3">{item.question}</p>
                    
                    {item.audioUrl && (
                      <div className="mb-3">
                        <audio src={item.audioUrl} controls className="w-full h-10" />
                      </div>
                    )}

                    <div className="bg-white p-3 rounded-xl border border-slate-200">
                      <span className="text-xs font-bold text-rose-600 block mb-1">Nhận xét của giáo viên cho câu này:</span>
                      <p className="text-slate-600 text-xs italic">
                        {item.teacherComment ? `"${item.teacherComment}"` : "Giáo viên chưa có nhận xét riêng cho câu này."}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <button 
                onClick={() => setSelectedHistoryExam(null)}
                className="mt-6 w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition cursor-pointer text-sm">
                Đóng
              </button>
            </div>
          </div>
        )}

        {/* BƯỚC 2: KIỂM TRA THIẾT BỊ (DEVICE CHECK) */}
        {examPhase === "device_check" && (
          <div className="max-w-2xl mx-auto py-4 animate-fade-in">
            <h2 className="text-2xl font-black text-slate-900 mb-2 text-center">Kiểm Tra Loa & Micro</h2>
            <p className="text-slate-500 mb-8 text-center text-sm">Hãy hoàn tất hai bước dưới đây để đảm bảo hệ thống ghi âm hoạt động hoàn hảo.</p>

            <div className={`p-6 rounded-2xl border-2 mb-5 transition-all ${isSpeakerTested ? 'border-emerald-300 bg-emerald-50/40' : 'border-slate-200 bg-white'}`}>
              <h3 className="text-lg font-bold text-slate-800 mb-1">🔊 1. Kiểm tra loa</h3>
              <p className="text-slate-500 text-xs mb-3">Phát thử audio tiếng Trung để xác nhận loa đang hoạt động tốt.</p>
              {isSpeakerTested && <div className="bg-emerald-100 text-emerald-800 p-2.5 rounded-xl text-xs font-bold mb-3">✓ Bạn đã xác nhận nghe rõ audio.</div>}
              <div className="flex gap-3">
                <button onClick={testSpeaker} className="px-4 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 text-xs cursor-pointer">▶ Phát thử audio</button>
                <button onClick={() => setIsSpeakerTested(true)} className={`px-4 py-2 font-bold rounded-xl border-2 text-xs cursor-pointer ${isSpeakerTested ? 'border-emerald-500 text-emerald-600 bg-emerald-50' : 'border-slate-200 text-slate-600'}`}>✓ Tôi nghe rõ</button>
              </div>
            </div>

            <div className={`p-6 rounded-2xl border-2 mb-8 transition-all ${isMicTested ? 'border-emerald-300 bg-emerald-50/40' : 'border-slate-200 bg-white'}`}>
              <h3 className="text-lg font-bold text-slate-800 mb-1">🎙️ 2. Kiểm tra micro</h3>
              <p className="text-slate-500 text-xs mb-3">Nói thử khoảng 3 giây rồi nghe lại bản ghi.</p>
              {isTestingMic && <div className="text-rose-600 font-bold mb-3 text-xs animate-pulse">Đang ghi âm (3 giây)...</div>}
              {testAudioUrl && !isTestingMic && (
                <div className="mb-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <audio src={testAudioUrl} controls className="w-full h-8" />
                </div>
              )}
              {isMicTested && <div className="bg-emerald-100 text-emerald-800 p-2.5 rounded-xl text-xs font-bold mb-3">✓ Micro hoạt động bình thường.</div>}
              <div className="flex gap-3">
                <button onClick={testMic} disabled={isTestingMic} className="px-4 py-2 bg-blue-600 text-white font-bold rounded-xl text-xs cursor-pointer">🎙️ Ghi thử 3 giây</button>
                {testAudioUrl && <button onClick={() => setIsMicTested(true)} className="px-4 py-2 font-bold rounded-xl border-2 text-emerald-600 text-xs cursor-pointer">✓ Nghe rõ bản ghi</button>}
              </div>
            </div>

            <div className="flex justify-between items-center border-t border-slate-100 pt-6">
              <button onClick={() => setExamPhase("idle")} className="px-5 py-2.5 font-bold text-slate-500 text-sm cursor-pointer">← Quay lại</button>
              <button onClick={startExamSequence} disabled={!isSpeakerTested || !isMicTested} className={`px-8 py-3 font-black text-base rounded-2xl shadow-lg cursor-pointer ${isSpeakerTested && isMicTested ? 'bg-rose-600 text-white hover:bg-rose-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>VÀO PHÒNG THI CHÍNH THỨC</button>
            </div>
          </div>
        )}

        {(examPhase === "loading" || examPhase === "submitting") && (
           <div className="text-center py-24 flex flex-col items-center animate-fade-in">
             <div className="w-16 h-16 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mb-6"></div>
             <h2 className="text-2xl font-black text-rose-600">{examPhase === "loading" ? "Đang chuẩn bị đề thi thông minh..." : "Đang nộp bài thi về hệ thống..."}</h2>
           </div>
        )}

        {examPhase === "intro" && (
          <div className="text-center py-12 animate-fade-in flex flex-col items-center">
            <h2 className="text-3xl font-black text-rose-600 mb-6 uppercase tracking-wider">Phòng Thi HSKK</h2>
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-8 max-w-3xl mb-8 shadow-xs">
              <p className="text-xl font-bold text-blue-900 leading-relaxed">{introScripts[hskkLevel]}</p>
            </div>
            <div className="w-12 h-12 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-rose-600 font-bold animate-pulse text-sm">🔊 Hệ thống đang phát lời khai mạc kỳ thi...</p>
          </div>
        )}

        {examPhase === "intro_countdown" && (
          <div className="text-center py-12 animate-fade-in flex flex-col items-center">
            <h2 className="text-3xl font-black text-rose-600 mb-6 uppercase">Chuẩn bị bắt đầu phần thi</h2>
            <div className="bg-rose-50 border border-rose-200 rounded-3xl p-10 max-w-md mb-8 shadow-inner">
              <div className="text-8xl font-black font-mono text-rose-600 animate-pulse">{timeLeft}</div>
            </div>
          </div>
        )}

        {examPhase === "global_prep" && (
          <div className="flex flex-col gap-6 w-full animate-fade-in">
            <div className="bg-rose-50 p-6 rounded-2xl text-center border-2 border-rose-200 shadow-xs">
               <h2 className="text-xl font-black text-rose-700 mb-1">THỜI GIAN CHUẨN BỊ ĐỀ THI</h2>
               <p className="text-6xl font-mono font-black text-rose-600">{formatTime(timeLeft)}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
               <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 h-[500px] overflow-y-auto">
                  <h3 className="text-base font-black text-slate-800 mb-4">Danh sách câu hỏi sắp tới:</h3>
                  {examQuestions.filter(q => q.type !== 'repeat').map((q, idx) => (
                     <div key={idx} className="mb-6 pb-4 border-b border-slate-100">
                        <span className="inline-block px-3 py-1 bg-slate-100 rounded-lg text-xs font-bold mb-2 text-slate-600">{q.type === 'picture' ? "🖼️ Nhìn Tranh Kể Chuyện" : "❓ Trả Lời Câu Hỏi"}</span>
                        <p className="font-bold text-slate-800 text-sm">{q.text}</p>
                     </div>
                  ))}
               </div>
               <div className="flex flex-col h-[500px]">
                  <h3 className="text-base font-black text-slate-800 mb-2">Giấy Nháp Điện Tử</h3>
                  <textarea value={scratchpad} onChange={e => setScratchpad(e.target.value)} className="flex-1 w-full p-5 rounded-3xl border-2 border-slate-200 bg-amber-50/40 resize-none text-base font-medium outline-none focus:border-rose-400" placeholder="Ghi chú nhanh từ khóa tại đây..." />
               </div>
            </div>
          </div>
        )}

        {(examPhase === "reading" || examPhase === "speaking") && examQuestions.length > 0 && (
          <div className="flex flex-col gap-6 animate-fade-in max-w-2xl mx-auto py-4">
            <div className="flex justify-between items-center bg-slate-100 px-5 py-3 rounded-2xl">
               <span className="font-bold text-slate-600 text-sm">Câu hỏi {currentQIndex + 1} / {examQuestions.length}</span>
               <span className="px-3.5 py-1 bg-white rounded-xl text-rose-600 font-extrabold text-xs shadow-xs">{examQuestions[currentQIndex].type}</span>
            </div>
            {examPhase === "reading" ? (
              <div className="p-8 text-center rounded-3xl border-2 bg-blue-50 border-blue-200 shadow-sm">
                <p className="font-black text-xl text-blue-600 animate-pulse">🔊 HỆ THỐNG ĐANG PHÁT AUDIO CÂU HỎI...</p>
              </div>
            ) : (
              <div className="p-8 text-center rounded-3xl border-4 bg-rose-50 border-rose-500 shadow-md">
                <p className="font-black text-xl text-rose-600 animate-pulse mb-2">🎙️ ĐANG GHI ÂM CÂU TRẢ LỜI...</p>
                <p className="text-7xl font-black font-mono text-rose-700">{formatTime(timeLeft)}</p>
              </div>
            )}
            <div className="text-center py-6 px-4 bg-white rounded-3xl border border-slate-200 shadow-xs">
              <h3 className="text-2xl font-black text-slate-900 leading-snug">{examQuestions[currentQIndex].text}</h3>
            </div>
          </div>
        )}

        {examPhase === "done" && (
          <div className="flex flex-col gap-6 animate-fade-in text-center py-8">
            <div className="p-10 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-xl">
              <div className="text-8xl mb-4">🎉</div>
              <h3 className="text-3xl font-black mb-3">Đã nộp bài thành công!</h3>
              <p className="text-base font-medium opacity-90 max-w-md mx-auto">Giáo viên sẽ tiến hành chấm điểm file ghi âm và phản hồi kết quả trực tiếp vào lịch sử bài thi của bạn.</p>
            </div>
            <button onClick={() => setExamPhase("idle")} className="mt-4 w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-base hover:bg-slate-800 transition cursor-pointer">
              🔄 Về lại trang chủ phòng thi
            </button>
          </div>
        )}
      </div>
    </main>
  );
}