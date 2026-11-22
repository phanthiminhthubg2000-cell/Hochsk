# -*- coding: utf-8 -*-
"""Phòng thi HSKK trung cấp (H81xxx) cho /hskk-exam.
  python3 tools/hskk_zhong/make.py <thư mục mp3 (H81xxx*.mp3)> <thư mục ocr> [--dry]
- tìm khoảng lặng trong file nghe gốc → cửa sổ ghi âm, cắt bỏ để file nhẹ, sinh timeline cho room.js
- dữ liệu đề: <ocr>/<mã>.json (câu 1-10, 13-14), <mã>.sa.json (bài mẫu), <mã>.asr.json (lời câu 1-10 chép từ file nghe nếu đề không có 录音材料)
- tranh: public/hskk-exam/img/hskkz_<mã>_11|12.jpg (pics.py)"""
import glob, hashlib, html, json, os, re, subprocess, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
EX = os.path.join(ROOT, "public", "hskk-exam")
SRC, O = sys.argv[1], sys.argv[2]; DRY = "--dry" in sys.argv
SUBJ = "HSKK（中级）"

def sil(f):
    o = subprocess.run(["ffmpeg", "-hide_banner", "-i", f, "-af", "silencedetect=noise=-38dB:d=3", "-f", "null", "-"], capture_output=True, text=True).stderr
    st = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", o)]; en = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", o)]
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", o)
    return list(zip(st, en)), int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3])

def plan(f):
    S, D = sil(f)
    pi = next(i for i, (a, b) in enumerate(S) if b - a >= 300)          # 10 phút chuẩn bị
    before = [s for s in S[:pi] if s[1] - s[0] >= 4.5]
    intro, rep = before[:3], before[3:13]
    if len(rep) != 10: raise SystemExit(f"{f}: tìm được {len(rep)} cửa sổ nghe nhắc lại (cần 10): {[round(b - a) for a, b in before]}")
    prep = [S[pi][0], S[pi][1]]; j = pi + 1
    while j < len(S) and S[j][0] - prep[1] < 2.5 and S[j][1] - S[j][0] >= 20: prep[1] = S[j][1]; j += 1
    talk = [s for s in S[j:] if s[1] - s[0] >= 90][:4]
    if len(talk) != 4: raise SystemExit(f"{f}: chỉ thấy {len(talk)} cửa sổ câu 11-14")
    return [("intro", s) for s in intro] + [("rep", s) for s in rep] + [("prep", tuple(prep))] + [("talk", s) for s in talk], D

def timeline(wins, D):
    segs, tl, t, cur = [], [], 0.0, 0.0
    for k, (a, b) in wins:
        a2 = a + 0.4
        segs.append((cur, a2)); tl.append({"t": "play", "a": round(t, 2), "b": round(t + a2 - cur, 2)}); t += a2 - cur
        tl.append({"t": "win", "d": round(b - a - 0.4)}); cur = b - 0.3
    segs.append((cur, D)); tl.append({"t": "play", "a": round(t, 2), "b": round(t + D - cur, 2)})
    return segs, tl

def cut(f, segs, out):
    fl = "".join(f"[0:a]atrim={a:.2f}:{b:.2f},asetpts=PTS-STARTPTS[s{i}];" for i, (a, b) in enumerate(segs)) + "".join(f"[s{i}]" for i in range(len(segs))) + f"concat=n={len(segs)}:v=0:a=1[o]"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", f, "-filter_complex", fl, "-map", "[o]", "-ac", "1", "-ar", "24000", "-b:a", "40k", out], check=True)

h = lambda t: html.escape(t).replace("\n", "<br>")
def mins(d): return f"{round(d / 60 * 2) / 2:g}分钟" if d >= 90 else f"{d}秒"

def build(code, mp3, ver):
    wins, D = plan(mp3); segs, tl = timeline(wins, D)
    d = json.load(open(os.path.join(O, f"{code}.json"))); sa = json.load(open(os.path.join(O, f"{code}.sa.json")))
    asr = os.path.join(O, f"{code}.asr.json")
    sents = d.get("s") or (json.load(open(asr)) if os.path.exists(asr) else [])
    svi = sa.get("s_vi") or []
    if os.path.exists(asr) and not d.get("s"): svi = json.load(open(asr.replace(".asr.", ".asrvi."))) if os.path.exists(asr.replace(".asr.", ".asrvi.")) else []
    wd = [x["d"] for x in tl if x["t"] == "win"]  # 3 mở đầu, 10 nhắc lại, chuẩn bị, 4 câu nói
    q13, q14 = d["q13"], d["q14"]; imgs = [f"img/hskkz_{code}_{n}.jpg" for n in (11, 12)]
    E = {
        "level": 4, "subj": SUBJ, "title": SUBJ, "sub": code, "examName": f"HSKK Trung cấp · {code}", "file": f"HSKK_ZHONGJI_{code}", "isNew": True,
        "total": f"{round(sum(wd) / 60 + 4)} phút", "prep": "10 phút",
        "desc": f"Đề thi thật HSKK trung cấp {code}: 3 phần, 14 câu, chạy theo file nghe gốc của Hanban.",
        "struct": [["1", "听后重复 — Nghe rồi nhắc lại câu", "10", f"{wd[3]} giây / câu"], ["2", "看图说话 — Nhìn tranh nói", "2", "2 phút / câu"], ["3", "回答问题 — Trả lời câu hỏi", "2", "2 phút / câu"]],
        "parts": [
            {"cn": "第一部分", "title": "第1-10题：听后重复", "time": "（每题" + str(wd[3]) + "秒）", "note": "Nghe một câu, sau tiếng “嘀” hãy nhắc lại nguyên văn câu vừa nghe."},
            {"cn": "第二部分", "title": "第11-12题：看图说话", "time": "（每题2分钟）", "imgs": imgs, "qs": [11, 12], "talk": True, "also": 2, "draft": True,
             "note": "Trước câu 11 có 10 phút chuẩn bị chung cho câu 11–14. Nhìn tranh, nói khoảng 2 phút: trong tranh có ai, đang làm gì, chuyện gì đã/ sẽ xảy ra, cảm nghĩ của bạn."},
            {"cn": "第三部分", "title": "第13-14题：回答问题", "time": "（每题2分钟）", "draft": True, "draftOf": 1, "ask": [[13, q13, "2分钟"], [14, q14, "2分钟"]], "note": "Trả lời từng câu hỏi: nêu ý chính → lý do / ví dụ → kết luận."},
        ],
        "windows": [
            {"k": "intro", "hint": "你好！你叫什么名字？— Trả lời họ tên."},
            {"k": "intro", "hint": "你是哪国人？— Trả lời quốc tịch."},
            {"k": "intro", "hint": "你的序号是多少？— Đọc số báo danh."},
            *({"k": "ans", "q": n, "part": 0, "hint": "Nhắc lại câu vừa nghe."} for n in range(1, 11)),
            {"k": "prep", "part": 1, "hint": "10 phút: xem 2 tranh và 2 câu hỏi, ghi dàn ý cho câu 11–14."},
            {"k": "ans", "q": 11, "part": 1, "hint": "Nói về tranh 11: ai? ở đâu? đang làm gì? vì sao? bạn nghĩ gì?"},
            {"k": "ans", "q": 12, "part": 1, "hint": "Nói về tranh 12."},
            {"k": "ans", "q": 13, "part": 2, "hint": ""},
            {"k": "ans", "q": 14, "part": 2, "hint": ""},
        ],
        "timeline": tl, "audio": f"audio/hskkz_{code}.mp3",
        "answerQs": list(range(1, 15)),
        "qText": {**{str(n): (sents[n - 1] if len(sents) == 10 else "听后重复") for n in range(1, 11)}, "11": "看图说话", "12": "看图说话", "13": q13, "14": q14},
        "qMeta": {**{str(n): {"type": "repeat", "question": f"Câu {n}: 听后重复" + (f" · {sents[n - 1]}" if len(sents) == 10 else ""), "images": []} for n in range(1, 11)},
                  "11": {"type": "picture", "question": "Câu 11: 看图说话", "images": [imgs[0]]}, "12": {"type": "picture", "question": "Câu 12: 看图说话", "images": [imgs[1]]},
                  "13": {"type": "answer", "question": "Câu 13: " + q13, "images": []}, "14": {"type": "answer", "question": "Câu 14: " + q14, "images": []}},
        "rubric": ["Nhắc lại đúng, đủ từng câu (phần 1)", "Phát âm, thanh điệu rõ ràng", "Tả tranh có nội dung, có liên tưởng (phần 2)", "Trả lời đúng trọng tâm, có lý do và ví dụ (phần 3)", "Từ vựng – ngữ pháp trung cấp, ít lỗi", "Nói liên tục, dùng hết thời gian"],
        "samples": ([[f"Câu 1–10 · Lời ghi âm", "<br>".join(f"{i + 1}. {html.escape(x)}" for i, x in enumerate(sents)), " · ".join(f"{i + 1}. {v}" for i, v in enumerate(svi))]] if len(sents) == 10 else [])
                   + [[f"Câu {n} · Bài mẫu tham khảo", h(sa[k]["zh"]), sa[k].get("vi", "")] for n, k in ((11, "p11"), (12, "p12"), (13, "q13"), (14, "q14"))],
    }
    js = json.dumps(E, ensure_ascii=False).replace("</", "<\\/")
    page = f"""<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{SUBJ} · {code} · HSK GARDEN</title>
<link rel="stylesheet" href="room.css?v={ver}"></head>
<body><noscript>Cần bật JavaScript để làm bài thi.</noscript>
<script>window.EXAM={js};</script>
<script src="room.js?v={ver}"></script>
</body></html>
"""
    if not DRY:
        cut(mp3, segs, os.path.join(EX, "audio", f"hskkz_{code}.mp3"))
        open(os.path.join(EX, f"HSKK_ZHONGJI_{code}.html"), "w", encoding="utf-8").write(page)
    print(code, " ".join(f"{k}:{round(b - a)}" for k, (a, b) in wins), f"→ {round(tl[-1]['b'])}s, câu 1-10: {len(sents)}")
    return {"level": 4, "tier": "zhong", "subj": SUBJ, "name": f"Trung cấp · {code}", "label": f"HSKK Trung cấp · {code}", "title": f"{SUBJ} · {code}",
            "file": f"/hskk-exam/HSKK_ZHONGJI_{code}.html", "questions": 14, "minutes": round(sum(wd) / 60 + 4), "parts": "Nghe nhắc lại 10 câu · Nhìn tranh nói 2 câu · Trả lời 2 câu", "isNew": True}

if __name__ == "__main__":
    ver = hashlib.md5(open(os.path.join(EX, "room.js"), "rb").read() + open(os.path.join(EX, "room.css"), "rb").read()).hexdigest()[:8]
    L = [e for e in json.load(open(os.path.join(EX, "exams.json"))) if e.get("tier") != "zhong"]
    for mp3 in sorted(glob.glob(os.path.join(SRC, "*H8[01]*.mp3"))):
        if os.path.getsize(mp3) < 1e6: continue
        code = re.search(r"H8[01]\d{3}", mp3)[0]
        if not os.path.exists(os.path.join(O, f"{code}.json")): print(code, "chưa có dữ liệu đề"); continue
        L.append(build(code, mp3, ver))
    if not DRY:
        json.dump(L, open(os.path.join(EX, "exams.json"), "w"), ensure_ascii=False, indent=2)
        for f in glob.glob(os.path.join(EX, "*.html")):
            s = open(f, encoding="utf-8").read(); s2 = re.sub(r"room\.(js|css)\?v=\w+", lambda m: f"room.{m[1]}?v={ver}", s)
            if s2 != s: open(f, "w", encoding="utf-8").write(s2)
