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

res = {}
for it in data:
    path = ROOT + "/public" + it["audioUrl"]
    if not os.path.exists(path): continue
    sents = split_text(it["fullText"]); sil, dur = silences(path)
    head = sil[0][1] if sil and sil[0][0] < 0.05 else 0.0
    tail = sil[-1][0] if sil and sil[-1][1] >= dur - 0.05 else dur
    inner = [(a, b) for a, b in sil if a > head + 0.2 and b < tail - 0.2]
    L = [len(re.sub(r"\W", "", s)) or 1 for s in sents]; tot = sum(L)
    # mỗi mốc cắt: khoảng lặng gần vị trí dự kiến (theo tỉ lệ số chữ), ưu tiên khoảng lặng dài, đi theo thứ tự
    cuts, last, acc = [], head, 0
    for i in range(len(sents) - 1):
        acc += L[i]; exp = head + (tail - head) * acc / tot
        cand = [(a, b) for a, b in inner if (a + b) / 2 > last + 0.4]
        if cand:
            a, b = min(cand, key=lambda x: abs((x[0] + x[1]) / 2 - exp) - 0.6 * min(1.0, x[1] - x[0]))
            if abs((a + b) / 2 - exp) < max(1.5, (tail - head) * 0.15): cuts.append((a, b)); last = (a + b) / 2; continue
        cuts.append((exp, exp)); last = exp
    segs, s = [], head
    for i, t in enumerate(sents):
        e = cuts[i][0] if i < len(cuts) else tail
        segs.append({"t": t, "s": round(max(0, s - 0.08), 2), "e": round(min(dur, e + 0.12), 2)})
        if i < len(cuts): s = cuts[i][1]
    res[it["id"]] = segs
os.makedirs(f"{ROOT}/public/shadowing", exist_ok=True)
json.dump(res, open(f"{ROOT}/public/shadowing/segments.json", "w"), ensure_ascii=False, separators=(",", ":"))
n = sum(len(v) for v in res.values()); print(len(res), "đoạn →", n, "câu")
