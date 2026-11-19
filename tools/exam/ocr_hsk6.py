# -*- coding: utf-8 -*-
"""Đọc sách scan đề HSK6 (bản 2.0) bằng Gemini, chia theo phần cho chính xác → JSON trung gian.
  GEMINI_API_KEY=... python3 tools/exam/ocr_hsk6.py <pages.json> <thư mục ra> [phần] [số đề ...]
phần: listen | read1 | read2 | write | ans | all (mặc định all)
pages.json: {"book","title","pdf","tests":{"1":{"q":[a,b],"s":[a,b],"a":[a,b]}}}
Kết quả: <ra>/<book>NN.<phần>.json ; sau đó chạy hsk6_ocr_to_paper.py"""
import json, os, subprocess, sys, time, concurrent.futures as cf
from google import genai
from google.genai import types

CFG = json.load(open(sys.argv[1], encoding="utf-8")); OUT = sys.argv[2]
PART = sys.argv[3] if len(sys.argv) > 3 else "all"
WANT = sys.argv[4:] or list(CFG["tests"].keys())
os.makedirs(os.path.join(OUT, "tmp"), exist_ok=True)
MODELS = os.environ.get("OCR_MODELS", "gemini-3.5-flash-lite,gemini-3.1-flash-lite").split(",")
client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

def pages(a, b, pdf, dpi=140):
    out = []
    for p in range(a, b + 1):
        f = os.path.join(OUT, "tmp", f"p{p:03d}.jpg")
        if not os.path.exists(f):
            subprocess.run(["pdftoppm", "-r", str(dpi), "-f", str(p), "-l", str(p), "-jpeg", "-jpegopt", "quality=80", "-singlefile", pdf, f[:-4]], check=True)
        out.append((p, open(f, "rb").read()))
    return out

HEAD = "Bạn nhận các trang scan của cuốn {title}. Chỉ lấy nội dung của ĐỀ SỐ {k} (bỏ qua phần của đề khác lẫn ở hai đầu). Mỗi ảnh có nhãn [PAGE Qx] (trang đề), [PAGE Sx] (lời bài nghe), [PAGE Ax] (đáp án). Chép CHÍNH XÁC chữ Hán như trong sách, không sửa, không dịch. Phương án: chỉ nội dung, bỏ chữ cái A/B/C/D đứng đầu.\n"
SPEC = {
 "listen": ("qs", """Phần 一、听力 (câu 1-50) và lời bài nghe. Trả JSON:
{"L":[{"n":1,"o":["…","…","…","…"]}, … đủ 1-50],
 "groups":[[16,20],[21,25],[26,30],[31,33],…],   // các nhóm câu dùng chung một đoạn nghe từ câu 16 trở đi, theo lời bài nghe ("第16到20题是根据下面一段采访")
 "script":"toàn bộ lời bài nghe của đề này, giữ số câu, 男：女：, xuống dòng"}"""),
 "read1": ("q", """Phần 二、阅读 第一部分 và 第二部分 (câu 51-70). Trả JSON:
{"r51":[{"n":51,"o":["câu A","câu B","câu C","câu D"]}, … 60],
 "r61":[{"n":61,"p":"đoạn văn, chỗ trống ghi ___1___ ___2___ ___3___ (___4___) theo thứ tự","o":["các từ của phương án A cách nhau dấu cách","B","C","D"]}, … 70]}"""),
 "read2": ("q", """Phần 二、阅读 第三部分 (71-80) và 第四部分 (81-100). Trả JSON:
{"r71":[{"range":[71,75],"passage":["đoạn 1","đoạn 2",…],"items":["câu A","B","C","D","E"]},{"range":[76,80],…}],   // trong passage thay chỗ trống (71) bằng {71}, (72) bằng {72}…
 "r81":[{"range":[81,84],"passage":["đoạn 1",…],"qs":[{"n":81,"s":"câu hỏi","o":["A","B","C","D"]},…]}, … đến 100]}"""),
 "read2a": ("q", """Chỉ phần 二、阅读 第三部分 (câu 71-80, 选句填空). Trả JSON:
{"r71":[{"range":[71,75],"passage":["đoạn 1","đoạn 2",…],"items":["câu A","B","C","D","E"]},{"range":[76,80],…}]}   // trong passage thay chỗ trống (71) bằng {71}…"""),
 "read2b": ("q", """Chỉ phần 二、阅读 第四部分 (câu 81-100, 5 bài đọc, mỗi bài 4 câu). Trả JSON:
{"r81":[{"range":[81,84],"passage":["đoạn 1",…],"qs":[{"n":81,"s":"câu hỏi","o":["A","B","C","D"]},…]}, … đến 100]}"""),
**{f"g{a}": ("q", f"""Chỉ một bài đọc: bài có các câu {a}-{a+3} trong phần 二、阅读 第四部分. Trả JSON:
{{"range":[{a},{a+3}],"passage":["đoạn 1","đoạn 2",…],"qs":[{{"n":{a},"s":"câu hỏi","o":["A","B","C","D"]}}, … {a+3}]}}""") for a in (81, 85, 89, 93, 97)},
**{f"h{a}": ("q", f"""Chỉ một đoạn văn: đoạn có chỗ trống ({a})-({a+4}) trong phần 二、阅读 第三部分 (选句填空). Trả JSON:
{{"range":[{a},{a+4}],"passage":["đoạn 1","đoạn 2",…],"items":["câu A","B","C","D","E"]}}   // trong passage thay chỗ trống ({a}) bằng {{{a}}}…""") for a in (71, 76)},
 "write": ("qa", """Phần 三、书写 câu 101 (缩写): chép nguyên đoạn văn cần đọc, và bài mẫu/范文 nếu trang đáp án có. Trả JSON:
{"w101":{"read":["đoạn 1","đoạn 2",…],"ref":"bài mẫu nếu có, không thì rỗng","title":"tiêu đề bài mẫu nếu có"}}"""),
 "ans": ("a", """Chỉ đọc BẢNG ĐÁP ÁN câu 1-100 của đề này. Trả JSON: {"answers":{"1":"A",…,"100":"D"}}"""),
}

def run(job):
    k, part = job
    dst = os.path.join(OUT, f"{CFG['book']}{int(k):02d}.{part}.json")
    if os.path.exists(dst): return k, part, "đã có"
    t = CFG["tests"][k]; src, prompt = SPEC[part]; parts = []
    for key, tag in (("q", "Q"), ("s", "S"), ("a", "A")):
        if key not in src or not t.get(key): continue
        a, b = t[key]
        if key == "q" and part == "listen": b = min(b, a + 10)  # phần nghe nằm ở các trang đầu
        if key == "q" and part == "write": a = max(a, b - 3)
        for p, img in pages(a, b, CFG["pdf"]):
            parts += [f"[PAGE {tag}{p}]", types.Part.from_bytes(data=img, mime_type="image/jpeg")]
    parts.append(HEAD.format(title=CFG["title"], k=k) + prompt + "\nChỉ trả JSON.")
    err = ""
    for lan in range(8):
        m = MODELS[lan % len(MODELS)]
        try:
            r = client.models.generate_content(model=m, contents=parts, config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0, max_output_tokens=60000))
            d = json.loads(r.text); d = d[0] if isinstance(d, list) else d; d["_model"] = m
            json.dump(d, open(dst, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
            return k, part, "xong " + m
        except Exception as e:
            err = f"{m}: {str(e)[:150]}"; time.sleep(8 * (lan + 1))
    return k, part, "lỗi " + err

if __name__ == "__main__":
    parts = [p for p in SPEC if p not in ("read2a", "read2b") and not p.startswith(("g", "h"))] if PART == "all" else PART.split(",")
    jobs = [(k, p) for k in WANT for p in parts]
    for k in WANT:  # dựng ảnh trước, tránh hai luồng ghi cùng một tệp
        for key in ("q", "s", "a"):
            if CFG["tests"][k].get(key): pages(*CFG["tests"][k][key], CFG["pdf"])
    with cf.ThreadPoolExecutor(int(os.environ.get("PAR", "4"))) as ex:
        for k, p, msg in ex.map(run, jobs): print(k, p, msg, flush=True)
