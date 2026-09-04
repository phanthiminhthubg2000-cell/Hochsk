"use client";
import { useState, useEffect } from "react";
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";

export default function TeacherDashboard() {
  const [pendingExams, setPendingExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  const [examAnswers, setExamAnswers] = useState([]);
  
  const [scoreInput, setScoreInput] = useState("");
  const [feedbackInput, setFeedbackInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Lấy danh sách bài thi đang chờ chấm
  const fetchPendingExams = async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, "hskk_exams"), where("status", "==", "pending_teacher"));
      const querySnapshot = await getDocs(q);
      const exams = [];
      querySnapshot.forEach((doc) => {
        exams.push({ id: doc.id, ...doc.data() });
      });
      // Sắp xếp bài nộp cũ nhất lên đầu
      exams.sort((a, b) => a.submittedAt?.toMillis() - b.submittedAt?.toMillis());
      setPendingExams(exams);
    } catch (error) {
      console.error("Lỗi lấy danh sách bài thi:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingExams();
  }, []);

  // Lấy chi tiết câu trả lời (file ghi âm) khi bấm vào 1 bài thi
  const handleSelectExam = async (exam) => {
    setSelectedExam(exam);
    setExamAnswers([]); // Reset
    setScoreInput("");
    setFeedbackInput("");
    
    try {
      const answersRef = collection(db, "hskk_exams", exam.id, "answers");
      const answerDocs = await getDocs(answersRef);
      const answers = [];
      answerDocs.forEach(d => answers.push(d.data()));
      
      answers.sort((a, b) => a.questionIndex - b.questionIndex);
      setExamAnswers(answers);
    } catch (error) {
      console.error("Lỗi lấy chi tiết bài thi:", error);
    }
  };

  // Nộp điểm và Gửi Email
  const submitGradeAndSendEmail = async () => {
    if (!scoreInput || !feedbackInput.trim()) {
      return alert("Vui lòng nhập đầy đủ điểm số và nhận xét!");
    }

    setIsSubmitting(true);
    try {
      // 1. Gửi Email trước
      const emailRes = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toEmail: selectedExam.userEmail,
          userName: selectedExam.userName,
          level: selectedExam.level,
          score: parseInt(scoreInput),
          feedback: feedbackInput
        })
      });

      const emailData = await emailRes.json();
      if (emailData.error) throw new Error(emailData.error);

      // 2. Nếu email gửi thành công -> Cập nhật trạng thái bài thi trên Firebase thành "graded"
      const examRef = doc(db, "hskk_exams", selectedExam.id);
      await updateDoc(examRef, {
        status: "graded",
        teacherScore: parseInt(scoreInput),
        teacherFeedback: feedbackInput
      });

      alert("✅ Đã chấm xong và gửi Email kết quả cho học viên!");
      
      // Reset giao diện
      setSelectedExam(null);
      fetchPendingExams(); // Tải lại danh sách
    } catch (error) {
      alert("Lỗi: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-black text-slate-800 mb-8">Trang Chấm Thi Giáo Viên</h1>
        
        <div className="flex flex-col lg:flex-row gap-8">
          {/* CỘT TRÁI: DANH SÁCH CHỜ */}
          <div className="w-full lg:w-1/3 bg-white p-6 rounded-3xl shadow-sm border border-slate-200 h-fit max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-slate-700 mb-4 flex justify-between items-center">
              Danh sách chờ 
              <span className="bg-rose-100 text-rose-600 px-3 py-1 rounded-full text-sm">{pendingExams.length} bài</span>
            </h2>
            
            {isLoading ? (
              <p className="text-center text-slate-400 py-10">Đang tải...</p>
            ) : pendingExams.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 rounded-2xl">
                <p className="text-4xl mb-2">🎉</p>
                <p className="text-slate-500 font-medium">Tuyệt vời, không có bài thi nào đang chờ!</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {pendingExams.map(exam => (
                  <button 
                    key={exam.id}
                    onClick={() => handleSelectExam(exam)}
                    className={`text-left p-4 rounded-xl border-2 transition-all ${selectedExam?.id === exam.id ? 'border-rose-500 bg-rose-50' : 'border-slate-100 hover:border-slate-300 bg-white'}`}
                  >
                    <p className="font-bold text-slate-800">{exam.userName}</p>
                    <p className="text-sm text-slate-500 mb-2">{exam.userEmail || "Không có email"}</p>
                    <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded">
                      {exam.level}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* CỘT PHẢI: CHI TIẾT BÀI THI & CHẤM ĐIỂM */}
          <div className="w-full lg:w-2/3 bg-white p-6 lg:p-10 rounded-3xl shadow-sm border border-slate-200">
            {!selectedExam ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 min-h-[400px]">
                <p className="text-6xl mb-4">📝</p>
                <p className="text-xl font-medium">Chọn một bài thi ở danh sách bên trái để chấm</p>
              </div>
            ) : (
              <div className="animate-fade-in">
                <div className="border-b border-slate-200 pb-6 mb-6">
                  <h2 className="text-2xl font-black text-slate-800">Học viên: {selectedExam.userName}</h2>
                  <p className="text-slate-500 font-medium">Email: {selectedExam.userEmail}</p>
                  <p className="text-rose-600 font-bold mt-1">Cấp độ: {selectedExam.level}</p>
                </div>

                <div className="space-y-8 mb-10">
                  {examAnswers.length === 0 ? (
                    <p className="text-center text-slate-400 animate-pulse">Đang tải file ghi âm...</p>
                  ) : (
                    examAnswers.map((ans, idx) => (
                      <div key={idx} className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                        <div className="flex items-center gap-3 mb-4">
                          <span className="w-8 h-8 flex items-center justify-center bg-slate-800 text-white font-bold rounded-full">{ans.questionIndex}</span>
                          <span className="font-bold text-slate-600 uppercase text-sm tracking-wider">
                            {ans.type === "repeat" ? "Nghe nhắc lại" : ans.type === "picture" ? "Nhìn tranh nói" : "Trả lời câu hỏi"}
                          </span>
                        </div>
                        
                        <p className="text-lg font-bold text-slate-800 mb-4">{ans.question}</p>
                        
                        {ans.images && ans.images.length > 0 && (
                          <div className={`grid gap-2 mb-4 ${ans.images.length > 2 ? 'grid-cols-2' : 'grid-cols-1'} max-w-sm`}>
                            {ans.images.map((img, i) => (
                              <img key={i} src={img} alt="đề bài" className="w-full rounded-lg border border-slate-200 shadow-sm" />
                            ))}
                          </div>
                        )}

                        {ans.audioBase64 ? (
                          <audio src={ans.audioBase64} controls className="w-full h-12 outline-none" />
                        ) : (
                          <p className="text-red-500 italic font-medium">Học sinh không ghi âm câu này.</p>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* KHU VỰC NHẬP ĐIỂM */}
                <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                  <h3 className="text-xl font-black text-blue-900 mb-4">Phán quyết của Giáo viên</h3>
                  
                  <div className="flex gap-4 mb-4">
                    <div className="w-1/3">
                      <label className="block text-sm font-bold text-slate-600 mb-2">Điểm (0-100)</label>
                      <input 
                        type="number" 
                        min="0" max="100"
                        value={scoreInput}
                        onChange={(e) => setScoreInput(e.target.value)}
                        className="w-full p-4 rounded-xl border border-slate-300 text-xl font-bold focus:border-blue-500 outline-none"
                        placeholder="VD: 85"
                      />
                    </div>
                    <div className="w-2/3">
                      <label className="block text-sm font-bold text-slate-600 mb-2">Nhận xét chi tiết</label>
                      <textarea 
                        value={feedbackInput}
                        onChange={(e) => setFeedbackInput(e.target.value)}
                        className="w-full p-4 rounded-xl border border-slate-300 font-medium focus:border-blue-500 outline-none resize-none h-32"
                        placeholder="Nhận xét ưu/khuyết điểm và cách khắc phục để gửi email cho học viên..."
                      />
                    </div>
                  </div>

                  <button 
                    onClick={submitGradeAndSendEmail}
                    disabled={isSubmitting}
                    className={`w-full py-4 rounded-xl font-black text-white text-lg transition-all flex items-center justify-center gap-2 shadow-lg ${isSubmitting ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 hover:-translate-y-1'}`}
                  >
                    {isSubmitting ? "Đang xử lý và gửi Email..." : "✅ HOÀN TẤT CHẤM & GỬI EMAIL"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}