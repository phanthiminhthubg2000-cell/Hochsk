# -*- coding: utf-8 -*-
"""Đọc sách scan luyện đề HSK4 (bản 2.0) bằng Gemini → JSON trung gian cho từng đề.
  GEMINI_API_KEY=... python3 tools/exam/ocr_hsk4.py <pages.json> <thư mục ra> [số đề ...]
pages.json: {"book":"xl","title":"…","pdf":"đề.pdf","pdf_da":"đáp án.pdf (tuỳ)",
             "tests":{"1":{"q":[a,b],"s":[a,b],"a":[a,b]}, …}}   (s, a là trang trong pdf_da nếu có, không thì trong pdf)
Sau đó: python3 tools/exam/hsk4_ocr_to_paper.py <pages.json> <thư mục ra>"""
import json, os, subprocess, sys, time, concurrent.futures as cf
from google import genai
from google.genai import types

CFG = json.load(open(sys.argv[1], encoding="utf-8"))
OUT = sys.argv[2]
WANT = [x for x in sys.argv[3:]] or list(CFG["tests"].keys())
os.makedirs(OUT, exist_ok=True)
MODELS = os.environ.get("OCR_MODELS", "gemini-3.5-flash,gemini-3.1-flash-lite").split(",")
client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
PDF = CFG["pdf"]; PDF_DA = CFG.get("pdf_da") or PDF

def pages(a, b, pdf, tag, dpi=140):
    tmp = os.path.join(OUT, "tmp"); os.makedirs(tmp, exist_ok=True)
    out = []
    for p in range(a, b + 1):
        f = os.path.join(tmp, f"{tag}{p:03d}.jpg")
        if not os.path.exists(f):
            subprocess.run(["pdftoppm", "-r", str(dpi), "-f", str(p), "-l", str(p), "-jpeg", "-jpegopt", "quality=80", "-singlefile", pdf, f[:-4]], check=True)
        out.append((p, open(f, "rb").read()))
    return out

PROMPT = """Bạn nhận các trang scan của cuốn {title}. Chỉ lấy nội dung của ĐỀ SỐ {k} (bỏ qua mọi trang/phần của đề khác lẫn vào ở hai đầu).
Mỗi ảnh có nhãn [PAGE x] ngay trước nó (Q = trang đề, S = lời bài nghe, A = đáp án). Chép CHÍNH XÁC chữ Hán như trong sách (không sửa, không dịch, không thêm pinyin).
Cấu trúc đề HSK4: nghe 1-10 (câu ★ đúng/sai), 11-45 (chọn A-D); đọc 46-55 (chọn từ A-F điền chỗ trống), 56-65 (sắp xếp A B C), 66-85 (đọc hiểu, 80-85 hai câu một đoạn); viết 86-95 (sắp xếp từ), 96-100 (nhìn tranh dùng từ đặt câu).
Trả về MỘT đối tượng JSON, đúng các khóa sau:
{{
 "tf": [{{"n":1,"s":"câu ★ in trong đề, bỏ dấu ★ và bỏ ( )"}} … 1-10],
 "listening": [{{"n":11,"o":["…","…","…","…"]}} … 11-45],      // chỉ nội dung phương án, bỏ chữ A/B/C/D
 "bank46": ["6 từ A-F của 46-50"], "ex46": "câu ví dụ 例如 của 46-50, chỗ trống ghi (D) như sách",
 "r46": [{{"n":46,"s":"câu, chỗ trống ghi ___"}} … 50],
 "bank51": ["6 từ A-F của 51-55"], "ex51": "ví dụ 例如 của 51-55 (hội thoại A：…<br>B：…)",
 "r51": [{{"n":51,"s":"A：…<br>B：… chỗ trống ghi ___"}} … 55],
 "r56": [{{"n":56,"A":"…","B":"…","C":"…"}} … 65],
 "r66": [{{"n":66,"p":"đoạn văn","s":"câu hỏi sau ★ (bỏ ★)","o":[4]}} … 79],
 "r80": [{{"range":[80,81],"passage":"đoạn văn","qs":[{{"n":80,"s":"câu hỏi (bỏ ★)","o":[4]}},{{"n":81,…}}]}}, [82,83], [84,85]],
 "w86": [{{"n":86,"w":["từ","từ",…]}} … 95],      // đúng thứ tự in trong đề
 "w96": [{{"n":96,"word":"từ cho sẵn","page":"nhãn trang có tranh, ví dụ Q15","box":[ymin,xmin,ymax,xmax]}} … 100],   // box: khung TRANH của câu đó, thang 0-1000 theo ảnh trang
 "answers": {{"1":"√ hoặc ×", … "11":"B", … "46":"A-F", … "56":"BAC", … đủ "1"-"85"}},
 "write_answers": {{"86":["câu đúng","cách khác nếu sách cho"], … "95"}},
 "ref96": {{"96":"câu mẫu nếu sách có", …}},
 "script": "toàn bộ lời bài nghe của đề này, giữ xuống dòng, giữ số câu và 男：女：问："
}}
Chỗ có gạch chân: bọc <u>…</u>. Nếu sách không có phần nào thì để rỗng. Chỉ trả JSON."""

def run(k):
    dst = os.path.join(OUT, f"{CFG['book']}{int(k):02d}.json")
    if os.path.exists(dst): return k, "đã có"
    t = CFG["tests"][k]; parts = []
    for key, pdf, tag in (("q", PDF, "Q"), ("s", PDF_DA, "S"), ("a", PDF_DA, "A")):
        if not t.get(key): continue
        for p, b in pages(*t[key], pdf=pdf, tag=("q" if pdf == PDF else "d")):
            parts += [f"[PAGE {tag}{p}]", types.Part.from_bytes(data=b, mime_type="image/jpeg")]
    parts.append(PROMPT.format(k=k, title=CFG["title"]))
    err = ""
    for lan in range(8):
        m = MODELS[lan % len(MODELS)]
        try:
            t0 = time.time()
            r = client.models.generate_content(model=m, contents=parts, config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0, max_output_tokens=65000))
            d = json.loads(r.text)
            if isinstance(d, list): d = d[0]
            d["_model"] = m
            json.dump(d, open(dst, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
            return k, f"xong {m} {time.time()-t0:.0f}s"
        except Exception as e:
            err = f"{m}: {str(e)[:200]}"; print(k, err[:120], flush=True); time.sleep(15 * (lan + 1))
    return k, "lỗi: " + err

if __name__ == "__main__":
    with cf.ThreadPoolExecutor(int(os.environ.get("PAR", "3"))) as ex:
        for k, msg in ex.map(run, WANT): print(k, msg, flush=True)
