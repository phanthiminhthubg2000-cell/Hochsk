# -*- coding: utf-8 -*-
"""Dựng Phòng thi HSK 2.0 (public/hsk2-exam/index.html) từ Phòng thi HSK 3.0 (public/hsk-exam/index.html)
Chạy lại mỗi khi sửa phòng thi 3.0 để hai phòng dùng chung một bộ máy.  python3 tools/exam/make_hsk2_center.py"""
import os, json, glob
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
src = open(os.path.join(ROOT, "public/hsk-exam/index.html"), encoding="utf-8").read()
rep = [
    ("<title>HSK 3.0 模拟考试", "<title>HSK 2.0 真题模拟考试"),
    ("新版HSK（3.0）模拟考试", "HSK（2.0）真题模拟考试"),
    ("Phòng thi HSK 3.0 (dùng chung cho HSK 1–5)", "Phòng thi HSK 2.0 (tự sinh từ phòng thi 3.0 — đừng sửa tay, chạy tools/exam/make_hsk2_center.py)"),
    ("/hsk-exam/papers/<id>.json, danh sách ở /hsk-exam/papers.json", "/hsk2-exam/papers/<id>.json, danh sách ở /hsk2-exam/papers.json"),
    ("欢迎参加中文水平考试HSK3.0模拟考试", "欢迎参加中文水平考试HSK（2.0）模拟考试"),
    ("Welcome to the HSK 3.0 Chinese Proficiency Mock Test", "Welcome to the HSK 2.0 Chinese Proficiency Mock Test"),
    ("level: `HSK 3.0 - Cấp độ ${S.P.level}`", "level: `HSK 2.0 - Cấp độ ${S.P.level}`"),
    ("5: { R: 35 * 60, W: 40 * 60 } }[P.level]", "5: { R: 45 * 60, W: 40 * 60 }, 6: { R: 50 * 60, W: 45 * 60 } }[P.level]"),
]
out = src
for a, b in rep:
    n = out.count(a)
    if not n: raise SystemExit("không thấy: " + a)
    out = out.replace(a, b)
open(os.path.join(ROOT, "public/hsk2-exam/index.html"), "w", encoding="utf-8").write(out)
# danh sách đề
lst = []
for f in sorted(glob.glob(os.path.join(ROOT, "public/hsk2-exam/papers/*.json"))):
    P = json.load(open(f, encoding="utf-8"))
    if P.get("hidden"): continue
    lst.append({"id": P["id"], "level": P["level"], "name": P["name"], "file": "papers/" + os.path.basename(f)})
json.dump(lst, open(os.path.join(ROOT, "public/hsk2-exam/papers.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("Phòng thi HSK 2.0:", len(lst), "đề")
