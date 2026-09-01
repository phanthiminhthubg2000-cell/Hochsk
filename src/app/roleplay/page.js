"use client";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";

export default function RoleplayPage() {
  const [chatHistory, setChatHistory] = useState([{ role: 'ai', content: '你好！我是你的中文练习伙伴。(Xin chào! Tôi là bạn luyện tập của bạn.)' }]);
  const [chatInput, setChatInput] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const chatContainerRef = useRef(null);

  const speak = (text) => {
    window.speechSynthesis.cancel(); 
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN"; utterance.rate = 0.8; 
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    if (chatContainerRef.current) chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
  }, [chatHistory, isChatting]);

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const newUserMsg = { role: 'user', content: chatInput };
    const newHistory = [...chatHistory, newUserMsg];
    setChatHistory(newHistory); setChatInput(""); setIsChatting(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newHistory })
      });
      const data = await res.json();
      setChatHistory([...newHistory, { role: 'ai', content: data.reply }]);
    } catch (error) { alert("Lỗi kết nối Chat AI!"); } finally { setIsChatting(false); }
  };

  return (
    <main className="flex min-h-screen flex-col items-center py-10 bg-slate-50 px-4">
      <div className="w-full max-w-2xl flex justify-between items-center mb-8">
        <Link href="/"><button className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl shadow-sm hover:bg-slate-100 transition flex items-center gap-2"><span>←</span> Về Trang Chủ</button></Link>
        <h1 className="text-3xl font-extrabold text-green-600">Thực Chiến Bản Xứ</h1>
      </div>

      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-xl p-6 flex flex-col h-[650px] border">
        <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-100">
          <h3 className="text-xl font-bold text-green-700">Chat cùng AI Bản Xứ</h3>
          <button onClick={() => setChatHistory([{ role: 'ai', content: '你好！我们重新开始吧。(Xin chào! Chúng ta bắt đầu lại nhé.)' }])} className="text-sm px-4 py-2 bg-slate-100 text-slate-600 font-bold rounded-lg hover:bg-slate-200">Xóa lịch sử</button>
        </div>
        <div ref={chatContainerRef} className="flex-1 overflow-y-auto mb-4 p-4 bg-slate-50 rounded-2xl flex flex-col gap-4 border border-slate-100">
          {chatHistory.map((msg, i) => (
            <div key={i} className={`flex flex-col max-w-[85%] p-4 rounded-2xl shadow-sm ${msg.role === 'user' ? 'bg-green-500 text-white self-end rounded-tr-sm' : 'bg-white border border-slate-200 text-slate-800 self-start rounded-tl-sm'}`}>
              <p className="text-lg leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              {msg.role === 'ai' && <button onClick={() => speak(msg.content)} className="mt-3 self-end w-8 h-8 bg-slate-100 text-slate-500 hover:text-green-600 hover:bg-slate-200 rounded-full transition-colors flex items-center justify-center">🔊</button>}
            </div>
          ))}
          {isChatting && <div className="self-start max-w-[85%] bg-white border border-slate-200 text-slate-500 p-4 rounded-2xl shadow-sm flex items-center gap-2 tracking-widest animate-pulse">● ● ●</div>}
        </div>
        <form onSubmit={handleChatSubmit} className="flex gap-3 mt-auto">
          <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Gõ tiếng Trung (hoặc Pinyin)..." className="flex-1 px-5 py-4 rounded-xl border-2 border-slate-200 focus:border-green-500 outline-none text-lg bg-slate-50" disabled={isChatting} />
          <button type="submit" disabled={isChatting || !chatInput.trim()} className="bg-green-600 text-white font-bold px-8 rounded-xl disabled:opacity-50 hover:bg-green-700 shadow-md transition">Gửi</button>
        </form>
      </div>
    </main>
  );
}