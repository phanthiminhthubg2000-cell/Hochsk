# -*- coding: utf-8 -*-
"""Sinh các trang phòng thi HSKK cao cấp public/hskk-exam/HSKK_GAOJI_<mã>.html + thêm vào exams.json.
Cần chạy rooms.py trước (file nghe rút gọn + tl_<mã>.json).  python3 tools/hskk_cao/make_exams.py"""
import difflib, hashlib, html, json, os, re

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
EX = os.path.join(ROOT, "public", "hskk-exam"); T = os.path.join(ROOT, "tools", "hskk_cao")
RET = {x["id"]: x for x in json.load(open(os.path.join(ROOT, "public/hskk-cao/retell.json")))}
READ = {x["id"]: x["text"] for x in json.load(open(os.path.join(ROOT, "public/hskk-cao/read.json")))}
QA = json.load(open(os.path.join(ROOT, "public/hskk-cao/qa.json")))
QS = json.load(open(os.path.join(T, "real_qs.json")))
CODES = sorted(c[3:-5] for c in os.listdir(T) if c.startswith("tl_"))
SUBJ = "HSKK（高级）"
VER = hashlib.md5((open(os.path.join(EX, "room.js"), "rb").read() + open(os.path.join(EX, "room.css"), "rb").read())).hexdigest()[:8]

def sample_for(code, q):
    pool = [x for x in QA if code in str(x.get("src", ""))] or QA
    best = max(pool, key=lambda x: difflib.SequenceMatcher(None, x["zh"], q).ratio())
    return best if difflib.SequenceMatcher(None, best["zh"], q).ratio() > 0.6 else None

def h(t): return html.escape(t).replace("\n", "<br>")
def strip(t): return t.replace("【", "").replace("】", "")
def secs(d): return f"{round(d / 60 * 2) / 2:g}分钟" if d >= 90 else f"{d}秒"

def build(code):
    tl = json.load(open(os.path.join(T, f"tl_{code}.json")))
    wd = [x["d"] for x in tl if x["t"] == "win"]  # 3 intro, 3 kể lại, chuẩn bị, đọc, 2 trả lời
    rt = [RET[f"{code}-{n}"] for n in (1, 2, 3)]
    rd = READ[code]; q5, q6 = QS[code]
    s5, s6 = sample_for(code, q5), sample_for(code, q6)
    E = {
        "level": 6, "subj": SUBJ, "title": SUBJ, "sub": code, "examName": f"HSKK Cao cấp · {code}", "file": f"HSKK_GAOJI_{code}", "isNew": True,
        "total": f"{round(sum(wd) / 60 + 4)} phút", "prep": "10 phút",
        "desc": f"Đề thi thật HSKK cao cấp {code}: 3 phần, 6 câu, chạy theo file nghe gốc của Hanban.",
        "struct": [["1", "听后复述 — Nghe rồi thuật lại", "3", f"khoảng {secs(wd[3])} / câu"], ["2", "朗读 — Đọc thành tiếng", "1", secs(wd[7])], ["3", "回答问题 — Trả lời câu hỏi", "2", f"{secs(wd[8])} / câu"]],
        "parts": [
            {"cn": "第一部分", "title": "第1-3题：听后复述", "time": f"（每题{secs(wd[3])}左右）", "note": "Nghe một đoạn văn, sau tiếng “嘀” hãy thuật lại nội dung bằng lời của mình — càng đủ ý càng tốt."},
            {"cn": "第二部分", "title": "第4题：朗读", "time": f"（{secs(wd[7])}）", "read": rd, "also": 2, "draft": True, "note": "Trước phần 2 có 10 phút chuẩn bị chung cho phần 2 và phần 3. Sau tiếng “嘀” hãy đọc to, rõ đoạn văn."},
            {"cn": "第三部分", "title": "第5-6题：回答问题", "time": f"（每题{secs(wd[8])}）", "draft": True, "draftOf": 1, "ask": [[5, q5, secs(wd[8])], [6, q6, secs(wd[9])]], "note": "Trả lời từng câu hỏi: nêu quan điểm → lý do → ví dụ → kết luận."},
        ],
        "windows": [
            {"k": "intro", "hint": "你好！你叫什么名字？— Trả lời họ tên."},
            {"k": "intro", "hint": "你是哪国人？— Trả lời quốc tịch."},
            {"k": "intro", "hint": "你的序号是多少？— Đọc số báo danh."},
            *({"k": "ans", "q": n, "part": 0, "hint": "Thuật lại đoạn vừa nghe: ai? chuyện gì? kết quả / ý nghĩa?"} for n in (1, 2, 3)),
            {"k": "prep", "part": 1, "hint": "10 phút: đọc thầm đoạn văn câu 4 (chú ý chữ khó, ngắt câu) và ghi dàn ý cho câu 5–6."},
            {"k": "ans", "q": 4, "part": 1, "hint": "Đọc to, rõ, đúng thanh điệu; ngắt nghỉ theo dấu câu."},
            {"k": "ans", "q": 5, "part": 2, "hint": ""},
            {"k": "ans", "q": 6, "part": 2, "hint": ""},
        ],
        "timeline": tl, "audio": f"audio/hskkg_{code}.mp3",
        "answerQs": [1, 2, 3, 4, 5, 6],
        "qText": {"1": "听后复述", "2": "听后复述", "3": "听后复述", "4": "朗读", "5": q5, "6": q6},
        "qMeta": {**{str(n): {"type": "repeat", "question": f"Câu {n}: 听后复述 · Nghe rồi thuật lại đoạn văn", "images": []} for n in (1, 2, 3)},
                  "4": {"type": "read", "question": "Câu 4: 朗读 · " + rd[:60] + "…", "images": []},
                  "5": {"type": "answer", "question": "Câu 5: " + q5, "images": []}, "6": {"type": "answer", "question": "Câu 6: " + q6, "images": []}},
        "rubric": ["Phát âm, thanh điệu, ngữ điệu tự nhiên", "Thuật lại đủ ý chính và trình tự (phần 1)", "Đọc đúng chữ, ngắt nghỉ hợp lý, trôi chảy (phần 2)", "Quan điểm rõ, có lý do và ví dụ (phần 3)", "Từ vựng – ngữ pháp cao cấp, đa dạng, chính xác", "Nói liên tục, dùng hết thời gian"],
        "samples": [[f"Câu {n} · Lời đoạn nghe", h(r["text"]), "Ý chính: " + " → ".join(p["vn"] for p in r.get("points", [])) if r.get("points") else r.get("vn", "")] for n, r in zip((1, 2, 3), rt)]
                   + [["Câu 4 · 朗读 · Đoạn văn", h(rd), ""]]
                   + [[f"Câu {n} · Bài mẫu tham khảo", h(strip(s["sample"])), s.get("sample_vn", "")] for n, s in ((5, s5), (6, s6)) if s],
    }
    js = json.dumps(E, ensure_ascii=False).replace("</", "<\\/")
    page = f"""<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{SUBJ} · {code} · HSK GARDEN</title>
<link rel="stylesheet" href="room.css?v={VER}"></head>
<body><noscript>Cần bật JavaScript để làm bài thi.</noscript>
<script>window.EXAM={js};</script>
<script src="room.js?v={VER}"></script>
</body></html>
"""
    open(os.path.join(EX, f"HSKK_GAOJI_{code}.html"), "w", encoding="utf-8").write(page)
    return {"level": 6, "tier": "cao", "subj": SUBJ, "name": f"Cao cấp · {code}", "label": f"HSKK Cao cấp · {code}", "title": f"{SUBJ} · {code}",
            "file": f"/hskk-exam/HSKK_GAOJI_{code}.html", "questions": 6, "minutes": round(sum(wd) / 60 + 4), "parts": "Nghe thuật lại 3 câu · Đọc thành tiếng · Trả lời 2 câu", "isNew": True}

if __name__ == "__main__":
    L = [e for e in json.load(open(os.path.join(EX, "exams.json"))) if e.get("tier") != "cao"]
    for c in CODES:
        e = build(c); L.append(e); print(c, e["minutes"], "phút")
    json.dump(L, open(os.path.join(EX, "exams.json"), "w"), ensure_ascii=False, indent=2)
    # đổi phiên bản room.js/css ở mọi trang để trình duyệt tải bản mới
    for f in os.listdir(EX):
        if f.endswith(".html"):
            p = os.path.join(EX, f); s = open(p, encoding="utf-8").read(); s2 = re.sub(r"room\.(js|css)\?v=\w+", lambda m: f"room.{m[1]}?v={VER}", s)
            if s2 != s: open(p, "w", encoding="utf-8").write(s2)
