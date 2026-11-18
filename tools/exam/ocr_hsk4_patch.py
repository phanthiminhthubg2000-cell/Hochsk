# -*- coding: utf-8 -*-
"""Đọc lại một phần của đề (khi lần đọc đầu thiếu/sai) rồi ghép vào JSON.
  GEMINI_API_KEY=... python3 tools/exam/ocr_hsk4_patch.py <pages.json> <thư mục OCR> <đề> <phần> [--check]
phần: r66 (66-85) · w86 (86-95 + đáp án) · ans (đáp án 1-85) · listening · r46 · r56
--check: không ghi đè, chỉ in chỗ khác với bản đã có"""
import json, os, sys, time
sys.argv, ARGS = sys.argv[:3], sys.argv[3:]
import importlib.util
spec = importlib.util.spec_from_file_location("o", os.path.join(os.path.dirname(__file__), "ocr_hsk4.py"))
sys.argv += ["__none__"]; o = importlib.util.module_from_spec(spec); spec.loader.exec_module(o)
from google.genai import types

k, part = ARGS[0], ARGS[1]; check = "--check" in ARGS
SPEC = {
 "r66": ("q", 'Chỉ đọc phần 二、阅读 第三部分 (câu 66-85). JSON: {"r66":[{"n":66,"p":"đoạn văn","s":"câu hỏi sau ★ (bỏ ★)","o":["phương án A","B","C","D"]} … đủ 66-79], "r80":[{"range":[80,81],"passage":"đoạn văn","qs":[{"n":80,"s":"…","o":[4]},{"n":81,…}]}, [82,83], [84,85]]}. o là NỘI DUNG chữ Hán của phương án, bỏ chữ A/B/C/D.'),
 "w86": ("qa", 'Chỉ đọc phần 三、书写 第一部分 (câu 86-95) trong trang đề và đáp án của câu 86-100 trong trang đáp án. JSON: {"w86":[{"n":86,"w":["từ","từ",…]} … 95], "write_answers":{"86":["câu đáp án"],…"95"}, "ref96":{"96":"câu mẫu",…"100"}}. Mỗi ô từ trong đề là một phần tử, chép đúng thứ tự in.'),
 "ans": ("a", 'Chỉ đọc bảng đáp án câu 1-85 của đề này. JSON: {"answers":{"1":"√ hoặc ×", … "11":"A-D", … "46":"A-F", … "56":"ví dụ BAC", … đủ "1"-"85"}}'),
 "listening": ("q", 'Chỉ đọc phần 一、听力 (câu 1-45). JSON: {"tf":[{"n":1,"s":"câu ★ (bỏ ★)"}…10], "listening":[{"n":11,"o":["A","B","C","D"]}…45]} (o là nội dung phương án, bỏ chữ cái).'),
 "r46": ("q", 'Chỉ đọc phần 二、阅读 第一部分 (câu 46-55). JSON: {"bank46":[6 từ A-F], "ex46":"câu 例如", "r46":[{"n":46,"s":"câu, chỗ trống ghi ___"}…50], "bank51":[6 từ], "ex51":"例如 (A：…<br>B：…)", "r51":[{"n":51,"s":"A：…<br>B：… chỗ trống ___"}…55]}. Bỏ qua chữ viết tay nếu có.'),
 "r56": ("q", 'Chỉ đọc phần 二、阅读 第二部分 (câu 56-65). JSON: {"r56":[{"n":56,"A":"…","B":"…","C":"…"}…65]}'),
}
src, prompt = SPEC[part]
t = o.CFG["tests"][k]; parts = []
for key, pdf, tag in (("q", o.PDF, "Q"), ("s", o.PDF_DA, "S"), ("a", o.PDF_DA, "A")):
    if key not in src: continue
    for p, b in o.pages(*t[key], pdf=pdf, tag=("q" if pdf == o.PDF else "d")):
        parts += [f"[PAGE {tag}{p}]", types.Part.from_bytes(data=b, mime_type="image/jpeg")]
parts.append(f"Các trang scan của cuốn {o.CFG['title']}. Chỉ lấy ĐỀ SỐ {k}. Chép CHÍNH XÁC chữ Hán. " + prompt + " Chỉ trả JSON.")
d = None
for lan in range(8):
    m = o.MODELS[lan % len(o.MODELS)]
    try:
        r = o.client.models.generate_content(model=m, contents=parts, config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0, max_output_tokens=30000))
        d = json.loads(r.text)
        if isinstance(d, list): d = d[0]
        break
    except Exception as e:
        print("  ", m, str(e)[:90]); time.sleep(10 * (lan + 1))
if d is None: sys.exit("lỗi")
f = os.path.join(o.OUT, f"{o.CFG['book']}{int(k):02d}.json"); cur = json.load(open(f, encoding="utf-8"))
if check:
    for key, v in d.items():
        old = cur.get(key)
        if isinstance(v, dict) and isinstance(old, dict):
            diff = {n: (old.get(n), v[n]) for n in v if str(old.get(n, "")).replace(" ", "") != str(v[n]).replace(" ", "")}
            print(key, "khác:", json.dumps(diff, ensure_ascii=False))
        else: print(key, "giống" if old == v else "khác")
    json.dump(d, open(f.replace(".json", f".chk_{part}.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
else:
    cur.update(d); json.dump(cur, open(f, "w", encoding="utf-8"), ensure_ascii=False, indent=1); print(k, part, "đã ghép", m)
