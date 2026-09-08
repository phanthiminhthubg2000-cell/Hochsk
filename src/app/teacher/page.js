"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useAuth, useUser, SignInButton, UserButton } from "@clerk/nextjs";
import { collection, query, where, getDocs, doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "../../firebase";

export default function TeacherDashboard() {
  const { isSignedIn, userId } = useAuth();
  const { user, isLoaded } = useUser();

  // --- TAB NAVIGATION ---
  const [activeTab, setActiveTab] = useState("students"); // 'students' | 'grading' | 'grading_test'

  // --- STATES CHẤM THI HSKK ---
  const [pendingExams, setPendingExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  const [examAnswers, setExamAnswers] = useState([]);
  const [scoreInput, setScoreInput] = useState("");
  const [feedbackInput, setFeedbackInput] = useState("");
  const [commentInputs, setCommentInputs] = useState({});
  const [itemScores, setItemScores] = useState({}); 
  const [isLoadingExams, setIsLoadingExams] = useState(true);

  // --- STATES CHẤM BÀI TEST NĂNG LỰC TOÀN DIỆN ---
  const [pendingTests, setPendingTests] = useState([]);
  const [selectedTest, setSelectedTest] = useState(null);
  const [questionScores, setQuestionScores] = useState({}); 
  const [questionComments, setQuestionComments] = useState({}); 
  const [isLoadingTests, setIsLoadingTests] = useState(true);
  
  // States Form Đánh giá Năng lực
  const [testEvalLevel, setTestEvalLevel] = useState("HSK 1");
  const [testSkillScores, setTestSkillScores] = useState({ listening: "", speaking: "", reading: "", writing: "" });
  const [testSkillFeedbacks, setTestSkillFeedbacks] = useState({ listening: "", speaking: "", reading: "", writing: "" });
  const [testGeneralFeedback, setTestGeneralFeedback] = useState("");
  const [testRecommendation, setTestRecommendation] = useState("");
  const [testTotalScore, setTestTotalScore] = useState(0);

  // --- STATES CHUNG ---
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- STATES QUẢN LÝ HỌC VIÊN ---
  const [studentsProgress, setStudentsProgress] = useState([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(true);

  // --- STATES BỐ CỤC ---
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [hskXp, setHskXp] = useState(0);
  const [hearts, setHearts] = useState(5);
  const [streak, setStreak] = useState(0);

  // Lấy dữ liệu cá nhân của Admin/Giáo viên
  useEffect(() => {
    async function fetchUserData() {
      if (userId) {
        try {
          const newStudentRef = doc(db, "user_progress", userId);
          const newDocSnap = await getDoc(newStudentRef);
          if (newDocSnap.exists()) {
            const newData = newDocSnap.data();
            setHskXp(newData.profile?.hsk_xp || 0);
            setHearts(newData.profile?.hearts ?? 5);
            setStreak(newData.profile?.streak_days || 0);
          }
        } catch (error) { console.error("Lỗi:", error); }
      }
    }
    if (isLoaded) fetchUserData();
  }, [userId, isLoaded]);

  // TỰ ĐỘNG CỘNG ĐIỂM TỔNG HSKK
  useEffect(() => {
    if (activeTab === "grading" && selectedExam) {
      const total = Object.values(itemScores).reduce((sum, val) => sum + (Number(val) || 0), 0);
      setScoreInput(total.toString());
    }
  }, [itemScores, activeTab, selectedExam]);

  // TỰ ĐỘNG CỘNG ĐIỂM TỔNG BÀI TEST 4 KỸ NĂNG
  useEffect(() => {
    if (activeTab === "grading_test" && selectedTest) {
      const total = (Number(testSkillScores.listening) || 0) +
                    (Number(testSkillScores.speaking) || 0) +
                    (Number(testSkillScores.reading) || 0) +
                    (Number(testSkillScores.writing) || 0);
      setTestTotalScore(total);
    }
  }, [testSkillScores, activeTab, selectedTest]);

  // FETCH BÀI THI HSKK
  const fetchPendingExams = async () => {
    setIsLoadingExams(true);
    try {
      const q = query(collection(db, "hskk_exams"), where("status", "==", "pending_teacher"));
      const querySnapshot = await getDocs(q);
      const exams = [];
      querySnapshot.forEach((doc) => { exams.push({ id: doc.id, ...doc.data() }); });
      exams.sort((a, b) => a.submittedAt?.toMillis() - b.submittedAt?.toMillis());
      setPendingExams(exams);
    } catch (error) { console.error("Lỗi lấy danh sách bài thi HSKK:", error); } finally { setIsLoadingExams(false); }
  };

  // FETCH BÀI TEST NĂNG LỰC
  const fetchPendingTests = async () => {
    setIsLoadingTests(true);
    try {
      const q = query(collection(db, "test_submissions"), where("status", "==", "pending_teacher"));
      const querySnapshot = await getDocs(q);
      const tests = [];
      querySnapshot.forEach((doc) => { tests.push({ id: doc.id, ...doc.data() }); });
      tests.sort((a, b) => a.submittedAt?.toMillis() - b.submittedAt?.toMillis());
      setPendingTests(tests);
    } catch (error) { console.error("Lỗi lấy danh sách bài Test:", error); } finally { setIsLoadingTests(false); }
  };

  // FETCH DỮ LIỆU TẤT CẢ HỌC VIÊN
  const fetchAllStudentsProgress = async () => {
    setIsLoadingStudents(true);
    try {
      const usersSnap = await getDocs(collection(db, "users")).catch(() => ({ empty: true, forEach: () => {} }));
      const progressSnap = await getDocs(collection(db, "progress")).catch(() => ({ empty: true, forEach: () => {} }));
      const userProgressSnap = await getDocs(collection(db, "user_progress")).catch(() => ({ empty: true, forEach: () => {} }));

      const pMap = {}; progressSnap.forEach(d => { pMap[d.id] = d.data(); });
      const upMap = {}; userProgressSnap.forEach(d => { upMap[d.id] = d.data(); });
      const studentsMap = new Map();

      const processUserData = (id, uData, pData, upData) => {
        if (uData?.role === 'teacher' || uData?.role === 'admin') return;
        const mergedXp = uData?.xp || upData?.profile?.hsk_xp || pData?.xp || 0;
        const baseSkillLevel = mergedXp > 0 ? Math.min(Math.floor(mergedXp / 30), 40) : 0; 
        const dbSkills = upData?.skill_map || uData?.skill_map || pData?.skill_map || {};

        const getSkill = (key) => {
          if (dbSkills[key] !== undefined) return Math.min(dbSkills[key], 100);
          return mergedXp === 0 ? 0 : baseSkillLevel; // FIX: Nếu XP = 0 thì kỹ năng = 0%
        };

        studentsMap.set(id, {
          id: id, name: uData?.fullName || pData?.name || upData?.profile?.name || "Học viên ẩn danh",
          email: uData?.email || "Không công khai", level: uData?.currentLevel || upData?.profile?.level || "HSK 1",
          xp: mergedXp, streak: uData?.streak || upData?.profile?.streak_days || pData?.streakCount || 0,
          hearts: uData?.hearts || upData?.profile?.hearts || pData?.hearts || 5,
          avatar: pData?.avatar || upData?.profile?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${id}`,
          skills: [
            { id: "vocab", name: "Từ vựng", icon: "📚", color: "bg-blue-500", val: getSkill('vocabulary') },
            { id: "grammar", name: "Ngữ pháp", icon: "🧩", color: "bg-purple-500", val: getSkill('grammar') },
            { id: "listen", name: "Nghe", icon: "🎧", color: "bg-amber-500", val: getSkill('listening') },
            { id: "translate", name: "Dịch", icon: "✍️", color: "bg-rose-500", val: getSkill('translation') },
            { id: "write", name: "Viết", icon: "📝", color: "bg-indigo-500", val: getSkill('writing') },
            { id: "speak", name: "Nói", icon: "🗣️", color: "bg-[#10B981]", val: getSkill('speaking') },
          ]
        });
      };

      usersSnap.forEach(doc => { processUserData(doc.id, doc.data(), pMap[doc.id], upMap[doc.id]); });
      progressSnap.forEach(doc => { if (!studentsMap.has(doc.id)) processUserData(doc.id, {}, doc.data(), upMap[doc.id]); });

      const studentsList = Array.from(studentsMap.values());
      studentsList.sort((a, b) => b.xp - a.xp); 
      setStudentsProgress(studentsList);
    } catch (error) { console.error("Lỗi lấy dữ liệu học sinh:", error); } finally { setIsLoadingStudents(false); }
  };

  useEffect(() => {
    fetchPendingExams();
    fetchPendingTests();
    fetchAllStudentsProgress();
  }, []);

  // --- LOGIC CHẤM THI HSKK ---
  const handleSelectExam = async (exam) => {
    setSelectedExam(exam);
    setExamAnswers([]); setScoreInput(""); setFeedbackInput(""); setCommentInputs({}); setItemScores({});
    try {
      const answersRef = collection(db, "hskk_exams", exam.id, "answers");
      const answerDocs = await getDocs(answersRef);
      const answers = []; const initialComments = {}; const initialScores = {};

      answerDocs.forEach(d => {
        const data = d.data();
        answers.push({ id: d.id, ...data });
        initialComments[d.id] = data.teacherComment || "";
        initialScores[d.id] = data.teacherScore || "";
      });
      answers.sort((a, b) => a.questionIndex - b.questionIndex);
      setExamAnswers(answers); setCommentInputs(initialComments); setItemScores(initialScores);
    } catch (error) { console.error("Lỗi lấy chi tiết bài thi:", error); }
  };

  const handleCommentChange = (answerId, text) => { setCommentInputs(prev => ({ ...prev, [answerId]: text })); };

  const submitGradeAndFinish = async () => {
    if (!scoreInput || !feedbackInput.trim()) return alert("Vui lòng nhập đầy đủ điểm số tổng và nhận xét chung!");
    setIsSubmitting(true);
    try {
      for (const ans of examAnswers) {
        const answerDocRef = doc(db, "hskk_exams", selectedExam.id, "answers", ans.id);
        await updateDoc(answerDocRef, { teacherComment: commentInputs[ans.id] || "", teacherScore: Number(itemScores[ans.id]) || 0 });
      }
      await updateDoc(doc(db, "hskk_exams", selectedExam.id), { status: "graded", teacherScore: parseInt(scoreInput), teacherFeedback: feedbackInput });
      alert("✅ Đã chấm xong và trả kết quả thẳng về trang cá nhân của học viên!");
      setSelectedExam(null); fetchPendingExams(); 
    } catch (error) { alert("Lỗi: " + error.message); } finally { setIsSubmitting(false); }
  };

  // --- LOGIC CHẤM BÀI TEST NĂNG LỰC TOÀN DIỆN ---
  const handleSelectTest = (test) => {
    setSelectedTest(test);
    setQuestionScores({}); setQuestionComments({});
    setTestEvalLevel("HSK 1");
    setTestSkillScores({ listening: "", speaking: "", reading: "", writing: "" });
    setTestSkillFeedbacks({ listening: "", speaking: "", reading: "", writing: "" });
    setTestGeneralFeedback(""); setTestRecommendation("");
    
    if (test.gradedDetails) {
      if (test.gradedDetails.scores) setQuestionScores(test.gradedDetails.scores);
      if (test.gradedDetails.comments) setQuestionComments(test.gradedDetails.comments);
    }
  };

  const submitTestGradeAndFinish = async () => {
    if (!testGeneralFeedback.trim() || !testRecommendation.trim()) {
      return alert("Vui lòng điền đầy đủ Đánh giá chung và Lời khuyên lộ trình!");
    }
    setIsSubmitting(true);
    try {
      const testRef = doc(db, "test_submissions", selectedTest.id);
      await updateDoc(testRef, {
        status: "graded",
        teacherScore: testTotalScore,
        evaluatedLevel: testEvalLevel,
        teacherFeedback: testGeneralFeedback,
        recommendation: testRecommendation,
        skillsEvaluation: {
          listening: { score: Number(testSkillScores.listening), feedback: testSkillFeedbacks.listening },
          speaking: { score: Number(testSkillScores.speaking), feedback: testSkillFeedbacks.speaking },
          reading: { score: Number(testSkillScores.reading), feedback: testSkillFeedbacks.reading },
          writing: { score: Number(testSkillScores.writing), feedback: testSkillFeedbacks.writing }
        },
        gradedDetails: {
          scores: questionScores,
          comments: questionComments
        }
      });

      alert("✅ Đã chấm xong bài Test Đánh giá năng lực toàn diện!");
      setSelectedTest(null);
      fetchPendingTests(); 
    } catch (error) {
      alert("Lỗi: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderTestItemAction = (qId, maxScore) => (
    <div className="mt-4 pt-4 border-t border-[#E2E8F0] grid grid-cols-1 md:grid-cols-12 gap-4">
      <div className="md:col-span-3">
        <label className="block text-[10px] font-black text-[#64748B] uppercase tracking-widest mb-1.5">Điểm câu (/{maxScore})</label>
        <input 
          type="number" min="0" max={maxScore}
          value={questionScores[qId] || ""}
          onChange={(e) => setQuestionScores(prev => ({...prev, [qId]: e.target.value}))}
          className="w-full p-2.5 rounded-xl border border-[#E2E8F0] text-lg font-black text-center text-[#10B981] focus:border-[#10B981] focus:bg-[#ECFDF5] outline-none transition-all shadow-inner"
          placeholder="0"
        />
      </div>
      <div className="md:col-span-9">
        <label className="block text-[10px] font-black text-[#64748B] uppercase tracking-widest mb-1.5">Nhận xét câu (Tùy chọn)</label>
        <textarea 
          rows="1"
          value={questionComments[qId] || ""}
          onChange={(e) => setQuestionComments(prev => ({...prev, [qId]: e.target.value}))}
          placeholder="Sửa lỗi ngữ pháp/phát âm cho câu này..."
          className="w-full p-3 rounded-xl border border-[#E2E8F0] text-sm font-medium focus:border-[#10B981] focus:bg-[#F8FAFC] outline-none resize-none transition-all placeholder:text-[#CBD5E1]"
        ></textarea>
      </div>
    </div>
  );

  if (!isLoaded) return <div className="min-h-screen bg-[#F7FAF8]"></div>;

  return (
    <div className="flex min-h-screen font-sans text-[#142033] bg-[#F7FAF8] selection:bg-[#10B981]/20">
      
      {/* SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-[#E2E8F0] bg-white transition-all duration-300 md:flex ${isSidebarCollapsed ? "w-[76px]" : "w-[240px]"}`}>
        <div className="flex h-full flex-col">
          <div className={`flex items-center px-6 py-6 ${isSidebarCollapsed ? "justify-center" : "gap-3"}`}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white shadow-sm">🛡️</div>
            {!isSidebarCollapsed && <h2 className="truncate text-base font-black tracking-tight text-[#142033]">Admin Panel</h2>}
          </div>

          <nav className="flex-1 overflow-y-auto px-4 py-2 custom-scrollbar">
            <p className="px-2 text-[10px] font-bold uppercase tracking-widest text-[#94A3B8] mb-2">{!isSidebarCollapsed ? "Hệ thống" : "•"}</p>
            <Link href="/" className="mb-6 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#142033] transition-colors">
              <span className="text-lg opacity-80">🏠</span>{!isSidebarCollapsed && <span>Về Trang chủ</span>}
            </Link>

            <div className="border-t border-[#E2E8F0] pt-4">
              <p className="px-3 mb-3 text-[10px] font-bold uppercase tracking-widest text-amber-500">{!isSidebarCollapsed ? "Quản trị viên" : "•"}</p>
              
              <button onClick={() => setActiveTab("students")} className={`w-full mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-all ${activeTab === 'students' ? 'bg-[#ECFDF5] text-[#10B981] border border-[#A7F3D0]/30 shadow-sm' : 'text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#142033]'}`}>
                <span className="text-lg">📊</span>{!isSidebarCollapsed && <span>Tiến độ Học viên</span>}
              </button>

              <button onClick={() => setActiveTab("grading")} className={`w-full mb-1 flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-bold transition-all ${activeTab === 'grading' ? 'bg-[#ECFDF5] text-[#10B981] border border-[#A7F3D0]/30 shadow-sm' : 'text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#142033]'}`}>
                <div className="flex items-center gap-3"><span className="text-lg">🎙️</span>{!isSidebarCollapsed && <span>Chấm thi HSKK</span>}</div>
                {!isSidebarCollapsed && pendingExams.length > 0 && <span className="bg-[#F43F70] text-white text-[10px] px-2 py-0.5 rounded-full shadow-sm">{pendingExams.length}</span>}
              </button>

              <button onClick={() => setActiveTab("grading_test")} className={`w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-bold transition-all ${activeTab === 'grading_test' ? 'bg-[#ECFDF5] text-[#10B981] border border-[#A7F3D0]/30 shadow-sm' : 'text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#142033]'}`}>
                <div className="flex items-center gap-3"><span className="text-lg">📝</span>{!isSidebarCollapsed && <span>Chấm bài Test</span>}</div>
                {!isSidebarCollapsed && pendingTests.length > 0 && <span className="bg-[#10B981] text-white text-[10px] px-2 py-0.5 rounded-full shadow-sm">{pendingTests.length}</span>}
              </button>
            </div>
          </nav>

          <div className="border-t border-[#E2E8F0] p-4">
            <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="mb-3 flex w-full items-center justify-center rounded-xl bg-[#F8FAFC] py-2.5 text-xs font-bold text-[#64748B] hover:bg-[#E2E8F0] transition-colors">
              {isSidebarCollapsed ? "→" : "← Thu gọn"}
            </button>
            {isSignedIn ? (
              <div className={`flex items-center rounded-xl bg-white border border-[#E2E8F0] shadow-sm p-2 ${isSidebarCollapsed ? "justify-center" : "gap-3"}`}>
                <UserButton afterSignOutUrl="/" />
                {!isSidebarCollapsed && <div className="min-w-0"><p className="truncate text-xs font-bold">{user?.fullName || "Giáo viên"}</p></div>}
              </div>
            ) : (
              <SignInButton mode="modal">
                <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#142033] py-3 text-xs font-bold text-white hover:bg-black">👤 {!isSidebarCollapsed && "Đăng nhập"}</button>
              </SignInButton>
            )}
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className={`min-h-screen transition-all duration-300 relative w-full flex flex-col ${isSidebarCollapsed ? "md:pl-[76px]" : "md:pl-[240px]"}`}>
        <header className="sticky top-0 z-30 h-16 border-b border-[#E2E8F0] bg-white/90 px-6 backdrop-blur-md flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="font-black text-lg hidden sm:block text-[#142033]">Bảng Điều Khiển Admin (Teacher Dashboard)</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 shadow-sm"><span className="text-sm">⭐</span><span className="text-xs font-black text-[#F4B740]">{hskXp}</span></div>
            <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 shadow-sm"><span className="text-sm">❤️</span><span className="text-xs font-black text-[#F43F70]">{hearts}</span></div>
          </div>
        </header>

        <div className="flex-1 p-6 md:p-8 max-w-[1400px] mx-auto w-full">
          <div className="mb-8">
            <h1 className="text-3xl font-black text-[#142033] tracking-tight">Khu vực Quản trị</h1>
            <p className="text-[#64748B] font-medium mt-1">
              {activeTab === 'students' ? "Quản lý dữ liệu và theo dõi tiến độ của toàn bộ học viên trong hệ thống." : 
               activeTab === 'grading' ? "Đánh giá kết quả phần thi kỹ năng nói (HSKK) của học viên." : 
               "Chấm bài kiểm tra Năng lực (4 Kỹ Năng) của học viên."}
            </p>
          </div>

          {/* TAB 1: TIẾN ĐỘ HỌC VIÊN */}
          {activeTab === "students" && (
            <div className="bg-white rounded-[32px] border border-[#E2E8F0] shadow-sm overflow-hidden animate-fade-in">
              <div className="p-6 md:p-8 border-b border-[#E2E8F0] bg-[#F8FAFC] flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-black text-[#142033]">Danh sách Học Viên</h3>
                  <p className="text-sm font-medium text-[#64748B] mt-1">Bảng tổng hợp xếp hạng và mức độ hoàn thiện của từng module kỹ năng.</p>
                </div>
                <button onClick={fetchAllStudentsProgress} className="w-10 h-10 rounded-xl bg-white border border-[#E2E8F0] flex items-center justify-center shadow-sm text-lg hover:bg-slate-50 transition" title="Làm mới dữ liệu">🔄</button>
              </div>

              <div className="p-0 overflow-x-auto custom-scrollbar">
                <table className="w-full min-w-[1000px] text-left">
                  <thead className="bg-slate-50 border-b border-[#E2E8F0]">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[#94A3B8] w-16 text-center">Hạng</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[#94A3B8] w-56">Học viên</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[#94A3B8] w-40">Chỉ số chung</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[#94A3B8]">Chi tiết 6 Kỹ năng (Tiến độ)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0] bg-white">
                    {isLoadingStudents ? (
                      <tr><td colSpan="4" className="py-20 text-center"><div className="flex flex-col items-center justify-center opacity-50"><div className="w-10 h-10 border-4 border-[#10B981] border-t-transparent rounded-full animate-spin mb-4"></div><p className="text-sm font-bold text-[#142033]">Đang đồng bộ dữ liệu hệ thống...</p></div></td></tr>
                    ) : studentsProgress.length === 0 ? (
                      <tr><td colSpan="4" className="py-20 text-center text-slate-500 font-medium">Chưa có dữ liệu học viên trong hệ thống.</td></tr>
                    ) : (
                      studentsProgress.map((student, index) => (
                        <tr key={student.id} className="hover:bg-[#F8FAFC] transition-colors group">
                          <td className="px-6 py-4 text-center">
                            <span className={`w-8 h-8 inline-flex items-center justify-center rounded-xl text-sm font-black ${index === 0 ? "bg-[#FFFBEB] text-[#F59E0B] border border-[#FDE68A]" : index === 1 ? "bg-slate-100 text-slate-500 border border-slate-200" : index === 2 ? "bg-orange-50 text-orange-600 border border-orange-200" : "bg-transparent text-[#94A3B8]"}`}>
                              {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <img src={student.avatar} alt="Avatar" className="w-10 h-10 rounded-full bg-slate-100 border border-[#E2E8F0] shrink-0" />
                              <div className="min-w-0">
                                <p className="font-bold text-[#142033] group-hover:text-[#10B981] transition-colors truncate">{student.name}</p>
                                <p className="text-[10px] font-medium text-[#94A3B8] truncate">{student.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1.5">
                              <span className="w-fit bg-[#F1F5F9] text-[#64748B] px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border border-[#E2E8F0]">{student.level}</span>
                              <div className="flex items-center gap-1.5 text-xs font-bold">
                                <span className="text-[#F59E0B]">{student.xp.toLocaleString()} ⭐</span><span className="text-slate-200">|</span><span className="text-rose-500">{student.streak} 🔥</span><span className="text-slate-200">|</span><span className="text-rose-600">{student.hearts} ❤️</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 w-full min-w-[360px]">
                              {student.skills.map((skill, i) => (
                                <div key={i} className="flex flex-col gap-1">
                                  <div className="flex items-center justify-between text-[10px]">
                                    <span className="font-bold text-[#64748B] flex items-center gap-1"><span className="opacity-80">{skill.icon}</span> {skill.name}</span>
                                    <span className="font-black text-[#142033]">{skill.val}%</span>
                                  </div>
                                  <div className="h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full transition-all ${skill.val > 0 ? skill.color : 'bg-transparent'}`} style={{ width: `${skill.val}%` }}></div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: CHẤM THI HSKK */}
          {activeTab === "grading" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-fade-in">
              <aside className="lg:col-span-4 w-full bg-white rounded-[24px] border border-[#E2E8F0] shadow-sm flex flex-col overflow-hidden shrink-0 max-h-[calc(100vh-200px)]">
                <div className="p-5 border-b border-[#E2E8F0] bg-[#F8FAFC] flex justify-between items-center">
                  <div>
                    <h3 className="font-black text-[#142033] text-base">Bài thi đang chờ</h3>
                    <p className="text-xs font-medium text-[#64748B] mt-0.5">Cần chấm điểm</p>
                  </div>
                  <span className="bg-[#FFF1F2] text-[#E11D48] border border-[#FECDD3] px-3 py-1 rounded-full text-xs font-bold shadow-sm">{pendingExams.length} bài</span>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
                  {isLoadingExams ? (
                    <div className="flex justify-center items-center py-10 opacity-50"><div className="w-8 h-8 border-4 border-[#10B981] border-t-transparent rounded-full animate-spin"></div></div>
                  ) : pendingExams.length === 0 ? (
                    <div className="text-center py-12 flex flex-col items-center justify-center opacity-60"><span className="text-5xl mb-4 grayscale opacity-50">🎉</span><p className="text-[#142033] font-bold text-sm">Tuyệt vời!</p><p className="text-xs text-[#64748B] font-medium">Bạn đã chấm xong toàn bộ bài thi HSKK.</p></div>
                  ) : (
                    pendingExams.map(exam => {
                      const isSelected = selectedExam?.id === exam.id;
                      return (
                        <button key={exam.id} onClick={() => handleSelectExam(exam)} className={`w-full text-left p-4 rounded-2xl border-2 transition-all group ${isSelected ? 'border-[#10B981] bg-[#ECFDF5] shadow-sm' : 'border-transparent bg-white hover:border-[#E2E8F0] hover:bg-[#F8FAFC]'}`}>
                          <div className="flex justify-between items-start mb-2">
                            <p className={`font-black text-sm ${isSelected ? 'text-[#065F46]' : 'text-[#142033]'}`}>{exam.userName}</p>
                            <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-md ${isSelected ? 'bg-[#10B981] text-white shadow-sm' : 'bg-[#E2E8F0] text-[#64748B]'}`}>{exam.level}</span>
                          </div>
                          <p className={`text-xs font-medium ${isSelected ? 'text-[#047857]' : 'text-[#94A3B8]'} truncate`}>{exam.userEmail || "Học viên ẩn danh"}</p>
                        </button>
                      );
                    })
                  )}
                </div>
              </aside>

              <section className="lg:col-span-8 w-full">
                {!selectedExam ? (
                  <div className="bg-white/60 border border-[#E2E8F0] border-dashed rounded-[32px] h-[calc(100vh-200px)] flex flex-col items-center justify-center text-center p-8">
                    <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center text-4xl mb-4 shadow-sm border border-[#E2E8F0]">📝</div>
                    <h3 className="text-lg font-black text-[#142033] mb-1">Chọn một bài thi</h3>
                    <p className="text-[#64748B] text-sm font-medium">Bấm vào một học viên ở danh sách bên trái để bắt đầu chấm điểm.</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-[32px] border border-[#E2E8F0] shadow-xl overflow-hidden animate-fade-in flex flex-col">
                    <div className="bg-[#142033] p-6 text-white flex justify-between items-center relative overflow-hidden">
                      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
                      <div className="relative z-10"><h2 className="text-2xl font-black mb-1">{selectedExam.userName}</h2><p className="text-sm font-medium text-slate-300">{selectedExam.userEmail}</p></div>
                      <div className="relative z-10 text-right"><span className="inline-block bg-[#10B981] text-white px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest shadow-md">{selectedExam.level}</span></div>
                    </div>

                    <div className="p-6 md:p-8 bg-[#F8FAFC] max-h-[500px] overflow-y-auto custom-scrollbar border-b border-[#E2E8F0]">
                      {examAnswers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 opacity-50"><div className="w-8 h-8 border-4 border-[#10B981] border-t-transparent rounded-full animate-spin mb-4"></div><p className="text-sm font-bold text-[#142033]">Đang tải dữ liệu ghi âm...</p></div>
                      ) : (
                        <div className="space-y-6">
                          {examAnswers.map((ans, idx) => (
                            <div key={ans.id} className="bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-sm relative">
                              <div className="absolute -top-3 -left-3 w-8 h-8 bg-[#10B981] text-white rounded-full flex items-center justify-center font-black text-sm shadow-md border-2 border-white">{idx + 1}</div>
                              <div className="pl-4 mb-4">
                                <span className="text-[10px] font-black uppercase tracking-widest text-[#94A3B8] bg-[#F1F5F9] px-2 py-1 rounded mb-2 inline-block">{ans.type === "repeat" ? "Nghe nhắc lại" : ans.type === "picture" ? "Nhìn tranh nói" : "Trả lời câu hỏi"}</span>
                                <p className="text-base font-bold text-[#142033] leading-relaxed">{ans.question}</p>
                              </div>
                              {ans.images && ans.images.length > 0 && (
                                <div className={`grid gap-3 mb-4 ${ans.images.length > 2 ? 'grid-cols-2' : 'grid-cols-1'} max-w-md`}>
                                  {ans.images.map((img, i) => (<img key={i} src={img} alt="đề bài" className="w-full rounded-xl border border-[#E2E8F0] shadow-sm object-cover" />))}
                                </div>
                              )}
                              <div className="bg-[#F8FAFC] rounded-xl p-3 border border-[#E2E8F0] mb-4">
                                {ans.audioBase64 || ans.audioUrl ? (
                                  <audio src={ans.audioBase64 || ans.audioUrl} controls className="w-full h-10 outline-none" />
                                ) : (
                                  <p className="text-[#F43F70] text-sm font-bold flex items-center gap-2"><span>⚠️</span> Học sinh bỏ qua không ghi âm câu này.</p>
                                )}
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mt-4 pt-4 border-t border-[#E2E8F0]">
                                <div className="md:col-span-3">
                                  <label className="block text-[10px] font-black text-[#64748B] uppercase tracking-widest mb-1.5">Điểm (0-100)</label>
                                  <input type="number" min="0" max="100" value={itemScores[ans.id] || ""} onChange={(e) => setItemScores(prev => ({...prev, [ans.id]: e.target.value}))} className="w-full p-3 rounded-xl border border-[#E2E8F0] text-lg font-black text-center text-[#10B981] focus:border-[#10B981] focus:bg-[#ECFDF5] outline-none transition-all" placeholder="0" />
                                </div>
                                <div className="md:col-span-9">
                                  <label className="block text-[10px] font-black text-[#64748B] uppercase tracking-widest mb-1.5">Ghi chú nhanh / Nhận xét câu này</label>
                                  <textarea rows="2" value={commentInputs[ans.id] || ""} onChange={(e) => handleCommentChange(ans.id, e.target.value)} placeholder="VD: Lỗi phát âm thanh 4, chưa ngắt nghỉ đúng chỗ..." className="w-full p-3 rounded-xl border border-[#E2E8F0] text-sm font-medium focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/10 outline-none resize-none transition-all placeholder:text-[#CBD5E1]"></textarea>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="p-6 md:p-8 bg-white flex flex-col gap-5">
                      <h3 className="text-lg font-black text-[#142033] flex items-center gap-2"><span>🎖️</span> Đánh giá Tổng quan & Chốt điểm</h3>
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                        <div className="md:col-span-3">
                          <label className="block text-[11px] font-black text-[#64748B] uppercase tracking-widest mb-2">Điểm tổng (Auto-sum)</label>
                          <input type="number" value={scoreInput} readOnly className="w-full p-4 rounded-xl border-2 border-[#E2E8F0] bg-slate-50 text-2xl font-black text-center text-[#10B981] outline-none transition-all cursor-not-allowed" />
                        </div>
                        <div className="md:col-span-9">
                          <label className="block text-[11px] font-black text-[#64748B] uppercase tracking-widest mb-2">Nhận xét tổng thể (Bắt buộc)</label>
                          <textarea value={feedbackInput} onChange={(e) => setFeedbackInput(e.target.value)} className="w-full p-4 rounded-xl border-2 border-[#E2E8F0] text-sm font-medium focus:border-[#10B981] focus:bg-[#F8FAFC] outline-none resize-none h-20 transition-all placeholder:text-[#94A3B8]" placeholder="Tổng kết ưu/khuyết điểm, định hướng ôn tập cho học viên..." />
                        </div>
                      </div>
                      <button onClick={submitGradeAndFinish} disabled={isSubmitting} className={`w-full py-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all shadow-md mt-2 ${isSubmitting ? 'bg-[#94A3B8] text-white cursor-not-allowed' : 'bg-[#142033] text-white hover:bg-black hover:-translate-y-0.5'}`}>
                        {isSubmitting ? "Đang lưu hệ thống..." : "Hoàn tất chấm thi & Gửi kết quả"}
                      </button>
                    </div>

                  </div>
                )}
              </section>
            </div>
          )}

          {/* TAB 3: CHẤM BÀI TEST NĂNG LỰC TOÀN DIỆN */}
          {activeTab === "grading_test" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-fade-in">
              <aside className="lg:col-span-4 w-full bg-white rounded-[24px] border border-[#E2E8F0] shadow-sm flex flex-col overflow-hidden shrink-0 max-h-[calc(100vh-200px)]">
                <div className="p-5 border-b border-[#E2E8F0] bg-[#F8FAFC] flex justify-between items-center">
                  <div>
                    <h3 className="font-black text-[#142033] text-base">Bài test đang chờ</h3>
                    <p className="text-xs font-medium text-[#64748B] mt-0.5">Đánh giá 4 kỹ năng</p>
                  </div>
                  <span className="bg-[#ECFDF5] text-[#10B981] border border-[#A7F3D0] px-3 py-1 rounded-full text-xs font-bold shadow-sm">{pendingTests.length} bài</span>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
                  {isLoadingTests ? (
                    <div className="flex justify-center items-center py-10 opacity-50"><div className="w-8 h-8 border-4 border-[#10B981] border-t-transparent rounded-full animate-spin"></div></div>
                  ) : pendingTests.length === 0 ? (
                    <div className="text-center py-12 flex flex-col items-center justify-center opacity-60">
                      <span className="text-5xl mb-4 grayscale opacity-50">🎉</span><p className="text-[#142033] font-bold text-sm">Tuyệt vời!</p><p className="text-xs text-[#64748B] font-medium">Bạn đã chấm xong toàn bộ bài Test.</p>
                    </div>
                  ) : (
                    pendingTests.map(test => {
                      const isSelected = selectedTest?.id === test.id;
                      return (
                        <button key={test.id} onClick={() => handleSelectTest(test)} className={`w-full text-left p-4 rounded-2xl border-2 transition-all group ${isSelected ? 'border-[#10B981] bg-[#ECFDF5] shadow-sm' : 'border-transparent bg-white hover:border-[#E2E8F0] hover:bg-[#F8FAFC]'}`}>
                          <div className="flex justify-between items-start mb-2">
                            <p className={`font-black text-sm ${isSelected ? 'text-[#065F46]' : 'text-[#142033]'}`}>{test.userName}</p>
                            <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-md ${isSelected ? 'bg-[#10B981] text-white shadow-sm' : 'bg-[#E2E8F0] text-[#64748B]'}`}>{test.level}</span>
                          </div>
                          <p className={`text-xs font-medium ${isSelected ? 'text-[#047857]' : 'text-[#94A3B8]'} truncate`}>{test.userEmail || "Học viên ẩn danh"}</p>
                        </button>
                      );
                    })
                  )}
                </div>
              </aside>

              <section className="lg:col-span-8 w-full">
                {!selectedTest ? (
                  <div className="bg-white/60 border border-[#E2E8F0] border-dashed rounded-[32px] h-[calc(100vh-200px)] flex flex-col items-center justify-center text-center p-8">
                    <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center text-4xl mb-4 shadow-sm border border-[#E2E8F0]">📝</div>
                    <h3 className="text-lg font-black text-[#142033] mb-1">Chọn một bài Test</h3>
                    <p className="text-[#64748B] text-sm font-medium">Bấm vào một học viên ở danh sách bên trái để bắt đầu chấm điểm và tư vấn.</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-[32px] border border-[#E2E8F0] shadow-xl overflow-hidden animate-fade-in flex flex-col">
                    
                    <div className="bg-[#142033] p-6 text-white flex justify-between items-center relative overflow-hidden">
                      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
                      <div className="relative z-10"><h2 className="text-2xl font-black mb-1">{selectedTest.userName}</h2><p className="text-sm font-medium text-slate-300">{selectedTest.userEmail}</p></div>
                      <div className="relative z-10 text-right"><span className="inline-block bg-[#10B981] text-white px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest shadow-md">Bài thi toàn diện</span></div>
                    </div>

                    <div className="p-6 md:p-8 bg-[#F8FAFC] max-h-[500px] overflow-y-auto custom-scrollbar border-b border-[#E2E8F0] space-y-8">
                      
                      {/* PHẦN 1: DỊCH CÂU (ĐỌC HIỂU) */}
                      {selectedTest.testData?.sections?.translate?.length > 0 && (
                        <div>
                          <h3 className="font-black text-[#142033] mb-4 flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm border border-[#E2E8F0] w-fit">
                            <span className="text-xl">📖</span> 1. Đọc Dịch (6 câu)
                          </h3>
                          <div className="space-y-4 pl-2 border-l-2 border-[#E2E8F0] ml-2">
                            {selectedTest.testData.sections.translate.map((item, idx) => {
                              const qId = `translate_${idx}`;
                              return (
                                <div key={qId} className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-sm ml-4 relative">
                                  <span className="absolute -left-[30px] top-5 w-4 h-4 rounded-full bg-white border-2 border-[#10B981] z-10"></span>
                                  <p className="font-bold text-[#142033] mb-3 text-base"><span className="text-[#94A3B8] mr-2">Q{idx + 1}.</span>{item.vietnamese || item.front}</p>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-[#F8FAFC] p-4 rounded-xl border border-[#E2E8F0]"><span className="text-[10px] font-black text-[#64748B] uppercase tracking-widest block mb-2">Học viên dịch</span><p className="font-bold text-[#BE123C] text-lg">{selectedTest.answers[qId] || "(Bỏ trống)"}</p></div>
                                    <div className="bg-[#ECFDF5] p-4 rounded-xl border border-[#A7F3D0]"><span className="text-[10px] font-black text-[#10B981] uppercase tracking-widest block mb-2">Đáp án chuẩn</span><p className="font-bold text-[#047857] text-lg">{item.chinese || item.front}</p></div>
                                  </div>
                                  {renderTestItemAction(qId, 10)}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* PHẦN 2: SẮP XẾP CÂU (NGỮ PHÁP) */}
                      {selectedTest.testData?.sections?.arrange?.length > 0 && (
                        <div>
                          <h3 className="font-black text-[#142033] mb-4 flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm border border-[#E2E8F0] w-fit">
                            <span className="text-xl">🧩</span> 2. Ngữ Pháp / Sắp xếp (6 câu)
                          </h3>
                          <div className="space-y-4 pl-2 border-l-2 border-[#E2E8F0] ml-2">
                            {selectedTest.testData.sections.arrange.map((item, idx) => {
                              const qId = `arrange_${idx}`;
                              return (
                                <div key={qId} className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-sm ml-4 relative">
                                  <span className="absolute -left-[30px] top-5 w-4 h-4 rounded-full bg-white border-2 border-[#10B981] z-10"></span>
                                  <p className="font-bold text-[#142033] mb-3 text-base"><span className="text-[#94A3B8] mr-2">Q{idx + 1}.</span>Ghép thành câu đúng:</p>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-[#F8FAFC] p-4 rounded-xl border border-[#E2E8F0]"><span className="text-[10px] font-black text-[#64748B] uppercase tracking-widest block mb-2">Học viên ghép</span><p className="font-bold text-[#BE123C] text-lg">{selectedTest.answers[qId] || "(Bỏ trống)"}</p></div>
                                    <div className="bg-[#ECFDF5] p-4 rounded-xl border border-[#A7F3D0]"><span className="text-[10px] font-black text-[#10B981] uppercase tracking-widest block mb-2">Đáp án chuẩn</span><p className="font-bold text-[#047857] text-lg">{item.chinese || item.front}</p></div>
                                  </div>
                                  {renderTestItemAction(qId, 10)}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* PHẦN 3: NGHE NHẮC LẠI (NGHE) */}
                      {selectedTest.testData?.sections?.repeat?.length > 0 && (
                        <div>
                          <h3 className="font-black text-[#142033] mb-4 flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm border border-[#E2E8F0] w-fit">
                            <span className="text-xl">🎧</span> 3. Kỹ năng Nghe (6 câu)
                          </h3>
                          <div className="space-y-4 pl-2 border-l-2 border-[#E2E8F0] ml-2">
                            {selectedTest.testData.sections.repeat.map((item, idx) => {
                              const qId = `repeat_${idx}`;
                              return (
                                <div key={qId} className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-sm ml-4 relative">
                                  <span className="absolute -left-[30px] top-5 w-4 h-4 rounded-full bg-white border-2 border-[#10B981] z-10"></span>
                                  <p className="font-bold text-[#142033] mb-3 text-base"><span className="text-[#94A3B8] mr-2">Q{idx + 1}.</span>Nghe và nhắc lại</p>
                                  
                                  <div className="bg-[#F8FAFC] rounded-xl p-3 border border-[#E2E8F0] mb-4">
                                    <span className="text-[10px] font-black text-[#64748B] uppercase tracking-widest block mb-2">Audio Học viên ghi âm</span>
                                    {selectedTest.answers[qId] ? (
                                      <audio src={selectedTest.answers[qId]} controls className="w-full h-10 outline-none" />
                                    ) : (
                                      <p className="text-[#F43F70] text-sm font-bold">⚠️ Bỏ qua không ghi âm.</p>
                                    )}
                                  </div>
                                  <div className="bg-[#ECFDF5] p-4 rounded-xl border border-[#A7F3D0]">
                                    <span className="text-[10px] font-black text-[#10B981] uppercase tracking-widest block mb-2">Đáp án văn bản gốc</span>
                                    <p className="font-bold text-[#047857] text-lg">{item.chinese || item.front}</p>
                                  </div>

                                  {renderTestItemAction(qId, 10)}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* PHẦN 4: NHÌN TRANH NÓI (NÓI) */}
                      {selectedTest.testData?.sections?.picture?.length > 0 && (
                        <div>
                          <h3 className="font-black text-[#142033] mb-4 flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm border border-[#E2E8F0] w-fit">
                            <span className="text-xl">🗣️</span> 4. Kỹ năng Nói (1 câu)
                          </h3>
                          <div className="space-y-4 pl-2 border-l-2 border-[#E2E8F0] ml-2">
                            {selectedTest.testData.sections.picture.map((item, idx) => {
                              const qId = `picture_${idx}`;
                              return (
                                <div key={qId} className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-sm ml-4 relative">
                                  <span className="absolute -left-[30px] top-5 w-4 h-4 rounded-full bg-white border-2 border-[#10B981] z-10"></span>
                                  <p className="font-bold text-[#142033] mb-3 text-base"><span className="text-[#94A3B8] mr-2">Q{idx + 1}.</span>Nhìn tranh và miêu tả</p>
                                  
                                  {item.images && item.images.length > 0 && (
                                    <div className="mb-4">
                                      {item.images.map((img, i) => (<img key={i} src={img} alt="đề bài" className="w-full max-w-sm rounded-xl border border-[#E2E8F0] shadow-sm object-cover" />))}
                                    </div>
                                  )}

                                  <div className="bg-[#F8FAFC] rounded-xl p-3 border border-[#E2E8F0]">
                                    <span className="text-[10px] font-black text-[#64748B] uppercase tracking-widest block mb-2">Audio Học viên ghi âm</span>
                                    {selectedTest.answers[qId] ? (
                                      <audio src={selectedTest.answers[qId]} controls className="w-full h-10 outline-none" />
                                    ) : (
                                      <p className="text-[#F43F70] text-sm font-bold">⚠️ Bỏ qua không ghi âm.</p>
                                    )}
                                  </div>
                                  
                                  {renderTestItemAction(qId, 20)}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* PHẦN 5: VIẾT LUẬN (VIẾT) */}
                      {selectedTest.testData?.sections?.essay?.length > 0 && (
                        <div>
                          <h3 className="font-black text-[#142033] mb-4 flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm border border-[#E2E8F0] w-fit">
                            <span className="text-xl">📝</span> 5. Kỹ năng Viết (2 câu)
                          </h3>
                          <div className="space-y-4 pl-2 border-l-2 border-[#E2E8F0] ml-2">
                            {selectedTest.testData.sections.essay.map((item, idx) => {
                              const qId = `essay_${idx}`;
                              return (
                                <div key={qId} className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-sm ml-4 relative">
                                  <span className="absolute -left-[30px] top-5 w-4 h-4 rounded-full bg-white border-2 border-[#10B981] z-10"></span>
                                  <p className="font-bold text-[#142033] mb-3 text-base"><span className="text-[#94A3B8] mr-2">Q{idx + 1}.</span>Đề bài: {item.prompt}</p>
                                  <div className="bg-[#F8FAFC] p-5 rounded-xl border border-[#E2E8F0]">
                                    <span className="text-[10px] font-black text-[#64748B] uppercase tracking-widest block mb-2">Bài làm của học viên</span>
                                    <p className="font-medium text-[#142033] whitespace-pre-wrap text-base leading-relaxed">{selectedTest.answers[qId] || "(Bỏ trống)"}</p>
                                  </div>
                                  {renderTestItemAction(qId, 20)}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      
                    </div>

                    {/* FORM TỔNG KẾT VÀ TƯ VẤN LỘ TRÌNH */}
                    <div className="p-6 md:p-8 bg-[#142033] text-white flex flex-col gap-6">
                      <div className="flex items-center gap-3 border-b border-white/20 pb-4">
                        <span className="text-3xl">🧑‍🏫</span>
                        <div>
                          <h3 className="text-xl font-black text-white">Chốt Cấp Độ & Tư Vấn Lộ Trình</h3>
                          <p className="text-xs font-medium text-slate-400">Báo cáo này sẽ được gửi trực tiếp về bảng điều khiển của học viên.</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        {/* 4 KỸ NĂNG */}
                        <div className="bg-white/5 p-5 rounded-2xl border border-white/10 space-y-4">
                          <h4 className="text-sm font-black text-[#10B981] uppercase tracking-widest mb-2 border-b border-white/10 pb-2">Điểm 4 Kỹ Năng</h4>
                          
                          {['listening', 'speaking', 'reading', 'writing'].map((skill) => (
                            <div key={skill} className="flex flex-col gap-2">
                              <div className="flex justify-between items-center">
                                <label className="text-xs font-bold text-slate-300 capitalize">{skill === 'listening' ? "🎧 Nghe" : skill === 'speaking' ? "🗣️ Nói" : skill === 'reading' ? "📖 Đọc/Ngữ pháp" : "📝 Viết"}</label>
                                <div className="flex items-center gap-2">
                                  <input 
                                    type="number" min="0" max="100"
                                    value={testSkillScores[skill]} 
                                    onChange={(e) => setTestSkillScores(prev => ({...prev, [skill]: e.target.value}))}
                                    className="w-16 p-2 rounded-lg bg-white/10 border border-white/20 text-center text-white text-sm font-black outline-none focus:border-[#10B981]"
                                    placeholder="0"
                                  />
                                  <span className="text-[10px] text-slate-500">/100</span>
                                </div>
                              </div>
                              <textarea 
                                rows="1"
                                value={testSkillFeedbacks[skill]} 
                                onChange={(e) => setTestSkillFeedbacks(prev => ({...prev, [skill]: e.target.value}))}
                                className="w-full p-2.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white outline-none resize-none focus:border-[#10B981] placeholder:text-slate-500"
                                placeholder={`Nhận xét kỹ năng ${skill}...`}
                              />
                            </div>
                          ))}
                        </div>

                        {/* ĐÁNH GIÁ CHUNG */}
                        <div className="flex flex-col gap-5">
                          <div className="flex gap-4">
                            <div className="flex-1">
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Đánh giá cấp độ</label>
                              <select 
                                value={testEvalLevel} onChange={(e) => setTestEvalLevel(e.target.value)}
                                className="w-full p-4 rounded-xl bg-white/10 border border-white/20 text-white font-black outline-none focus:border-[#10B981] cursor-pointer"
                              >
                                {[1,2,3,4,5,6,7,8,9].map(l => <option key={l} value={`HSK ${l}`} className="text-black">HSK {l}</option>)}
                              </select>
                            </div>
                            <div className="w-1/3">
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 text-center">Tổng điểm</label>
                              <div className="w-full p-4 rounded-xl bg-[#10B981]/20 border border-[#10B981] text-2xl font-black text-[#10B981] text-center flex items-center justify-center">
                                {testTotalScore}
                              </div>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Đánh giá chung (Bắt buộc)</label>
                            <textarea 
                              value={testGeneralFeedback} onChange={(e) => setTestGeneralFeedback(e.target.value)}
                              className="w-full p-4 rounded-xl bg-white/5 border border-white/10 text-sm text-white outline-none resize-none h-24 focus:border-[#10B981] placeholder:text-slate-500"
                              placeholder="Nhận xét tổng quan về thế mạnh và điểm yếu..."
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Lời khuyên / Lộ trình học (Bắt buộc)</label>
                            <textarea 
                              value={testRecommendation} onChange={(e) => setTestRecommendation(e.target.value)}
                              className="w-full p-4 rounded-xl bg-white/5 border border-white/10 text-sm text-white outline-none resize-none h-24 focus:border-[#10B981] placeholder:text-slate-500"
                              placeholder="Đề xuất học viên nên tập trung vào kỹ năng nào tiếp theo..."
                            />
                          </div>
                        </div>

                      </div>

                      <button 
                        onClick={submitTestGradeAndFinish}
                        disabled={isSubmitting}
                        className={`w-full py-4 rounded-xl font-black text-base tracking-widest transition-all shadow-md mt-2 ${isSubmitting ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-[#10B981] text-white hover:bg-[#059669] hover:-translate-y-0.5 border-b-[4px] border-[#047857]'}`}
                      >
                        {isSubmitting ? "Đang gửi báo cáo..." : "Chốt Kết Quả & Gửi Báo Cáo"}
                      </button>
                    </div>

                  </div>
                )}
              </section>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}