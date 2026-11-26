# Tách mỗi đoạn nghe chép (dictation.json) thành câu ngắn để shadowing, tìm mốc thời gian theo khoảng lặng của audio.
# Ra: public/shadowing/segments.json  {id: [{t: "câu", s: giây bắt đầu, e: giây kết thúc}]}
import json, re, subprocess, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
data = json.load(open(f"{ROOT}/src/app/dictation.json"))

def split_text(t):
    parts = [p for p in re.findall(r"[^。！？!?]+[。！？!?”」]*", t) if p.strip()]
    out = []
    for p in parts:  # câu quá dài → cắt ở dấu phẩy gần giữa
        while len(p) > 30:
            cs = [m.end() for m in re.finditer(r"[，；,;：]", p) if 8 <= m.end() <= len(p) - 6]
            if not cs: break
            k = min(cs, key=lambda x: abs(x - len(p) / 2)); out.append(p[:k]); p = p[k:]
        out.append(p)
    merged = []
    for p in out:  # câu quá ngắn (≤ 4 chữ) gộp với câu sau
        if merged and len(re.sub(r"\W", "", merged[-1])) <= 4: merged[-1] += p
        else: merged.append(p)
    if len(merged) > 1 and len(re.sub(r"\W", "", merged[-1])) <= 3: merged[-2] += merged.pop()
    return [m.strip() for m in merged]

def silences(path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", path, "-af", "silencedetect=noise=-32dB:d=0.25", "-f", "null", "-"], capture_output=True, text=True).stderr
    st = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", r)]; en = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", r)]
    dur = float(re.search(r"Duration: (\d+):(\d+):([\d.]+)", r).groups()[2]) + 60 * int(re.search(r"Duration: (\d+):(\d+)", r).group(2))
    return list(zip(st, en)), dur

def align(sents, sil, head, tail):
    inner = [(a, b) for a, b in sil if a > head + 0.2 and b < tail - 0.2]
    L = [len(re.sub(r"\W", "", x)) or 1 for x in sents]; tot = sum(L)
    cuts, last, acc = [], head, 0
    for i in range(len(sents) - 1):
        acc += L[i]; exp = head + (tail - head) * acc / tot
        cand = [(a, b) for a, b in inner if (a + b) / 2 > last + 0.4]
        if cand:
            a, b = min(cand, key=lambda x: abs((x[0] + x[1]) / 2 - exp) - 0.6 * min(1.0, x[1] - x[0]))
            if abs((a + b) / 2 - exp) < max(1.5, (tail - head) * 0.15): cuts.append((a, b)); last = (a + b) / 2; continue
        cuts.append((exp, exp)); last = exp
    segs, st = [], head
    for i, t in enumerate(sents):
        e = cuts[i][0] if i < len(cuts) else tail
        segs.append({"t": t, "s": round(max(0, st - 0.08), 2), "e": round(e + 0.12, 2)})
        if i < len(cuts): st = cuts[i][1]
    return segs

res, items = {}, []
LV = {"HSK 1 (3.0)": 1, "HSK 2 (3.0)": 2, "HSK 3 (3.0)": 3}
for it in data:
    path = ROOT + "/public" + it["audioUrl"]
    if not os.path.exists(path): continue
    sil, dur = silences(path)
    head = sil[0][1] if sil and sil[0][0] < 0.05 else 0.0
    tail = sil[-1][0] if sil and sil[-1][1] >= dur - 0.05 else dur
    res[it["id"]] = align(split_text(it["fullText"]), sil, head, tail)
    m = re.match(r"Bài\s*(\d+)\s*-\s*Câu\s*(\d+)", it["lesson"])
    items.append({"id": it["id"], "level": it["level"], "lesson": int(m.group(1)), "p": int(m.group(2)), "audio": it["audioUrl"]})

# HSK6 (giáo trình 2.0): lời bài khoá + bản dịch từng đoạn lấy trong bài giảng, mốc đoạn trong timings.json
tim = json.load(open(f"{ROOT}/public/audio/hsk6kw/timings.json"))
import glob
for f in sorted(glob.glob(f"{ROOT}/public/lectures/hsk6-*/LESSON_*.html")):
    h = open(f).read(); i = h.find("T:[{zh:")
    if i < 0: continue
    num = int(re.search(r"\d+", os.path.basename(f)).group()); key = f"{num:02d}"
    st = i + 2; d = 0; q = False; k = st
    while k < len(h):  # tìm dấu ] đóng mảng T
        c = h[k]
        if q:
            if c == "\\": k += 1
            elif c == '"': q = False
        elif c == '"': q = True
        elif c == "[": d += 1
        elif c == "]":
            d -= 1
            if d == 0: break
        k += 1
    paras = [(json.loads('"' + a + '"'), json.loads('"' + b + '"')) for a, b in re.findall(r'\{zh:"((?:[^"\\]|\\.)*)",vn:"((?:[^"\\]|\\.)*)"', h[st:k + 1])]
    title = (re.findall(r'title:"([^"]*)"', h[:i]) or [""])[-1]
    T = tim.get(key); path = f"{ROOT}/public/audio/hsk6kw/{key}.mp3"
    if not T or not os.path.exists(path) or len(T["seg"]) != len(paras): print("bỏ", key, len(paras), T and len(T["seg"])); continue
    sil, dur = silences(path)
    for k, ((zh, vn), (a, b)) in enumerate(zip(paras, T["seg"])):
        zh = re.sub(r"【[^】]*】\s*", "", re.sub(r"[{}]", "", zh)); pid = f"hsk6-{key}-{k + 1}"
        res[pid] = align(split_text(zh), [x for x in sil if a < x[0] < b], a, b)
        items.append({"id": pid, "level": "HSK 6 (2.0)", "lesson": num, "p": k + 1, "audio": f"/audio/hsk6kw/{key}.mp3", "title": title, "vn": vn})
os.makedirs(f"{ROOT}/public/shadowing", exist_ok=True)
json.dump(res, open(f"{ROOT}/public/shadowing/segments.json", "w"), ensure_ascii=False, separators=(",", ":"))
json.dump(items, open(f"{ROOT}/public/shadowing/items.json", "w"), ensure_ascii=False, separators=(",", ":"))
n = sum(len(v) for v in res.values()); print(len(res), "đoạn →", n, "câu")
