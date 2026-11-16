# 精读 · Phân tích bài khoá theo khối từ (chunk) — kiểu giảng "học cả cụm, thay thế, áp vào đời sống"
# Đầu vào: tệp JSON {key: {"kind","title","lines":[...], "words":[...]}}  (key = "1".."5" hoặc "cu")
# Đầu ra : {key: [ {line, s, vn, ch:[{t,py,vn,frame,note,ex:[[zh,vn]],try}]} ]}
# Dùng: GEMINI_KEY=... python3 jd_gen.py in.json out.json
import json, os, re, sys, time, urllib.request, concurrent.futures as cf

KEY = os.environ.get("GEMINI_KEY", "")
MODELS = os.environ.get("MODELS", "gemini-3.1-pro-preview,gemini-3.8-flash,gemini-3.7-flash").split(",")

EXAMPLE = {
  "segs": [
    {"line": 0, "s": "面试的时候，经理对我印象不错，", "vn": "Lúc phỏng vấn, giám đốc có ấn tượng tốt về tôi,",
     "ch": [{"t": "对我印象不错", "py": "duì wǒ yìnxiàng búcuò", "vn": "có ấn tượng tốt về tôi",
             "frame": "A 对 B 印象不错", "note": "Đừng dịch từng chữ, nhớ cả khung: “ai đó có ấn tượng tốt về ai”. Đổi A, B là dùng được ngay.",
             "ex": [["她对我印象不错。", "Cô ấy có ấn tượng tốt về tôi."], ["老师对这个新同学印象不错。", "Thầy giáo có ấn tượng tốt về bạn học mới này."]],
             "try": "Nói: “Khách hàng có ấn tượng tốt về công ty chúng ta.”"}]},
    {"line": 0, "s": "还通知我明天就可以上班了。真没想到，找工作这么顺利。", "vn": "còn báo tôi ngày mai có thể đi làm luôn. Thật không ngờ tìm việc lại thuận lợi như vậy.",
     "ch": [{"t": "通知我明天就可以上班了", "py": "tōngzhī wǒ míngtiān jiù kěyǐ shàngbān le", "vn": "báo tôi mai đi làm được rồi",
             "frame": "通知 + ai + việc gì", "note": "通知 đi thẳng với người được báo rồi tới nội dung, không cần “rằng”.",
             "ex": [["公司通知我们下周一开会。", "Công ty báo chúng tôi thứ Hai tuần sau họp."], ["老师通知大家明天不上课。", "Thầy báo cả lớp mai nghỉ học."]],
             "try": "Nói: “Trường báo chúng tôi thứ Sáu thi HSK.”"},
            {"t": "真没想到", "py": "zhēn méi xiǎngdào", "vn": "thật không ngờ",
             "frame": "真没想到，……", "note": "Cụm mở đầu khi kể một điều bất ngờ, đặt ở đầu câu rồi nói chuyện bất ngờ.",
             "ex": [["真没想到，他汉语说得这么好。", "Thật không ngờ cậu ấy nói tiếng Trung giỏi thế."], ["真没想到，今天会下这么大的雨。", "Thật không ngờ hôm nay mưa to như vậy."]],
             "try": "Nói: “Thật không ngờ bài thi lại dễ như vậy.”"}]},
    {"line": 2, "s": "当然，最重要的是回答问题要诚实。", "vn": "Đương nhiên, quan trọng nhất là trả lời câu hỏi phải thành thật.",
     "ch": [{"t": "最重要的是", "py": "zuì zhòngyào de shì", "vn": "điều quan trọng nhất là",
             "frame": "最重要的是 + việc/điều gì", "note": "的 thay cho danh từ đã hiểu ngầm (“điều”), giống 我想吃越南的 = món Việt. Người Trung dùng cụm này rất nhiều.",
             "ex": [["学汉语，最重要的是多说。", "Học tiếng Trung, quan trọng nhất là nói nhiều."], ["最重要的是今天晚上要完成作业。", "Quan trọng nhất là tối nay phải làm xong bài tập."]],
             "try": "Nói: “Đi phỏng vấn, quan trọng nhất là đúng giờ.”"},
            {"t": "回答问题要诚实", "py": "huídá wèntí yào chéngshí", "vn": "trả lời câu hỏi phải thành thật",
             "frame": "……时 / ……要诚实", "note": "要 + tính từ = lời khuyên “phải …”. Đổi phần đầu sang tình huống khác trong đời sống.",
             "ex": [["跟人交往时要诚实。", "Khi giao tiếp với người khác phải thành thật."], ["说话时要诚实。", "Khi nói chuyện phải thành thật."]],
             "try": "Nói: “Làm bài kiểm tra phải thành thật.”"}]}
  ]
}

PROMPT = """Bạn là giáo viên tiếng Trung người Việt, dạy HSK4 cho người Việt. Hãy soạn phần 精读 (phân tích kỹ) cho một {kind}, theo đúng phương pháp sau (lấy từ video giảng mẫu):
- KHÔNG giảng từng từ đơn (từ mới đã có thẻ riêng). Khoanh ra các KHỐI TỪ / CỤM CỐ ĐỊNH / KHUNG CÂU có trong bài mà người Việt dễ dịch word-by-word sai hoặc rất hay dùng trong đời sống, ví dụ: 对……印象不错, 真没想到, 给……留下好印象, 有能力做好, 最重要的是, 不管……都……, 想办法 + V, 陪在……身边.
- Với mỗi khối: nghĩa tự nhiên tiếng Việt; khung (frame) có chỗ trống để thay; ghi chú ngắn (≤2 câu, chỉ giải thích ngữ pháp khi cần để hiểu khối từ); 2 câu thay thế giữ nguyên khung nhưng đổi sang tình huống đời sống quen thuộc của học viên (đi học, đi làm, thi cử, gia đình, du lịch, học tiếng Trung…), từ vựng trong tầm HSK4; một yêu cầu "try" bằng tiếng Việt để học viên tự nói một câu mới dùng khung đó.
- Chia bài thành các đoạn (seg) theo đúng thứ tự, mỗi seg 1–2 câu (≤ khoảng 60 chữ Hán). Mọi câu của bài phải xuất hiện đúng một lần; "s" phải là CHUỖI CON NGUYÊN VĂN của dòng số "line" (giữ nguyên dấu câu, không sửa chữ), các seg của cùng một dòng nối lại phải bằng đúng dòng đó.
- Mỗi seg 0–3 khối (seg chỉ có câu đơn giản thì để ch rỗng). Toàn bài khoảng {nmin}–{nmax} khối, ưu tiên khối hay và dùng lại được. "t" phải là chuỗi con nguyên văn của "s".
- "vn" của seg: dịch tự nhiên cả seg.
- Pinyin có dấu thanh, đúng biến điệu (不/一).
Chỉ trả về JSON đúng dạng: {{"segs":[{{"line":0,"s":"","vn":"","ch":[{{"t":"","py":"","vn":"","frame":"","note":"","ex":[["",""],["",""]],"try":""}}]}}]}}

VÍ DỤ MẪU (một phần bài khác, để thấy văn phong và độ sâu):
{example}

TỪ MỚI CỦA BÀI (đã học riêng, chỉ dùng khi chúng nằm trong khối từ): {words}

BÀI CẦN PHÂN TÍCH — "{title}". Các dòng (line: nội dung):
{lines}
"""

def call(prompt):
    body = {"contents": [{"parts": [{"text": prompt}]}], "generationConfig": {"responseMimeType": "application/json", "temperature": 0.4}}
    last = None
    for attempt in range(10):
        for m in MODELS:
            try:
                req = urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={KEY}",
                                             json.dumps(body).encode(), {"Content-Type": "application/json"})
                r = json.load(urllib.request.urlopen(req, timeout=600))
                t = "".join(p.get("text", "") for p in r["candidates"][0]["content"]["parts"])
                d = json.loads(t)
                if isinstance(d, list): d = d[0]
                return d, m
            except Exception as e:
                last = f"{m}: {e}"
                if "429" in str(e): time.sleep(20)
        time.sleep(30 * (attempt + 1))
    raise RuntimeError(last)

CJK = r"[\u3400-\u9fff\uff00-\uffef\u3000-\u303f“”‘’]"
def tidy(segs):
    for g in segs:
        for c in g.get("ch", []):
            for e in c.get("ex", []):
                e[0] = re.sub(rf"(?<={CJK})\s+|\s+(?={CJK})", "", e[0]).strip()
    return segs

def check(segs, lines):
    tidy(segs)
    errs = []
    by = {}
    for g in segs:
        i = g.get("line")
        if not isinstance(i, int) or i >= len(lines): errs.append(f"line sai {i}"); continue
        by.setdefault(i, []).append(g["s"])
        for c in g.get("ch", []):
            if c["t"] not in g["s"]: errs.append(f"khối không nằm trong câu: {c['t']} / {g['s']}")
            if len(c.get("ex", [])) < 2: errs.append(f"thiếu ví dụ: {c['t']}")
            for e in c.get("ex", []):
                if re.search(r"[A-Za-z]", re.sub(r"HSK|App|APP|WiFi|KTV|VIP", "", e[0])): errs.append(f"câu ví dụ có chữ Latin, phải viết toàn chữ Hán: {e[0]}")
    norm = lambda s: re.sub(r"\s", "", s)
    for i, l in enumerate(lines):
        if norm("".join(by.get(i, []))) != norm(l): errs.append(f"dòng {i} không khớp: {''.join(by.get(i, []))} ≠ {l}")
    return errs

def one(key, item):
    lines = item["lines"]
    n = sum(len(l) for l in lines)
    nmin, nmax = max(3, n // 30), max(5, n // 17)
    p = PROMPT.format(kind=item["kind"], title=item["title"], words="、".join(item.get("words", [])), nmin=nmin, nmax=nmax,
                      lines="\n".join(f"{i}: {l}" for i, l in enumerate(lines)), example=json.dumps(EXAMPLE, ensure_ascii=False))
    for k in range(3):
        d, m = call(p)
        errs = check(d.get("segs", []), lines)
        if not errs: return key, d["segs"], m
        p2 = p + "\n\nLẦN TRƯỚC SAI: " + "; ".join(errs[:8]) + "\nHãy sửa: s phải nguyên văn, ghép lại đúng từng dòng."
        p = p2
    print("  !! còn lỗi", key, errs[:3], file=sys.stderr)
    return key, d.get("segs", []), m

if __name__ == "__main__":
    src, out = sys.argv[1], sys.argv[2]
    data = json.load(open(src, encoding="utf-8"))
    res = json.load(open(out, encoding="utf-8")) if os.path.exists(out) else {}
    todo = {k: v for k, v in data.items() if k not in res}
    with cf.ThreadPoolExecutor(int(os.environ.get("PAR", "3"))) as ex:
        def safe(kv):
            try: return one(*kv)
            except Exception as e: print("  !! lỗi", kv[0], e, file=sys.stderr); return kv[0], None, None
        for key, segs, m in ex.map(safe, todo.items()):
            if segs is None: continue
            res[key] = segs
            print(" ", key, m, len(segs), "đoạn", sum(len(g.get("ch", [])) for g in segs), "khối", file=sys.stderr)
            json.dump(res, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
