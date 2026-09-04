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
  const [commentInputs, setCommentInputs] = useState({}); // Lưu nhận xét từng câu theo ID câu hỏi
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

  // Lấy chi tiết câu trả lời và file ghi âm khi bấm vào 1 bài thi
  const handleSelectExam = async (exam) => {
    setSelectedExam(exam);
    setExamAnswers([]); 
    setScoreInput("");
    setFeedbackInput("");
    setCommentInputs({});
    
    try {
      const answersRef = collection(db, "hskk_exams", exam.id, "answers");
      const answerDocs = await getDocs(answersRef);
      const answers = [];
      const initialComments = {};

      answerDocs.forEach(d => {
        const data = d.data();
        answers.push({ id: d.id, ...data });
        initialComments[d.id] = data.teacherComment || "";
      });
      
      answers.sort((a, b) => a.questionIndex - b.questionIndex);
      setExamAnswers(answers);
      setCommentInputs(initialComments);
    } catch (error) {
      console.error("Lỗi lấy chi tiết bài thi:", error);
    }
  };

  // Cập nhật nhận xét cho từng câu thay đổi trong state
  const handleCommentChange = (answerId, text) => {
    setCommentInputs(prev => ({
      ...prev,
      [answerId]: text
    }));
  };

  // Lưu điểm số, nhận xét tổng, nhận xét từng câu và đổi trạng thái bài thi thành "graded"
  const submitGradeAndFinish = async () => {
    if (!scoreInput || !feedbackInput.trim()) {
      return alert("Vui lòng nhập đầy đủ điểm số tổng và nhận xét chung!");
    }

    setIsSubmitting(true);
    try {
      // 1. Cập nhật nhận xét từng câu vào bảng con "answers"
      for (const ans of examAnswers) {
        const answerDocRef = doc(db, "hskk_exams", selectedExam.id, "answers", ans.id);
        await updateDoc(answerDocRef, {
          teacherComment: commentInputs[ans.id] || ""
        });
      }

      // 2. Cập nhật kết quả tổng và đổi trạng thái bài thi thành "graded"
      const examRef = doc(db, "hskk_exams", selectedExam.id);
      await updateDoc(examRef, {
        status: "graded",
        teacherScore: parseInt(scoreInput),
        teacherFeedback: feedbackInput
      });

      alert("✅ Đã chấm xong và trả kết quả thẳng về trang cá nhân của học viên!");
      
      setSelectedExam(null);
      fetchPendingExams(); 
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

                {/* DANH SÁCH CÂU TRẢ LỜI & NHẬN XÉT TỪNG CÂU */}
                <div className="space-y-8 mb-10">
                  {examAnswers.length === 0 ? (
                    <p className="text-center text-slate-400 animate-pulse">Đang tải file ghi âm...</p>
                  ) : (
                    examAnswers.map((ans) => (
                      <div key={ans.id} className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
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

                        {ans.audioBase64 || ans.audioUrl ? (
                          <audio src={ans.audioBase64 || ans.audioUrl} controls className="w-full h-12 outline-none mb-4" />
                        ) : (
                          <p className="text-red-500 italic font-medium mb-4">Học sinh không ghi âm câu này.</p>
                        )}

                        {/* Ô nhập nhận xét riêng cho câu hỏi này */}
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nhận xét chi tiết cho câu này:</label>
                          <input 
                            type="text"
                            value={commentInputs[ans.id] || ""}
                            onChange={(e) => handleCommentChange(ans.id, e.target.value)}
                            placeholder="VD: Phát âm thanh 3 chưa rõ, cần chú ý nhịp điệu..."
                            className="w-full p-3 rounded-xl border border-slate-200 text-sm font-medium focus:border-blue-500 outline-none bg-white"
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* KHU VỰC NHẬP ĐIỂM TỔNG & NHẬN XÉT TỔNG */}
                <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                  <h3 className="text-xl font-black text-blue-900 mb-4">Đánh giá chung của Giáo viên</h3>
                  
                  <div className="flex flex-col md:flex-row gap-4 mb-4">
                    <div className="w-full md:w-1/3">
                      <label className="block text-sm font-bold text-slate-600 mb-2">Điểm tổng (0-100)</label>
                      <input 
                        type="number" 
                        min="0" max="100"
                        value={scoreInput}
                        onChange={(e) => setScoreInput(e.target.value)}
                        className="w-full p-4 rounded-xl border border-slate-300 text-xl font-bold focus:border-blue-500 outline-none bg-white"
                        placeholder="VD: 85"
                      />
                    </div>
                    <div className="w-full md:w-2/3">
                      <label className="block text-sm font-bold text-slate-600 mb-2">Nhận xét tổng thể</label>
                      <textarea 
                        value={feedbackInput}
                        onChange={(e) => setFeedbackInput(e.target.value)}
                        className="w-full p-4 rounded-xl border border-slate-300 font-medium focus:border-blue-500 outline-none resize-none h-32 bg-white"
                        placeholder="Tổng kết ưu/khuyết điểm và định hướng ôn tập cho học viên..."
                      />
                    </div>
                  </div>

                  <button 
                    onClick={submitGradeAndFinish}
                    disabled={isSubmitting}
                    className={`w-full py-4 rounded-xl font-black text-white text-lg transition-all flex items-center justify-center gap-2 shadow-lg ${isSubmitting ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 hover:-translate-y-1'}`}
                  >
                    {isSubmitting ? "Đang lưu kết quả..." : "✅ HOÀN TẤT CHẤM & TRẢ KẾT QUẢ CHO HỌC SINH"}
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