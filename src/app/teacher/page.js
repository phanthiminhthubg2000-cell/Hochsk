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
  const [activeTab, setActiveTab] = useState("students"); // 'students' | 'grading'

  // --- STATES CHẤM THI ---
  const [pendingExams, setPendingExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  const [examAnswers, setExamAnswers] = useState([]);
  const [scoreInput, setScoreInput] = useState("");
  const [feedbackInput, setFeedbackInput] = useState("");
  const [commentInputs, setCommentInputs] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingExams, setIsLoadingExams] = useState(true);

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

  // ==========================================
  // FETCH DATA: BÀI THI CHỜ CHẤM
  // ==========================================
  const fetchPendingExams = async () => {
    setIsLoadingExams(true);
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
      setIsLoadingExams(false);
    }
  };

  // ==========================================
  // FETCH DATA: TOÀN BỘ TIẾN ĐỘ HỌC VIÊN
  // ==========================================
  const fetchAllStudentsProgress = async () => {
    setIsLoadingStudents(true);
    try {
      const usersSnap = await getDocs(collection(db, "users")).catch(() => ({ empty: true, forEach: () => {} }));
      const progressSnap = await getDocs(collection(db, "progress")).catch(() => ({ empty: true, forEach: () => {} }));
      const userProgressSnap = await getDocs(collection(db, "user_progress")).catch(() => ({ empty: true, forEach: () => {} }));

      const pMap = {};
      progressSnap.forEach(d => { pMap[d.id] = d.data(); });
      
      const upMap = {};
      userProgressSnap.forEach(d => { upMap[d.id] = d.data(); });

      const studentsMap = new Map();

      const processUserData = (id, uData, pData, upData) => {
        if (uData?.role === 'teacher' || uData?.role === 'admin') return;
        
        const skills = upData?.skill_map || {};

        studentsMap.set(id, {
          id: id,
          name: uData?.fullName || pData?.name || upData?.profile?.name || "Học viên ẩn danh",
          email: uData?.email || "Không công khai",
          level: uData?.currentLevel || upData?.profile?.level || "HSK 1",
          xp: uData?.xp || upData?.profile?.hsk_xp || pData?.xp || 0,
          streak: uData?.streak || upData?.profile?.streak_days || pData?.streakCount || 0,
          hearts: uData?.hearts || upData?.profile?.hearts || pData?.hearts || 5,
          avatar: pData?.avatar || upData?.profile?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${id}`,
          skills: [
            { id: "vocab", name: "Từ vựng", icon: "📚", color: "bg-blue-500", val: Math.min(skills.vocabulary || 0, 100) },
            { id: "grammar", name: "Ngữ pháp", icon: "🧩", color: "bg-purple-500", val: Math.min(skills.grammar || 0, 100) },
            { id: "listen", name: "Nghe", icon: "🎧", color: "bg-amber-500", val: Math.min(skills.listening || 0, 100) },
            { id: "translate", name: "Dịch", icon: "✍️", color: "bg-rose-500", val: Math.min(skills.translation || 0, 100) },
            { id: "write", name: "Viết", icon: "📝", color: "bg-indigo-500", val: Math.min(skills.writing || 0, 100) },
            { id: "speak", name: "Nói", icon: "🗣️", color: "bg-[#10B981]", val: Math.min(skills.speaking || 0, 100) },
          ]
        });
      };

      usersSnap.forEach(doc => { processUserData(doc.id, doc.data(), pMap[doc.id], upMap[doc.id]); });
      progressSnap.forEach(doc => { if (!studentsMap.has(doc.id)) processUserData(doc.id, {}, doc.data(), upMap[doc.id]); });

      const studentsList = Array.from(studentsMap.values());
      studentsList.sort((a, b) => b.xp - a.xp); 
      setStudentsProgress(studentsList);

    } catch (error) {
      console.error("Lỗi lấy dữ liệu học sinh:", error);
    } finally {
      setIsLoadingStudents(false);
    }
  };

  useEffect(() => {
    fetchPendingExams();
    fetchAllStudentsProgress();
  }, []);

  // --- LOGIC CHẤM THI ---
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

  const handleCommentChange = (answerId, text) => {
    setCommentInputs(prev => ({ ...prev, [answerId]: text }));
  };

  const submitGradeAndFinish = async () => {
    if (!scoreInput || !feedbackInput.trim()) {
      return alert("Vui lòng nhập đầy đủ điểm số tổng và nhận xét chung!");
    }
    setIsSubmitting(true);
    try {
      for (const ans of examAnswers) {
        const answerDocRef = doc(db, "hskk_exams", selectedExam.id, "answers", ans.id);
        await updateDoc(answerDocRef, { teacherComment: commentInputs[ans.id] || "" });
      }
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

  if (!isLoaded) return <div className="min-h-screen bg-[#F7FAF8]"></div>;

  return (
    <div className="flex min-h-screen font-sans text-[#142033] bg-[#F7FAF8] selection:bg-[#10B981]/20">
      
      {/* ==========================================
          SIDEBAR - CHỈ DÀNH CHO ADMIN
          ========================================== */}
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
              
              <button 
                onClick={() => setActiveTab("students")}
                className={`w-full mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-all ${activeTab === 'students' ? 'bg-[#ECFDF5] text-[#10B981] border border-[#A7F3D0]/30 shadow-sm' : 'text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#142033]'}`}
              >
                <span className="text-lg">📊</span>{!isSidebarCollapsed && <span>Tiến độ Học viên</span>}
              </button>

              <button 
                onClick={() => setActiveTab("grading")}
                className={`w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-bold transition-all ${activeTab === 'grading' ? 'bg-[#ECFDF5] text-[#10B981] border border-[#A7F3D0]/30 shadow-sm' : 'text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#142033]'}`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">🎙️</span>{!isSidebarCollapsed && <span>Chấm thi HSKK</span>}
                </div>
                {!isSidebarCollapsed && pendingExams.length > 0 && (
                  <span className="bg-[#F43F70] text-white text-[10px] px-2 py-0.5 rounded-full shadow-sm">{pendingExams.length}</span>
                )}
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

      {/* ======================================================
          MAIN CONTENT
          ====================================================== */}
      <main className={`min-h-screen transition-all duration-300 relative w-full flex flex-col ${isSidebarCollapsed ? "md:pl-[76px]" : "md:pl-[240px]"}`}>
        
        {/* TOP BAR */}
        <header className="sticky top-0 z-30 h-16 border-b border-[#E2E8F0] bg-white/90 px-6 backdrop-blur-md flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="font-black text-lg hidden sm:block text-[#142033]">Bảng Điều Khiển Admin (Teacher Dashboard)</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 shadow-sm">
              <span className="text-sm">⭐</span><span className="text-xs font-black text-[#F4B740]">{hskXp}</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 shadow-sm">
              <span className="text-sm">❤️</span><span className="text-xs font-black text-[#F43F70]">{hearts}</span>
            </div>
          </div>
        </header>

        <div className="flex-1 p-6 md:p-8 max-w-[1400px] mx-auto w-full">
          
          <div className="mb-8">
            <h1 className="text-3xl font-black text-[#142033] tracking-tight">Khu vực Quản trị</h1>
            <p className="text-[#64748B] font-medium mt-1">
              {activeTab === 'students' ? "Quản lý dữ liệu và theo dõi tiến độ của toàn bộ học viên trong hệ thống." : "Đánh giá kết quả phần thi kỹ năng nói (HSKK) của học viên."}
            </p>
          </div>

          {/* =========================================================
              TAB 1: TIẾN ĐỘ HỌC VIÊN
              ========================================================= */}
          {activeTab === "students" && (
            <div className="bg-white rounded-[32px] border border-[#E2E8F0] shadow-sm overflow-hidden animate-fade-in">
              <div className="p-6 md:p-8 border-b border-[#E2E8F0] bg-[#F8FAFC] flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-black text-[#142033]">Danh sách Học Viên</h3>
                  <p className="text-sm font-medium text-[#64748B] mt-1">Bảng tổng hợp xếp hạng và mức độ hoàn thiện của từng module kỹ năng.</p>
                </div>
                <button onClick={fetchAllStudentsProgress} className="w-10 h-10 rounded-xl bg-white border border-[#E2E8F0] flex items-center justify-center shadow-sm text-lg hover:bg-slate-50 transition" title="Làm mới dữ liệu">
                  🔄
                </button>
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
                      <tr>
                        <td colSpan="4" className="py-20 text-center">
                          <div className="flex flex-col items-center justify-center opacity-50">
                            <div className="w-10 h-10 border-4 border-[#10B981] border-t-transparent rounded-full animate-spin mb-4"></div>
                            <p className="text-sm font-bold text-[#142033]">Đang đồng bộ dữ liệu hệ thống...</p>
                          </div>
                        </td>
                      </tr>
                    ) : studentsProgress.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="py-20 text-center text-slate-500 font-medium">
                          Chưa có dữ liệu học viên trong hệ thống.
                        </td>
                      </tr>
                    ) : (
                      studentsProgress.map((student, index) => (
                        <tr key={student.id} className="hover:bg-[#F8FAFC] transition-colors group">
                          
                          <td className="px-6 py-4 text-center">
                            <span className={`w-8 h-8 inline-flex items-center justify-center rounded-xl text-sm font-black ${
                              index === 0 ? "bg-[#FFFBEB] text-[#F59E0B] border border-[#FDE68A]" : 
                              index === 1 ? "bg-slate-100 text-slate-500 border border-slate-200" : 
                              index === 2 ? "bg-orange-50 text-orange-600 border border-orange-200" : 
                              "bg-transparent text-[#94A3B8]"
                            }`}>
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
                              <span className="w-fit bg-[#F1F5F9] text-[#64748B] px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border border-[#E2E8F0]">
                                {student.level}
                              </span>
                              <div className="flex items-center gap-1.5 text-xs font-bold">
                                <span className="text-[#F59E0B]">{student.xp.toLocaleString()} ⭐</span>
                                <span className="text-slate-200">|</span>
                                <span className="text-rose-500">{student.streak} 🔥</span>
                                <span className="text-slate-200">|</span>
                                <span className="text-rose-600">{student.hearts} ❤️</span>
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

          {/* =========================================================
              TAB 2: CHẤM THI HSKK
              ========================================================= */}
          {activeTab === "grading" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-fade-in">
              <aside className="lg:col-span-4 w-full bg-white rounded-[24px] border border-[#E2E8F0] shadow-sm flex flex-col overflow-hidden shrink-0 max-h-[calc(100vh-200px)]">
                <div className="p-5 border-b border-[#E2E8F0] bg-[#F8FAFC] flex justify-between items-center">
                  <div>
                    <h3 className="font-black text-[#142033] text-base">Bài thi đang chờ</h3>
                    <p className="text-xs font-medium text-[#64748B] mt-0.5">Cần chấm điểm</p>
                  </div>
                  <span className="bg-[#FFF1F2] text-[#E11D48] border border-[#FECDD3] px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                    {pendingExams.length} bài
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
                  {isLoadingExams ? (
                    <div className="flex justify-center items-center py-10 opacity-50">
                      <div className="w-8 h-8 border-4 border-[#10B981] border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  ) : pendingExams.length === 0 ? (
                    <div className="text-center py-12 flex flex-col items-center justify-center opacity-60">
                      <span className="text-5xl mb-4 grayscale opacity-50">🎉</span>
                      <p className="text-[#142033] font-bold text-sm">Tuyệt vời!</p>
                      <p className="text-xs text-[#64748B] font-medium">Bạn đã chấm xong toàn bộ bài thi.</p>
                    </div>
                  ) : (
                    pendingExams.map(exam => {
                      const isSelected = selectedExam?.id === exam.id;
                      return (
                        <button 
                          key={exam.id}
                          onClick={() => handleSelectExam(exam)}
                          className={`w-full text-left p-4 rounded-2xl border-2 transition-all group ${isSelected ? 'border-[#10B981] bg-[#ECFDF5] shadow-sm' : 'border-transparent bg-white hover:border-[#E2E8F0] hover:bg-[#F8FAFC]'}`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <p className={`font-black text-sm ${isSelected ? 'text-[#065F46]' : 'text-[#142033]'}`}>{exam.userName}</p>
                            <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-md ${isSelected ? 'bg-[#10B981] text-white shadow-sm' : 'bg-[#E2E8F0] text-[#64748B]'}`}>
                              {exam.level}
                            </span>
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
                      <div className="relative z-10">
                        <h2 className="text-2xl font-black mb-1">{selectedExam.userName}</h2>
                        <p className="text-sm font-medium text-slate-300">{selectedExam.userEmail}</p>
                      </div>
                      <div className="relative z-10 text-right">
                        <span className="inline-block bg-[#10B981] text-white px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest shadow-md">
                          {selectedExam.level}
                        </span>
                      </div>
                    </div>

                    <div className="p-6 md:p-8 bg-[#F8FAFC] max-h-[500px] overflow-y-auto custom-scrollbar border-b border-[#E2E8F0]">
                      {examAnswers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 opacity-50">
                          <div className="w-8 h-8 border-4 border-[#10B981] border-t-transparent rounded-full animate-spin mb-4"></div>
                          <p className="text-sm font-bold text-[#142033]">Đang tải dữ liệu ghi âm...</p>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          {examAnswers.map((ans, idx) => (
                            <div key={ans.id} className="bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-sm relative">
                              <div className="absolute -top-3 -left-3 w-8 h-8 bg-[#10B981] text-white rounded-full flex items-center justify-center font-black text-sm shadow-md border-2 border-white">
                                {idx + 1}
                              </div>
                              
                              <div className="pl-4 mb-4">
                                <span className="text-[10px] font-black uppercase tracking-widest text-[#94A3B8] bg-[#F1F5F9] px-2 py-1 rounded mb-2 inline-block">
                                  {ans.type === "repeat" ? "Nghe nhắc lại" : ans.type === "picture" ? "Nhìn tranh nói" : "Trả lời câu hỏi"}
                                </span>
                                <p className="text-base font-bold text-[#142033] leading-relaxed">{ans.question}</p>
                              </div>
                              
                              {ans.images && ans.images.length > 0 && (
                                <div className={`grid gap-3 mb-4 ${ans.images.length > 2 ? 'grid-cols-2' : 'grid-cols-1'} max-w-md`}>
                                  {ans.images.map((img, i) => (
                                    <img key={i} src={img} alt="đề bài" className="w-full rounded-xl border border-[#E2E8F0] shadow-sm object-cover" />
                                  ))}
                                </div>
                              )}

                              <div className="bg-[#F8FAFC] rounded-xl p-3 border border-[#E2E8F0] mb-4">
                                {ans.audioBase64 || ans.audioUrl ? (
                                  <audio src={ans.audioBase64 || ans.audioUrl} controls className="w-full h-10 outline-none" />
                                ) : (
                                  <p className="text-[#F43F70] text-sm font-bold flex items-center gap-2">
                                    <span>⚠️</span> Học sinh bỏ qua không ghi âm câu này.
                                  </p>
                                )}
                              </div>

                              <div>
                                <label className="block text-[10px] font-black text-[#64748B] uppercase tracking-widest mb-1.5">Ghi chú nhanh / Nhận xét câu này</label>
                                <textarea 
                                  rows="2"
                                  value={commentInputs[ans.id] || ""}
                                  onChange={(e) => handleCommentChange(ans.id, e.target.value)}
                                  placeholder="VD: Lỗi phát âm thanh 4, chưa ngắt nghỉ đúng chỗ..."
                                  className="w-full p-3 rounded-xl border border-[#E2E8F0] text-sm font-medium focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/10 outline-none resize-none transition-all placeholder:text-[#CBD5E1]"
                                ></textarea>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="p-6 md:p-8 bg-white flex flex-col gap-5">
                      <h3 className="text-lg font-black text-[#142033] flex items-center gap-2">
                        <span>🎖️</span> Đánh giá Tổng quan & Chốt điểm
                      </h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                        <div className="md:col-span-3">
                          <label className="block text-[11px] font-black text-[#64748B] uppercase tracking-widest mb-2">Điểm tổng (0-100)</label>
                          <input 
                            type="number" min="0" max="100"
                            value={scoreInput} onChange={(e) => setScoreInput(e.target.value)}
                            className="w-full p-4 rounded-xl border-2 border-[#E2E8F0] text-2xl font-black text-center text-[#10B981] focus:border-[#10B981] focus:bg-[#ECFDF5] outline-none transition-all"
                            placeholder="85"
                          />
                        </div>
                        
                        <div className="md:col-span-9">
                          <label className="block text-[11px] font-black text-[#64748B] uppercase tracking-widest mb-2">Nhận xét tổng thể (Bắt buộc)</label>
                          <textarea 
                            value={feedbackInput} onChange={(e) => setFeedbackInput(e.target.value)}
                            className="w-full p-4 rounded-xl border-2 border-[#E2E8F0] text-sm font-medium focus:border-[#10B981] focus:bg-[#F8FAFC] outline-none resize-none h-20 transition-all placeholder:text-[#94A3B8]"
                            placeholder="Tổng kết ưu/khuyết điểm, định hướng ôn tập cho học viên..."
                          />
                        </div>
                      </div>

                      <button 
                        onClick={submitGradeAndFinish}
                        disabled={isSubmitting}
                        className={`w-full py-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all shadow-md mt-2 ${isSubmitting ? 'bg-[#94A3B8] text-white cursor-not-allowed' : 'bg-[#142033] text-white hover:bg-black hover:-translate-y-0.5'}`}
                      >
                        {isSubmitting ? "Đang lưu hệ thống..." : "Hoàn tất chấm thi & Gửi kết quả"}
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