"use client";
import Link from "next/link";
import { useAuth, useUser, SignInButton, UserButton } from "@clerk/nextjs";
import { useEffect, useState, useRef, useCallback } from "react";
import { db } from "../../firebase";
import { doc, getDoc, collection, getDocs, query, where, updateDoc, addDoc, serverTimestamp, deleteDoc } from "firebase/firestore";

const LEVEL_OPTIONS = [
  "Msutong HSK1",
  "Msutong HSK2",
  "Msutong HSK3.1",
  "Msutong HSK3.2",
  "HSK4.1 2.0",
  "HSK4.2 2.0",
  "HSK5.1 2.0",
  "HSK5.2 2.0",
  "HSK1 3.0",
  "HSK2 3.0",
  "HSK3 3.0",
  "HSK4.1 3.0",
  "HSK4.2 3.0",
  "HSK5.1 3.0",
  "HSK5.2 3.0"
];

export default function TeacherDashboard() {
  const { isSignedIn, userId } = useAuth();
  const { user, isLoaded } = useUser();

  // --- TAB NAVIGATION ---
  const [activeTab, setActiveTab] = useState("students");

  // --- STATES QUẢN LÝ LỚP HỌC & KHO BÀI KIỂM TRA ---
  const [classesList, setClassesList] = useState([]);
  const [isAddClassModalOpen, setIsAddClassModalOpen] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [newClassStudents, setNewClassStudents] = useState("");
  const [newClassLevel, setNewClassLevel] = useState("Msutong HSK1");

  const [editingClass, setEditingClass] = useState(null);
  const [editClassName, setEditClassName] = useState("");
  const [editClassStudents, setEditClassStudents] = useState("");
  const [editClassLevel, setEditClassLevel] = useState("Msutong HSK1");

  const [testsBank, setTestsBank] = useState([]);
  const [isAddTestModalOpen, setIsAddTestModalOpen] = useState(false);
  const [newTestName, setNewTestName] = useState("");
  const [newTestLevel, setNewTestLevel] = useState("Msutong HSK1");
  const [newTestContent, setNewTestContent] = useState("");

  const [editingTest, setEditingTest] = useState(null);
  const [editTestName, setEditTestName] = useState("");
  const [editTestLevel, setEditTestLevel] = useState("Msutong HSK1");
  const [editTestContent, setEditTestContent] = useState("");

  // --- STATES QUẢN LÝ KHO BÀI GIẢNG ---
  const [lecturesBank, setLecturesBank] = useState([]);
  const [isAddLectureModalOpen, setIsAddLectureModalOpen] = useState(false);
  const [newLectureName, setNewLectureName] = useState("");
  const [newLectureLevel, setNewLectureLevel] = useState("Msutong HSK1");
  const [newLectureHtmlContent, setNewLectureHtmlContent] = useState("");
  const [activeLectureView, setActiveLectureView] = useState(null);
  const lectureContainerRef = useRef(null);

  // State quản lý việc ẩn/hiện (thu gọn/mở rộng) theo từng cấp độ
  const [collapsedLevels, setCollapsedLevels] = useState({});

  const toggleLevelCollapse = (lvl) => {
    setCollapsedLevels(prev => ({ ...prev, [lvl]: !prev[lvl] }));
  };

  // --- STATES THỰC HIỆN KIỂM TRA TRỰC TIẾP ---
  const [isTestSelectModalOpen, setIsTestSelectModalOpen] = useState(false);
  const [targetStudentForTest, setTargetStudentForTest] = useState(null);
  const [targetClassForTest, setTargetClassForTest] = useState(null);
  const [selectedLevelFilter, setSelectedLevelFilter] = useState("Msutong HSK1");
  const [selectedTestId, setSelectedTestId] = useState("");

  const [isLiveTesting, setIsLiveTesting] = useState(false);
  const [selectedClassForTest, setSelectedClassForTest] = useState(null);
  const [selectedStudentForTest, setSelectedStudentForTest] = useState(null);
  const [selectedTestBankItem, setSelectedTestBankItem] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [totalTimeLeft, setTotalTimeLeft] = useState(0);
  const [testResultsLog, setTestResultsLog] = useState([]);
  const [isTestCompleted, setIsTestCompleted] = useState(false);
  
  const [selectedStudentHistory, setSelectedStudentHistory] = useState(null);
  const [selectedClassForHistory, setSelectedClassForHistory] = useState(null);
  const [activeTestDetail, setActiveTestDetail] = useState(null);

  const [classSummaryModalClass, setClassSummaryModalClass] = useState(null);
  const [classSummaryTestName, setClassSummaryTestName] = useState("");

  // --- STATES CHẤM THI HSKK & TEST ---
  const [pendingExams, setPendingExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  const [examAnswers, setExamAnswers] = useState([]);
  const [scoreInput, setScoreInput] = useState("");
  const [feedbackInput, setFeedbackInput] = useState("");
  const [commentInputs, setCommentInputs] = useState({});
  const [itemScores, setItemScores] = useState({}); 
  const [isLoadingExams, setIsLoadingExams] = useState(true);

  const [pendingTests, setPendingTests] = useState([]);
  const [selectedTest, setSelectedTest] = useState(null);
  const [questionScores, setQuestionScores] = useState({}); 
  const [questionComments, setQuestionComments] = useState({}); 
  const [isLoadingTests, setIsLoadingTests] = useState(true);
  
  const [testEvalLevel, setTestEvalLevel] = useState("Msutong HSK1");
  const [testSkillScores, setTestSkillScores] = useState({ listening: "", speaking: "", reading: "", writing: "" });
  const [testSkillFeedbacks, setTestSkillFeedbacks] = useState({ listening: "", speaking: "", reading: "", writing: "" });
  const [testGeneralFeedback, setTestGeneralFeedback] = useState("");
  const [testRecommendation, setTestRecommendation] = useState("");
  const [testTotalScore, setTestTotalScore] = useState(0);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [studentsProgress, setStudentsProgress] = useState([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(true);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [hskXp, setHskXp] = useState(0);
  const [hearts, setHearts] = useState(5);
  const [streak, setStreak] = useState(0);

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

  useEffect(() => {
    if (activeTab === "grading" && selectedExam) {
      const total = Object.values(itemScores).reduce((sum, val) => sum + (Number(val) || 0), 0);
      setScoreInput(total.toString());
    }
  }, [itemScores, activeTab, selectedExam]);

  useEffect(() => {
    if (activeTab === "grading_test" && selectedTest) {
      const total = (Number(testSkillScores.listening) || 0) +
                    (Number(testSkillScores.speaking) || 0) +
                    (Number(testSkillScores.reading) || 0) +
                    (Number(testSkillScores.writing) || 0);
      setTestTotalScore(total);
    }
  }, [testSkillScores, activeTab, selectedTest]);

  const openTestSelectModal = (cls, student) => {
    setTargetClassForTest(cls);
    setTargetStudentForTest(student);
    setSelectedLevelFilter("Msutong HSK1");
    setSelectedTestId("");
    setIsTestSelectModalOpen(true);
  };

  const handleConfirmStartTest = () => {
    const chosenTest = testsBank.find(t => t.id === selectedTestId);
    if (!chosenTest) return alert("Vui lòng chọn bài kiểm tra từ kho!");
    if (!chosenTest.questions || chosenTest.questions.length === 0) {
      return alert("Bài kiểm tra này không có câu hỏi nào!");
    }
    setIsTestSelectModalOpen(false);
    
    let timePerItem = 4;
    const lvlLower = (chosenTest.level || "").toLowerCase();
    if (lvlLower.includes("hsk4") || lvlLower.includes("hsk5")) {
      timePerItem = 3;
    }

    const totalDuration = chosenTest.questions.length * timePerItem;

    setSelectedClassForTest(targetClassForTest);
    setSelectedStudentForTest(targetStudentForTest);
    setSelectedTestBankItem(chosenTest);
    setCurrentQuestionIndex(0);
    setTestResultsLog([]);
    setIsTestCompleted(false);
    setTotalTimeLeft(totalDuration);
    setIsLiveTesting(true);
  };

  // Quản lý đếm ngược thời gian tổng
  useEffect(() => {
    let timer;
    if (isLiveTesting && !isTestCompleted && totalTimeLeft > 0) {
      timer = setInterval(() => {
        setTotalTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (isLiveTesting && !isTestCompleted && totalTimeLeft === 0) {
      handleTimeOutFinish();
    }
    return () => clearInterval(timer);
  }, [isLiveTesting, totalTimeLeft, isTestCompleted]);

  const handleRecordAnswer = (isCorrect) => {
    if (!selectedTestBankItem) return;
    const currentQuestion = selectedTestBankItem.questions[currentQuestionIndex];
    const updatedLog = [...testResultsLog, { question: currentQuestion, correct: isCorrect }];
    setTestResultsLog(updatedLog);

    if (currentQuestionIndex + 1 < selectedTestBankItem.questions.length) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      setIsTestCompleted(true);
      saveTestResultToStudentHistory(updatedLog);
    }
  };

  const handleTimeOutFinish = () => {
    if (!selectedTestBankItem) return;
    const questions = selectedTestBankItem.questions;
    const currentLog = [...testResultsLog];
    
    for (let i = currentLog.length; i < questions.length; i++) {
      currentLog.push({ question: questions[i], correct: false });
    }

    setTestResultsLog(currentLog);
    setIsTestCompleted(true);
    saveTestResultToStudentHistory(currentLog);
  };

  // An toàn dữ liệu: Lấy dữ liệu mới nhất của lớp trước khi ghi nhận kết quả để tránh ghi đè dữ liệu cũ
  const saveTestResultToStudentHistory = async (finalLog) => {
    if (!selectedClassForTest || !selectedStudentForTest || !selectedTestBankItem) return;
    const correctCount = finalLog.filter(item => item.correct).length;
    const totalCount = finalLog.length;
    
    try {
      const classRef = doc(db, "classes", selectedClassForTest.id);
      const classSnap = await getDoc(classRef);
      if (!classSnap.exists()) return;

      const classData = classSnap.data();
      const currentStudents = classData.students || [];

      const updatedStudents = currentStudents.map(st => {
        if (st.id === selectedStudentForTest.id) {
          const newHistoryItem = {
            testName: selectedTestBankItem.testName,
            level: selectedTestBankItem.level,
            date: new Date().toLocaleDateString('vi-VN'),
            correct: correctCount,
            total: totalCount,
            score: Math.round((correctCount / totalCount) * 100),
            logs: finalLog
          };
          return { ...st, history: [...(st.history || []), newHistoryItem] };
        }
        return st;
      });

      await updateDoc(classRef, { students: updatedStudents });
      fetchClasses();
    } catch (err) {
      console.error("Lỗi lưu kết quả kiểm tra:", err);
    }
  };

  const fetchClasses = useCallback(async () => {
    try {
      const snapshot = await getDocs(collection(db, "classes"));
      const list = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      setClassesList(list);
    } catch (err) { console.error("Lỗi tải danh sách lớp:", err); }
  }, []);

  const fetchTestsBank = useCallback(async () => {
    try {
      const snapshot = await getDocs(collection(db, "tests_bank"));
      const list = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      list.sort((a, b) => a.testName.localeCompare(b.testName, undefined, { numeric: true, sensitivity: 'base' }));
      setTestsBank(list);
    } catch (err) { console.error("Lỗi tải kho bài kiểm tra:", err); }
  }, []);

  const fetchLecturesBank = useCallback(async () => {
    try {
      const snapshot = await getDocs(collection(db, "lectures_bank"));
      const list = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      list.sort((a, b) => a.lectureName.localeCompare(b.lectureName, undefined, { numeric: true, sensitivity: 'base' }));
      setLecturesBank(list);
    } catch (err) { console.error("Lỗi tải kho bài giảng:", err); }
  }, []);

  useEffect(() => {
    fetchClasses();
    fetchTestsBank();
    fetchLecturesBank();
    fetchPendingExams();
    fetchPendingTests();
    fetchAllStudentsProgress();
  }, [fetchClasses, fetchTestsBank, fetchLecturesBank]);

  const handleCreateClass = async (e) => {
    e.preventDefault();
    if (!newClassName.trim() || !newClassStudents.trim()) {
      return alert("Vui lòng nhập tên lớp và danh sách học sinh!");
    }
    const studentsArray = newClassStudents
      .split("\n")
      .map(name => name.trim())
      .filter(name => name !== "")
      .map((name, index) => ({ id: `st_${Date.now()}_${index}`, name, history: [] }));

    try {
      await addDoc(collection(db, "classes"), {
        className: newClassName.trim(),
        level: newClassLevel,
        students: studentsArray,
        createdAt: serverTimestamp()
      });
      alert("✅ Đã tạo lớp học thành công!");
      setIsAddClassModalOpen(false);
      setNewClassName("");
      setNewClassStudents("");
      fetchClasses();
    } catch (err) { alert("Lỗi khi tạo lớp: " + err.message); }
  };

  const handleOpenEditClass = (cls) => {
    setEditingClass(cls);
    setEditClassName(cls.className);
    setEditClassLevel(cls.level);
    const namesString = cls.students ? cls.students.map(s => s.name).join("\n") : "";
    setEditClassStudents(namesString);
  };

  const handleUpdateClass = async (e) => {
    e.preventDefault();
    if (!editClassName.trim() || !editClassStudents.trim()) {
      return alert("Vui lòng nhập đầy đủ thông tin lớp!");
    }

    // Tránh xung đột trùng tên bằng cách lưu lịch sử theo ID học sinh nếu có sẵn
    const oldStudentsMap = new Map();
    if (editingClass.students) {
      editingClass.students.forEach(st => oldStudentsMap.set(st.id, st.history || []));
    }

    const updatedStudentsArray = editClassStudents
      .split("\n")
      .map(name => name.trim())
      .filter(name => name !== "")
      .map((name, index) => {
        // Tìm xem học sinh này đã có lịch sử cũ chưa (dựa theo tên nếu không khớp ID)
        const existingSt = editingClass.students?.find(s => s.name.trim() === name);
        const existingHistory = existingSt ? existingSt.history : [];
        return {
          id: existingSt ? existingSt.id : `st_${Date.now()}_${index}`,
          name,
          history: existingHistory
        };
      });

    try {
      const classRef = doc(db, "classes", editingClass.id);
      await updateDoc(classRef, {
        className: editClassName.trim(),
        level: editClassLevel,
        students: updatedStudentsArray
      });
      alert("✅ Đã cập nhật danh sách lớp thành công!");
      setEditingClass(null);
      fetchClasses();
    } catch (err) {
      alert("Lỗi cập nhật lớp: " + err.message);
    }
  };

  const handleDeleteClass = async (classId) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa lớp học này không?")) return;
    try {
      await deleteDoc(doc(db, "classes", classId));
      alert("Đã xóa lớp học!");
      fetchClasses();
    } catch (err) {
      alert("Lỗi khi xóa lớp: " + err.message);
    }
  };

  const handleCreateTest = async (e) => {
    e.preventDefault();
    if (!newTestName.trim() || !newTestContent.trim()) {
      return alert("Vui lòng nhập tên bài và nội dung câu hỏi/từ vựng!");
    }
    const questionsArray = newTestContent
      .split("\n")
      .map(line => line.trim())
      .filter(line => line !== "");

    try {
      await addDoc(collection(db, "tests_bank"), {
        testName: newTestName.trim(),
        level: newTestLevel,
        questions: questionsArray,
        createdAt: serverTimestamp()
      });
      alert("✅ Đã thêm bài kiểm tra vào kho thành công!");
      setIsAddTestModalOpen(false);
      setNewTestName("");
      setNewTestContent("");
      fetchTestsBank();
    } catch (err) { alert("Lỗi khi thêm bài kiểm tra: " + err.message); }
  };

  const handleOpenEditTest = (test) => {
    setEditingTest(test);
    setEditTestName(test.testName);
    setEditTestLevel(test.level);
    const contentString = test.questions ? test.questions.join("\n") : "";
    setEditTestContent(contentString);
  };

  const handleUpdateTest = async (e) => {
    e.preventDefault();
    if (!editTestName.trim() || !editTestContent.trim()) {
      return alert("Vui lòng nhập tên bài và nội dung câu hỏi!");
    }
    const questionsArray = editTestContent
      .split("\n")
      .map(line => line.trim())
      .filter(line => line !== "");

    try {
      const testRef = doc(db, "tests_bank", editingTest.id);
      await updateDoc(testRef, {
        testName: editTestName.trim(),
        level: editTestLevel,
        questions: questionsArray
      });
      alert("✅ Đã cập nhật bài kiểm tra!");
      setEditingTest(null);
      fetchTestsBank();
    } catch (err) {
      alert("Lỗi cập nhật bài test: " + err.message);
    }
  };

  const handleDeleteTest = async (testId) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa bài kiểm tra này khỏi kho không?")) return;
    try {
      await deleteDoc(doc(db, "tests_bank", testId));
      alert("Đã xóa bài kiểm tra!");
      fetchTestsBank();
    } catch (err) {
      alert("Lỗi khi xóa bài test: " + err.message);
    }
  };

  const getTestedNamesForClass = (cls) => {
    const testedSet = new Set();
    cls.students?.forEach(st => {
      st.history?.forEach(h => {
        if (h.testName) testedSet.add(h.testName);
      });
    });
    return Array.from(testedSet);
  };

  const exportClassSummaryExcel = (cls, testName) => {
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "Học sinh,Bài test,Cấp độ,Từ chưa thuộc\r\n";

    cls.students?.forEach(st => {
      st.history?.forEach(h => {
        if (h.testName === testName) {
          const unlearnedWords = h.logs?.filter(l => !l.correct).map(l => `"${l.question.replace(/"/g, '""')}"`).join(", ") || "Không có";
          csvContent += `"${st.name.replace(/"/g, '""')}","${h.testName.replace(/"/g, '""')}","${h.level}","${unlearnedWords}"\r\n`;
        }
      });
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Bao_cao_tu_chua_thuoc_${cls.className}_${testName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith('.html') && !file.name.endsWith('.htm')) {
      return alert("Vui lòng tải lên tệp định dạng .html!");
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setNewLectureHtmlContent(event.target.result);
    };
    reader.readAsText(file);
  };

  const handleCreateLecture = async (e) => {
    e.preventDefault();
    if (!newLectureName.trim() || !newLectureHtmlContent.trim()) {
      return alert("Vui lòng nhập tên bài giảng và chọn tệp .html hợp lệ!");
    }

    try {
      await addDoc(collection(db, "lectures_bank"), {
        lectureName: newLectureName.trim(),
        level: newLectureLevel,
        htmlContent: newLectureHtmlContent,
        createdAt: serverTimestamp()
      });
      alert("✅ Đã tải lên bài giảng thành công!");
      setIsAddLectureModalOpen(false);
      setNewLectureName("");
      setNewLectureHtmlContent("");
      fetchLecturesBank();
    } catch (err) {
      alert("Lỗi khi tải lên bài giảng: " + err.message);
    }
  };

  const handleDeleteLecture = async (lectureId) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa bài giảng này không?")) return;
    try {
      await deleteDoc(doc(db, "lectures_bank", lectureId));
      alert("Đã xóa bài giảng!");
      fetchLecturesBank();
    } catch (err) {
      alert("Lỗi khi xóa bài giảng: " + err.message);
    }
  };

  const toggleFullScreenLecture = () => {
    if (!lectureContainerRef.current) return;
    if (!document.fullscreenElement) {
      lectureContainerRef.current.requestFullscreen().catch(err => {
        alert(`Không thể bật chế độ toàn màn hình: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

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
          return mergedXp === 0 ? 0 : baseSkillLevel;
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

  const handleSelectTest = (test) => {
    setSelectedTest(test);
    setQuestionScores({}); setQuestionComments({});
    setTestEvalLevel("Msutong HSK1");
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

              <button onClick={() => setActiveTab("grading_test")} className={`w-full mb-1 flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-bold transition-all ${activeTab === 'grading_test' ? 'bg-[#ECFDF5] text-[#10B981] border border-[#A7F3D0]/30 shadow-sm' : 'text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#142033]'}`}>
                <div className="flex items-center gap-3"><span className="text-lg">📝</span>{!isSidebarCollapsed && <span>Chấm bài Test</span>}</div>
                {!isSidebarCollapsed && pendingTests.length > 0 && <span className="bg-[#10B981] text-white text-[10px] px-2 py-0.5 rounded-full shadow-sm">{pendingTests.length}</span>}
              </button>

              <button onClick={() => setActiveTab("review_manager")} className={`w-full mb-1 flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-bold transition-all ${activeTab === 'review_manager' ? 'bg-[#ECFDF5] text-[#10B981] border border-[#A7F3D0]/30 shadow-sm' : 'text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#142033]'}`}>
                <div className="flex items-center gap-3"><span className="text-lg">🔄</span>{!isSidebarCollapsed && <span>Kiểm tra bài cũ</span>}</div>
              </button>

              <button onClick={() => setActiveTab("lecture_manager")} className={`w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-bold transition-all ${activeTab === 'lecture_manager' ? 'bg-[#ECFDF5] text-[#10B981] border border-[#A7F3D0]/30 shadow-sm' : 'text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#142033]'}`}>
                <div className="flex items-center gap-3"><span className="text-lg">📚</span>{!isSidebarCollapsed && <span>Kho Bài Giảng</span>}</div>
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
               activeTab === 'grading_test' ? "Chấm bài kiểm tra Năng lực (4 Kỹ Năng) của học viên." :
               activeTab === 'review_manager' ? "Quản lý lớp học và kho bài kiểm tra bài cũ cho học sinh." :
               "Quản lý kho bài giảng điện tử hỗ trợ giảng dạy tương tác."}
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
                      {selectedTest.testData?.sections?.dictation?.length > 0 && (
                        <div>
                          <h3 className="font-black text-[#142033] mb-4 flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm border border-[#E2E8F0] w-fit">
                            <span className="text-xl">🎧</span> 3. Kỹ năng Nghe (6 câu)
                          </h3>
                          <div className="space-y-4 pl-2 border-l-2 border-[#E2E8F0] ml-2">
                            {selectedTest.testData.sections.dictation.map((item, idx) => {
                              const qId = `dictation_${idx}`;
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
                            <span className="text-xl">🗣️</span> 4. Kỹ năng Nói ({selectedTest.testData.sections.picture.length} câu)
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
                            <span className="text-xl">📝</span> 5. Kỹ năng Viết ({selectedTest.testData.sections.essay.length} câu)
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
                                {LEVEL_OPTIONS.map(l => <option key={l} value={l} className="text-black">{l}</option>)}
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

          {/* TAB 4: KIỂM TRA BÀI CŨ (QUẢN LÝ LỚP & KHO BÀI TẬP) */}
          {activeTab === "review_manager" && (
            <div className="space-y-10 animate-fade-in">
              {/* KHU VỰC 1: DANH SÁCH LỚP */}
              <div className="bg-white rounded-[32px] border border-[#E2E8F0] p-6 md:p-8 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-xl font-black text-[#142033]">1. Danh Sách Lớp Học</h3>
                    <p className="text-xs font-medium text-[#64748B] mt-1">Quản lý các lớp, học sinh và thực hiện bài Test.</p>
                  </div>
                  <button 
                    onClick={() => setIsAddClassModalOpen(true)}
                    className="px-5 py-2.5 bg-[#10B981] text-white rounded-xl font-black text-xs shadow-md hover:bg-[#059669] transition"
                  >
                    + Thêm lớp
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                  {classesList.length === 0 ? (
                    <p className="text-slate-400 text-xs py-6">Chưa có lớp học nào được tạo.</p>
                  ) : (
                    classesList.map(cls => {
                      const testedNames = getTestedNamesForClass(cls);

                      return (
                        <div key={cls.id} className="p-6 rounded-2xl border-2 border-[#E2E8F0] bg-[#F8FAFC] flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-black text-base text-[#142033]">{cls.className}</h4>
                              <span className="inline-block bg-[#ECFDF5] text-[#10B981] text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border border-[#A7F3D0]">{cls.level}</span>
                            </div>
                            <p className="text-xs text-[#64748B] font-medium mb-3">Sĩ số: <strong className="text-[#142033]">{cls.students?.length || 0}</strong> học sinh</p>
                            
                            <div className="flex gap-2 mb-4">
                              <button onClick={() => handleOpenEditClass(cls)} className="px-3 py-1.5 bg-white border border-[#E2E8F0] rounded-xl text-[10px] font-bold text-slate-600 hover:bg-slate-50">✏️ Sửa lớp</button>
                              <button onClick={() => handleDeleteClass(cls.id)} className="px-3 py-1.5 bg-rose-50 border border-rose-200 rounded-xl text-[10px] font-bold text-rose-600 hover:bg-rose-100">🗑️ Xóa lớp</button>
                            </div>

                            <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1 mb-4">
                              {cls.students?.map(st => (
                                <div key={st.id} className="p-3 bg-white rounded-xl border border-[#E2E8F0] flex justify-between items-center shadow-sm">
                                  <div>
                                    <p className="font-bold text-xs text-[#142033]">{st.name}</p>
                                    <p className="text-[10px] text-slate-400">{st.history?.length || 0} bài đã kiểm tra</p>
                                  </div>
                                  <div className="flex gap-1">
                                    <button 
                                      onClick={() => { setSelectedStudentHistory(st); setSelectedClassForHistory(cls); setActiveTestDetail(null); }}
                                      className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-sm"
                                      title="Xem hồ sơ"
                                    >
                                      📜 Hồ sơ
                                    </button>
                                    <button 
                                      onClick={() => openTestSelectModal(cls, st)}
                                      className="px-3 py-1.5 bg-[#10B981] hover:bg-[#059669] text-white rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-sm"
                                      title="Bắt đầu Test"
                                    >
                                      ▶ Test
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="pt-3 border-t border-slate-200 space-y-2">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Báo cáo tổng hợp lớp (Đã test):</p>
                            {testedNames.length === 0 ? (
                              <p className="text-[10px] text-slate-400 italic">Chưa có bài test nào được thực hiện.</p>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {testedNames.map(tName => (
                                  <button
                                    key={tName}
                                    onClick={() => { setClassSummaryModalClass(cls); setClassSummaryTestName(tName); }}
                                    className="px-2.5 py-1 bg-white hover:bg-[#10B981] hover:text-white border border-[#E2E8F0] text-[#142033] rounded-lg text-[10px] font-bold transition shadow-xs"
                                    title={`Xuất Excel từ chưa thuộc bài ${tName}`}
                                  >
                                    📊 {tName}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* KHU VỰC 2: KHO BÀI KIỂM TRA (THU GỌN / MỞ RỘNG THEO CẤP ĐỘ) */}
              <div className="bg-white rounded-[32px] border border-[#E2E8F0] p-6 md:p-8 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-xl font-black text-[#142033]">2. Kho Bài Kiểm Tra (Theo Cấp Độ)</h3>
                    <p className="text-xs font-medium text-[#64748B] mt-1">Các bài kiểm tra từ vựng được gom nhóm theo từng cấp độ học.</p>
                  </div>
                  <button 
                    onClick={() => setIsAddTestModalOpen(true)}
                    className="px-5 py-2.5 bg-[#142033] text-white rounded-xl font-black text-xs shadow-md hover:bg-black transition"
                  >
                    + Thêm bài
                  </button>
                </div>

                <div className="space-y-6">
                  {LEVEL_OPTIONS.map(lvl => {
                    const testsInLevel = testsBank.filter(t => t.level === lvl);
                    if (testsInLevel.length === 0) return null;

                    const isCollapsed = collapsedLevels[lvl];

                    return (
                      <div key={lvl} className="bg-[#F8FAFC] p-5 rounded-2xl border border-[#E2E8F0] transition-all">
                        <div 
                          onClick={() => toggleLevelCollapse(lvl)}
                          className="flex justify-between items-center cursor-pointer select-none"
                        >
                          <h4 className="font-black text-sm text-[#10B981] uppercase tracking-widest flex items-center gap-2">
                            <span>📁</span> {lvl} <span className="text-xs font-bold text-slate-400">({testsInLevel.length} bài)</span>
                          </h4>
                          <span className="text-xs font-bold text-slate-500 bg-white px-3 py-1 rounded-xl border border-[#E2E8F0]">
                            {isCollapsed ? "▼ Mở rộng" : "▲ Thu gọn"}
                          </span>
                        </div>
                        
                        {!isCollapsed && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-4 animate-fade-in">
                            {testsInLevel.map(test => (
                              <div key={test.id} className="p-4 rounded-2xl border border-[#E2E8F0] bg-white shadow-sm flex flex-col justify-between">
                                <div>
                                  <h5 className="font-black text-sm text-[#142033] mb-1">{test.testName}</h5>
                                  <p className="text-xs text-[#64748B] font-medium mb-3">Số lượng câu hỏi: <strong className="text-[#142033]">{test.questions?.length || 0}</strong> từ/câu</p>
                                </div>
                                <div className="flex gap-2 pt-2 border-t border-slate-100">
                                  <button onClick={() => handleOpenEditTest(test)} className="flex-1 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-[10px] font-bold border border-slate-200">✏️ Sửa</button>
                                  <button onClick={() => handleDeleteTest(test.id)} className="flex-1 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-[10px] font-bold border border-slate-200">🗑️ Xóa</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {testsBank.length === 0 && (
                    <p className="text-slate-400 text-xs py-6 text-center">Chưa có bài kiểm tra nào trong kho. Hãy bấm "+ Thêm bài" để bắt đầu.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: KHO BÀI GIẢNG (THU GỌN / MỞ RỘNG THEO CẤP ĐỘ) */}
          {activeTab === "lecture_manager" && (
            <div className="space-y-10 animate-fade-in">
              <div className="bg-white rounded-[32px] border border-[#E2E8F0] p-6 md:p-8 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-xl font-black text-[#142033]">📚 Kho Bài Giảng Điện Tử</h3>
                    <p className="text-xs font-medium text-[#64748B] mt-1">Tải lên và quản lý các bài giảng dạng tệp .html theo từng cấp độ giáo trình.</p>
                  </div>
                  <button 
                    onClick={() => setIsAddLectureModalOpen(true)}
                    className="px-5 py-2.5 bg-[#10B981] text-white rounded-xl font-black text-xs shadow-md hover:bg-[#059669] transition"
                  >
                    + Thêm bài giảng (.html)
                  </button>
                </div>

                <div className="space-y-6">
                  {LEVEL_OPTIONS.map(lvl => {
                    const lecturesInLevel = lecturesBank.filter(l => l.level === lvl);
                    if (lecturesInLevel.length === 0) return null;

                    const isCollapsed = collapsedLevels[`lec_${lvl}`];

                    return (
                      <div key={lvl} className="bg-[#F8FAFC] p-5 rounded-2xl border border-[#E2E8F0]">
                        <div 
                          onClick={() => toggleLevelCollapse(`lec_${lvl}`)}
                          className="flex justify-between items-center cursor-pointer select-none"
                        >
                          <h4 className="font-black text-sm text-[#10B981] uppercase tracking-widest flex items-center gap-2">
                            <span>📖</span> {lvl} <span className="text-xs font-bold text-slate-400">({lecturesInLevel.length} bài)</span>
                          </h4>
                          <span className="text-xs font-bold text-slate-500 bg-white px-3 py-1 rounded-xl border border-[#E2E8F0]">
                            {isCollapsed ? "▼ Mở rộng" : "▲ Thu gọn"}
                          </span>
                        </div>
                        
                        {!isCollapsed && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-4 animate-fade-in">
                            {lecturesInLevel.map(lec => (
                              <div key={lec.id} className="p-4 rounded-2xl border border-[#E2E8F0] bg-white shadow-sm flex flex-col justify-between">
                                <div>
                                  <h5 className="font-black text-sm text-[#142033] mb-1">{lec.lectureName}</h5>
                                  <span className="inline-block bg-[#ECFDF5] text-[#10B981] text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border border-[#A7F3D0] mb-3">Tệp HTML</span>
                                </div>
                                <div className="flex gap-2 pt-2 border-t border-slate-100">
                                  <button 
                                    onClick={() => setActiveLectureView(lec)}
                                    className="flex-1 py-1.5 bg-[#10B981] hover:bg-[#059669] text-white rounded-lg text-[10px] font-bold shadow-sm"
                                  >
                                    🖥️ Giảng dạy
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteLecture(lec.id)} 
                                    className="py-1.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-[10px] font-bold border border-rose-200"
                                  >
                                    🗑️ Xóa
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {lecturesBank.length === 0 && (
                    <p className="text-slate-400 text-xs py-6 text-center">Chưa có bài giảng nào trong kho. Hãy bấm "+ Thêm bài giảng" để tải tệp .html lên.</p>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* MODAL THÊM LỚP */}
      {isAddClassModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50 backdrop-blur-sm">
          <form onSubmit={handleCreateClass} className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl space-y-5 animate-slide-up-fade">
            <h3 className="text-xl font-black text-[#142033]">Tạo Lớp Học Mới</h3>
            <div>
              <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1">Tên lớp học</label>
              <input type="text" value={newClassName} onChange={e => setNewClassName(e.target.value)} placeholder="VD: Lớp Tiếng Trung Msutong 1" className="w-full p-3 rounded-xl border border-[#E2E8F0] font-bold text-sm outline-none focus:border-[#10B981]" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1">Chọn cấp độ</label>
              <select value={newClassLevel} onChange={e => setNewClassLevel(e.target.value)} className="w-full p-3 rounded-xl border border-[#E2E8F0] font-bold text-sm outline-none focus:border-[#10B981]">
                {LEVEL_OPTIONS.map(lvl => <option key={lvl} value={lvl}>{lvl}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1">Danh sách học sinh (Mỗi bạn 1 dòng)</label>
              <textarea rows="5" value={newClassStudents} onChange={e => setNewClassStudents(e.target.value)} placeholder="Nguyễn Văn A&#10;Trần Thị B&#10;Lê Văn C" className="w-full p-3 rounded-xl border border-[#E2E8F0] font-medium text-sm outline-none focus:border-[#10B981] resize-none" required></textarea>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setIsAddClassModalOpen(false)} className="flex-1 py-3 bg-slate-100 rounded-xl font-bold text-slate-600 text-xs">Hủy</button>
              <button type="submit" className="flex-1 py-3 bg-[#10B981] text-white rounded-xl font-bold text-xs shadow-md">Tạo lớp</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL CHỈNH SỬA LỚP */}
      {editingClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50 backdrop-blur-sm">
          <form onSubmit={handleUpdateClass} className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl space-y-5 animate-slide-up-fade">
            <h3 className="text-xl font-black text-[#142033]">Sửa Danh Sách Lớp</h3>
            <div>
              <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1">Tên lớp học</label>
              <input type="text" value={editClassName} onChange={e => setEditClassName(e.target.value)} className="w-full p-3 rounded-xl border border-[#E2E8F0] font-bold text-sm outline-none focus:border-[#10B981]" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1">Chọn cấp độ</label>
              <select value={editClassLevel} onChange={e => setEditClassLevel(e.target.value)} className="w-full p-3 rounded-xl border border-[#E2E8F0] font-bold text-sm outline-none focus:border-[#10B981]">
                {LEVEL_OPTIONS.map(lvl => <option key={lvl} value={lvl}>{lvl}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1">Danh sách học sinh (Mỗi bạn 1 dòng)</label>
              <textarea rows="5" value={editClassStudents} onChange={e => setEditClassStudents(e.target.value)} className="w-full p-3 rounded-xl border border-[#E2E8F0] font-medium text-sm outline-none focus:border-[#10B981] resize-none" required></textarea>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setEditingClass(null)} className="flex-1 py-3 bg-slate-100 rounded-xl font-bold text-slate-600 text-xs">Hủy</button>
              <button type="submit" className="flex-1 py-3 bg-[#10B981] text-white rounded-xl font-bold text-xs shadow-md">Lưu thay đổi</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL THÊM BÀI GIẢNG (.HTML) */}
      {isAddLectureModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50 backdrop-blur-sm">
          <form onSubmit={handleCreateLecture} className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl space-y-5 animate-slide-up-fade">
            <h3 className="text-xl font-black text-[#142033]">Tải Lên Bài Giảng Mới</h3>
            <div>
              <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1">Tên bài giảng</label>
              <input type="text" value={newLectureName} onChange={e => setNewLectureName(e.target.value)} placeholder="VD: Bài 1: 你好 - Giáo trình Msutong" className="w-full p-3 rounded-xl border border-[#E2E8F0] font-bold text-sm outline-none focus:border-[#10B981]" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1">Chọn cấp độ giáo trình</label>
              <select value={newLectureLevel} onChange={e => setNewLectureLevel(e.target.value)} className="w-full p-3 rounded-xl border border-[#E2E8F0] font-bold text-sm outline-none focus:border-[#10B981]">
                {LEVEL_OPTIONS.map(lvl => <option key={lvl} value={lvl}>{lvl}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1">Chọn tệp bài giảng (.html)</label>
              <input type="file" accept=".html,.htm" onChange={handleFileUpload} className="w-full p-2.5 rounded-xl border border-[#E2E8F0] text-xs font-bold text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-[#10B981] file:text-white hover:file:bg-[#059669] cursor-pointer" required />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setIsAddLectureModalOpen(false)} className="flex-1 py-3 bg-slate-100 rounded-xl font-bold text-slate-600 text-xs">Hủy</button>
              <button type="submit" className="flex-1 py-3 bg-[#10B981] text-white rounded-xl font-bold text-xs shadow-md">Tải lên</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL THÊM BÀI KIỂM TRA */}
      {isAddTestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50 backdrop-blur-sm">
          <form onSubmit={handleCreateTest} className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl space-y-5 animate-slide-up-fade">
            <h3 className="text-xl font-black text-[#142033]">Thêm Bài Kiểm Tra Mới</h3>
            <div>
              <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1">Tên bài kiểm tra</label>
              <input type="text" value={newTestName} onChange={e => setNewTestName(e.target.value)} placeholder="VD: Kiểm tra từ vựng bài 1" className="w-full p-3 rounded-xl border border-[#E2E8F0] font-bold text-sm outline-none focus:border-[#10B981]" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1">Cấp độ</label>
              <select value={newTestLevel} onChange={e => setNewTestLevel(e.target.value)} className="w-full p-3 rounded-xl border border-[#E2E8F0] font-bold text-sm outline-none focus:border-[#10B981]">
                {LEVEL_OPTIONS.map(lvl => <option key={lvl} value={lvl}>{lvl}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1">Nội dung từ/câu hỏi (Mỗi từ 1 dòng)</label>
              <textarea rows="6" value={newTestContent} onChange={e => setNewTestContent(e.target.value)} placeholder="你好&#10;谢谢&#10;再见" className="w-full p-3 rounded-xl border border-[#E2E8F0] font-medium text-sm outline-none focus:border-[#10B981] resize-none" required></textarea>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setIsAddTestModalOpen(false)} className="flex-1 py-3 bg-slate-100 rounded-xl font-bold text-slate-600 text-xs">Hủy</button>
              <button type="submit" className="flex-1 py-3 bg-[#142033] text-white rounded-xl font-bold text-xs shadow-md">Thêm bài</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL CHỈNH SỬA BÀI KIỂM TRA */}
      {editingTest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50 backdrop-blur-sm">
          <form onSubmit={handleUpdateTest} className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl space-y-5 animate-slide-up-fade">
            <h3 className="text-xl font-black text-[#142033]">Chỉnh Sửa Bài Kiểm Tra</h3>
            <div>
              <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1">Tên bài kiểm tra</label>
              <input type="text" value={editTestName} onChange={e => setEditTestName(e.target.value)} className="w-full p-3 rounded-xl border border-[#E2E8F0] font-bold text-sm outline-none focus:border-[#10B981]" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1">Cấp độ</label>
              <select value={editTestLevel} onChange={e => setEditTestLevel(e.target.value)} className="w-full p-3 rounded-xl border border-[#E2E8F0] font-bold text-sm outline-none focus:border-[#10B981]">
                {LEVEL_OPTIONS.map(lvl => <option key={lvl} value={lvl}>{lvl}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1">Nội dung từ/câu hỏi (Mỗi từ 1 dòng)</label>
              <textarea rows="6" value={editTestContent} onChange={e => setEditTestContent(e.target.value)} className="w-full p-3 rounded-xl border border-[#E2E8F0] font-medium text-sm outline-none focus:border-[#10B981] resize-none" required></textarea>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setEditingTest(null)} className="flex-1 py-3 bg-slate-100 rounded-xl font-bold text-slate-600 text-xs">Hủy</button>
              <button type="submit" className="flex-1 py-3 bg-[#10B981] text-white rounded-xl font-bold text-xs shadow-md">Lưu thay đổi</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL CHỌN CẤP ĐỘ -> CHỌN BÀI KHI BẤM TEST */}
      {isTestSelectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl space-y-5 animate-slide-up-fade">
            <h3 className="text-xl font-black text-[#142033]">Bắt đầu kiểm tra cho: <span className="text-[#10B981]">{targetStudentForTest?.name}</span></h3>
            
            <div>
              <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1">1. Chọn cấp độ</label>
              <select 
                value={selectedLevelFilter} 
                onChange={(e) => {
                  setSelectedLevelFilter(e.target.value);
                  setSelectedTestId("");
                }} 
                className="w-full p-3 rounded-xl border border-[#E2E8F0] font-bold text-sm outline-none focus:border-[#10B981]"
              >
                {LEVEL_OPTIONS.map(lvl => <option key={lvl} value={lvl}>{lvl}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1">2. Chọn bài kiểm tra</label>
              <select 
                value={selectedTestId} 
                onChange={(e) => setSelectedTestId(e.target.value)} 
                className="w-full p-3 rounded-xl border border-[#E2E8F0] font-bold text-sm outline-none focus:border-[#10B981]"
              >
                <option value="">-- Chọn bài trong kho --</option>
                {testsBank
                  .filter(t => t.level === selectedLevelFilter)
                  .map(t => (
                    <option key={t.id} value={t.id}>{t.testName} ({t.questions?.length || 0} câu)</option>
                  ))}
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setIsTestSelectModalOpen(false)} className="flex-1 py-3 bg-slate-100 rounded-xl font-bold text-slate-600 text-xs">Hủy</button>
              <button 
                type="button" 
                onClick={handleConfirmStartTest}
                className="flex-1 py-3 bg-[#10B981] text-white rounded-xl font-bold text-xs shadow-md hover:bg-[#059669]"
              >
                Bắt đầu Test
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL XEM & GIẢNG DẠY BÀI GIẢNG (HỖ TRỢ TOÀN MÀN HÌNH) */}
      {activeLectureView && (
        <div ref={lectureContainerRef} className="fixed inset-0 z-50 flex flex-col bg-white animate-fade-in">
          <div className="h-16 px-6 bg-[#142033] text-white flex justify-between items-center shrink-0 shadow-md">
            <div>
              <h3 className="font-black text-base">{activeLectureView.lectureName}</h3>
              <p className="text-[10px] text-[#10B981] font-bold uppercase tracking-widest">{activeLectureView.level}</p>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={toggleFullScreenLecture}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-black transition border border-white/20"
              >
                ⛶ Toàn màn hình
              </button>
              <button 
                onClick={() => setActiveLectureView(null)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 rounded-xl text-xs font-black transition shadow-sm"
              >
                ✕ Đóng bài giảng
              </button>
            </div>
          </div>

          <div className="flex-1 w-full bg-slate-50 relative overflow-hidden">
            <iframe 
              srcDoc={activeLectureView.htmlContent}
              title={activeLectureView.lectureName}
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        </div>
      )}

      {/* MODAL PHÒNG KIỂM TRA TRỰC TIẾP (LIVE TEST) */}
      {isLiveTesting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-[#142033]/90 backdrop-blur-md animate-fade-in">
          <div className="bg-white rounded-[40px] p-8 md:p-12 max-w-xl w-full shadow-2xl text-center relative overflow-hidden flex flex-col items-center">
            
            {!isTestCompleted ? (
              <>
                <div className="w-full flex justify-between items-center mb-6">
                  <span className="bg-[#ECFDF5] text-[#10B981] font-black text-xs px-3 py-1 rounded-full uppercase tracking-widest border border-[#A7F3D0]">
                    {selectedStudentForTest?.name} • Câu {currentQuestionIndex + 1}/{selectedTestBankItem?.questions.length}
                  </span>
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center font-black text-sm shadow-inner ${totalTimeLeft <= 5 ? 'bg-rose-100 text-rose-600 animate-pulse' : 'bg-slate-100 text-[#142033]'}`}>
                    ⏱️ {totalTimeLeft}s
                  </div>
                </div>

                <div className="my-10 w-full py-12 bg-[#F8FAFC] rounded-3xl border-2 border-[#E2E8F0] shadow-inner flex items-center justify-center">
                  <h2 className="text-6xl md:text-7xl font-black text-[#142033] tracking-wider">
                    {selectedTestBankItem?.questions[currentQuestionIndex]}
                  </h2>
                </div>

                <div className="grid grid-cols-2 gap-4 w-full">
                  <button 
                    onClick={() => handleRecordAnswer(false)}
                    className="py-5 bg-rose-50 text-rose-600 border border-rose-200 rounded-2xl font-black text-base shadow-sm hover:bg-rose-100 transition active:scale-95"
                  >
                    ❌ Chưa thuộc
                  </button>
                  <button 
                    onClick={() => handleRecordAnswer(true)}
                    className="py-5 bg-[#10B981] text-white rounded-2xl font-black text-base shadow-lg hover:bg-[#059669] transition active:scale-95"
                  >
                    ✓ Thuộc
                  </button>
                </div>

                <button onClick={() => setIsLiveTesting(false)} className="mt-6 text-xs font-bold text-slate-400 hover:text-slate-600">
                  Thoát phiên kiểm tra
                </button>
              </>
            ) : (
              <div className="space-y-6 w-full animate-slide-up-fade">
                <div className="text-6xl mb-2">🏆</div>
                <h2 className="text-3xl font-black text-[#142033]">Hoàn Thành Kiểm Tra!</h2>
                <p className="text-slate-500 font-medium text-sm">Học viên: <strong className="text-[#142033]">{selectedStudentForTest?.name}</strong></p>
                
                <div className="bg-[#ECFDF5] border border-[#A7F3D0] p-6 rounded-3xl my-6">
                  <p className="text-xs font-black text-[#10B981] uppercase tracking-widest mb-1">Kết quả đạt được</p>
                  <p className="text-4xl font-black text-[#047857]">
                    {testResultsLog.filter(i => i.correct).length} / {testResultsLog.length} <span className="text-lg">thuộc</span>
                  </p>
                </div>

                <button 
                  onClick={() => setIsLiveTesting(false)}
                  className="w-full py-4 bg-[#142033] text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg hover:bg-black transition"
                >
                  Đóng & Quay lại Quản lý Lớp
                </button>
              </div>
            )}

          </div>
        </div>
      )}

      {/* MODAL BÁO CÁO TỔNG HỢP CẢ LỚP THEO BÀI TEST & NÚT XUẤT EXCEL */}
      {classSummaryModalClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-[40px] p-6 md:p-10 w-[95vw] max-w-3xl shadow-2xl space-y-6 animate-slide-up-fade max-h-[90vh] flex flex-col">
            
            <div className="flex justify-between items-center border-b border-[#E2E8F0] pb-4 shrink-0">
              <div>
                <h3 className="text-xl font-black text-[#142033]">Báo Cáo Tổng Hợp Từ Chưa Thuộc</h3>
                <p className="text-xs font-bold text-[#10B981] mt-0.5">
                  Lớp: {classSummaryModalClass.className} • Bài: {classSummaryTestName}
                </p>
              </div>
              <button onClick={() => setClassSummaryModalClass(null)} className="w-10 h-10 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center text-slate-500 font-bold transition">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-1">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-wider">
                    <th className="p-3 rounded-l-xl">Học sinh</th>
                    <th className="p-3">Điểm số</th>
                    <th className="p-3 rounded-r-xl">Các từ chưa thuộc (Sai)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] text-xs">
                  {classSummaryModalClass.students?.map(st => {
                    const testHistory = st.history?.find(h => h.testName === classSummaryTestName);
                    const unlearned = testHistory?.logs?.filter(l => !l.correct) || [];

                    return (
                      <tr key={st.id} className="hover:bg-slate-50">
                        <td className="p-3 font-bold text-[#142033]">{st.name}</td>
                        <td className="p-3 font-black text-[#10B981]">
                          {testHistory ? `${testHistory.score}% (${testHistory.correct}/${testHistory.total})` : "Chưa kiểm tra"}
                        </td>
                        <td className="p-3">
                          {unlearned.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {unlearned.map((u, idx) => (
                                <span key={idx} className="px-2 py-0.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-md font-bold">
                                  {u.question} ✗
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[#10B981] font-bold">Thuộc hết 🎉</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="pt-3 border-t border-[#E2E8F0] flex gap-3 shrink-0">
              <button 
                onClick={() => exportClassSummaryExcel(classSummaryModalClass, classSummaryTestName)}
                className="flex-1 py-3.5 bg-[#10B981] text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-[#059669] transition shadow-md flex items-center justify-center gap-2"
              >
                📥 Xuất File Excel (Từ Chưa Thuộc)
              </button>
              <button 
                onClick={() => setClassSummaryModalClass(null)} 
                className="py-3.5 px-6 bg-slate-100 text-slate-600 rounded-2xl font-bold text-xs hover:bg-slate-200 transition"
              >
                Đóng
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL HỒ SƠ HỌC SINH (RỘNG 98% MÀN HÌNH, HIỂN THỊ BẢNG HOÀN CHỈNH KHI CLICK VÀO BÀI TEST) */}
      {selectedStudentHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-[40px] p-6 md:p-10 w-[98vw] max-w-[1400px] shadow-2xl space-y-6 animate-slide-up-fade max-h-[95vh] flex flex-col">
            
            <div className="flex justify-between items-center border-b border-[#E2E8F0] pb-4 shrink-0">
              <div>
                <h3 className="text-2xl font-black text-[#142033]">Hồ sơ học viên</h3>
                <p className="text-xs font-bold text-[#10B981] mt-0.5">
                  Học sinh: {selectedStudentHistory.name} • Lớp: {selectedClassForHistory?.className || "Chưa rõ"}
                </p>
              </div>
              <button onClick={() => setSelectedStudentHistory(null)} className="w-10 h-10 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center text-slate-500 font-bold transition">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-1">
              {selectedStudentHistory.history?.length === 0 ? (
                <p className="text-sm text-slate-400 py-12 text-center font-medium">Học sinh chưa có bài kiểm tra bài cũ nào.</p>
              ) : (
                selectedStudentHistory.history?.map((h, i) => {
                  const isDetailOpen = activeTestDetail === i;

                  return (
                    <div key={i} className="bg-white rounded-3xl border border-[#E2E8F0] shadow-sm overflow-hidden transition-all">
                      
                      <div 
                        onClick={() => setActiveTestDetail(isDetailOpen ? null : i)}
                        className="p-5 bg-[#F8FAFC] hover:bg-slate-100 cursor-pointer flex justify-between items-center transition"
                      >
                        <div>
                          <span className="bg-[#142033] text-white text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded mb-1 inline-block">{h.level}</span>
                          <h4 className="font-black text-base text-[#142033]">{h.testName}</h4>
                          <p className="text-xs font-medium text-slate-400">Ngày kiểm tra: {h.date}</p>
                        </div>
                        <div className="flex items-center gap-4 text-right">
                          <div>
                            <p className="font-black text-lg text-[#10B981]">{h.score}%</p>
                            <p className="text-xs font-bold text-slate-500">{h.correct}/{h.total} câu đúng</p>
                          </div>
                          <span className="text-slate-400 font-bold text-lg">{isDetailOpen ? "▲" : "▼"}</span>
                        </div>
                      </div>

                      {/* BẢNG HOÀN CHỈNH: TÊN HỌC SINH - TÊN BÀI - DANH SÁCH TỪ VỰNG */}
                      {isDetailOpen && (
                        <div className="p-6 bg-white border-t border-[#E2E8F0] space-y-5 animate-fade-in">
                          <div className="bg-[#F8FAFC] p-5 rounded-2xl border border-[#E2E8F0] grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-bold text-[#64748B]">
                            <p>👤 <strong className="text-[#142033]">Học sinh:</strong> {selectedStudentHistory.name}</p>
                            <p>📚 <strong className="text-[#142033]">Bài test:</strong> {h.testName} ({h.level})</p>
                            <p>🎯 <strong className="text-[#142033]">Kết quả:</strong> {h.correct}/{h.total} câu đúng ({h.score}%)</p>
                          </div>

                          <div>
                            <p className="text-xs font-black text-[#142033] uppercase tracking-widest mb-3">Danh sách từ vựng kiểm tra (Đúng / Sai):</p>
                            {h.logs && h.logs.length > 0 ? (
                              <div className="flex flex-wrap gap-2.5">
                                {h.logs.map((logItem, idx) => (
                                  <span 
                                    key={idx} 
                                    className={`px-4 py-2 rounded-xl text-sm font-black border flex items-center gap-2 ${logItem.correct ? 'bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]' : 'bg-[#FFF1F2] text-[#BE123C] border-[#FECDD3]'}`}
                                  >
                                    {logItem.question} {logItem.correct ? "✓" : "✗"}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-slate-400 italic">Không có chi tiết từng từ cho bài kiểm tra này.</p>
                            )}
                          </div>
                        </div>
                      )}

                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-2 shrink-0">
              <button 
                onClick={() => setSelectedStudentHistory(null)} 
                className="w-full py-4 bg-[#142033] text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-black transition shadow-md"
              >
                Đóng
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}