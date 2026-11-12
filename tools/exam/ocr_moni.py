# -*- coding: utf-8 -*-
"""Đọc sách scan 新HSK模拟试题集·五级 (10 đề) bằng Gemini → JSON trung gian cho từng đề.
  GEMINI_API_KEY=... python3 tools/exam/ocr_moni.py <moni.pdf> <thư mục ra> [số đề ...]
Mỗi đề gửi: trang đề + trang lời bài nghe + trang đáp án (có dư 1 trang hai đầu), nhận lại JSON."""
import json, os, re, subprocess, sys, time, concurrent.futures as cf
from google import genai
from google.genai import types

PDF, OUT = sys.argv[1], sys.argv[2]
BOOK = os.environ.get("BOOK", "moni")   # moni: 新HSK模拟试题集 · jj: 精讲精练 (đề ở PDF, lời nghe + đáp án ở PDF_DA)
PDF_DA = os.environ.get("PDF_DA", PDF)
WANT = [int(x) for x in sys.argv[3:]] or list(range(1, 11))
os.makedirs(OUT, exist_ok=True)
MODEL = os.environ.get("OCR_MODEL", "gemini-3.5-flash")
client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
# trang PDF (đã dò): đề k bắt đầu ở 11+17(k-1); lời bài nghe và đáp án theo dò chân trang
Q = {k: (11 + 17 * (k - 1), 27 + 17 * (k - 1)) for k in range(1, 11)}
S = {1: (181, 186), 2: (185, 192), 3: (191, 198), 4: (197, 204), 5: (202, 208), 6: (207, 214), 7: (213, 220), 8: (219, 225), 9: (224, 231), 10: (230, 237)}
A = {1: (237, 243), 2: (242, 248), 3: (247, 253), 4: (252, 259), 5: (258, 264), 6: (263, 270), 7: (269, 276), 8: (275, 280), 9: (279, 286), 10: (285, 293)}

if BOOK == "jj":
    st = [8, 28, 48, 66, 86, 106, 126, 146, 166]
    Q = {k: (st[k - 1], st[k] - 1) for k in range(1, 9)}
    da = [6, 16, 26, 36, 46, 56, 66, 76, 88]
    S = {k: (da[k - 1], da[k] - 1) for k in range(1, 9)}
    A = {k: None for k in range(1, 9)}
TITLE = {"moni": "新汉语水平考试模拟试题集 HSK五级", "jj": "新汉语水平考试精讲精练 HSK五级"}[BOOK]

def pages(a, b, dpi=140, pdf=None):
    pdf = pdf or PDF
    tmp = os.path.join(OUT, "tmp"); os.makedirs(tmp, exist_ok=True)
    out = []
    for p in range(a, b + 1):
        f = os.path.join(tmp, f"{'d' if pdf != PDF else 'p'}{p:03d}.jpg")
        if not os.path.exists(f):
            subprocess.run(["pdftoppm", "-r", str(dpi), "-f", str(p), "-l", str(p), "-jpeg", "-jpegopt", "quality=80", "-singlefile", pdf, f[:-4]], check=True)
        out.append((p, open(f, "rb").read()))
    return out

PROMPT = """Bạn nhận các trang scan của cuốn {title}. Chỉ lấy nội dung của 模拟试卷{k} (bỏ qua trang của đề khác nếu lẫn vào).
Mỗi ảnh có nhãn [PAGE n] ngay trước nó. Chép CHÍNH XÁC chữ Hán như trong sách (không sửa, không dịch, không thêm pinyin).
Trả về MỘT đối tượng JSON, đúng khóa sau:
{{
 "listening": [{{"n":1,"o":["A…","B…","C…","D…"]}} … đủ 1-45],   // chỉ nội dung phương án, bỏ chữ A/B/C/D
 "reading1": [{{"range":[46,48],"passage":["đoạn 1","đoạn 2"],"qs":[{{"n":46,"o":[4 phương án]}}]}} …],  // chỗ trống trong bài viết thành {{46}}
 "reading2": [{{"n":61,"p":"đoạn văn","o":[4]}} … 61-70],
 "reading3": [{{"range":[71,74],"passage":["…"],"qs":[{{"n":71,"s":"câu hỏi","o":[4]}}]}} … đến 90],
 "write1": [{{"n":91,"w":["từ","từ",…]}} … 91-98],   // đúng thứ tự in trong đề
 "q99": "các từ cho sẵn, ngăn bằng 、",
 "q100": {{"page": số trang [PAGE n] có tranh câu 100, "box": [ymin,xmin,ymax,xmax] khung tranh, thang 0-1000}},
 "answers": {{"1":"B", … đủ "1"-"90"}},
 "write_answers": {{"91":["câu đúng 1","câu đúng 2 nếu sách cho nhiều cách"], … "98"}},
 "script": "toàn bộ lời bài nghe của đề này, giữ xuống dòng, giữ số câu và 男：女：问："
}}
Chữ hoặc cụm có gạch chân trong bài đọc: bọc bằng <u>…</u>. Đoạn văn giữ nguyên chia đoạn như sách. Chỉ trả JSON."""

def run(k):
    dst = os.path.join(OUT, f"{BOOK}{k:02d}.json")
    if os.path.exists(dst): return k, "đã có"
    parts = []
    for rng, pdf in ((Q[k], PDF), (S[k], PDF_DA), (A[k], PDF_DA)):
        if not rng: continue
        for p, b in pages(*rng, pdf=pdf):
            parts += [f"[PAGE {'DA-' if pdf != PDF else ''}{p}]", types.Part.from_bytes(data=b, mime_type="image/jpeg")]
    parts.append(PROMPT.format(k=k, title=TITLE))
    for lan in range(4):
        try:
            t = time.time()
            r = client.models.generate_content(model=MODEL, contents=parts, config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0, max_output_tokens=65000))
            d = json.loads(r.text)
            json.dump(d, open(dst, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
            return k, f"xong {time.time()-t:.0f}s"
        except Exception as e:
            err = str(e)[:200]; time.sleep(20 * (lan + 1))
    return k, "lỗi: " + err

with cf.ThreadPoolExecutor(int(os.environ.get("PAR", "3"))) as ex:
    for k, msg in ex.map(run, WANT): print(k, msg, flush=True)
