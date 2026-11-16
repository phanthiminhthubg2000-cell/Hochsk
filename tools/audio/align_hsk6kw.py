# Audio gốc bài khoá HSK6 (标准教程6, file NN-1): đầu băng đọc "第N课 · tên bài · 课文 · tên bài", sau đó là bài khoá.
# Gióng từng đoạn (L.T[i].zh) vào băng theo độ dài chữ + khoảng lặng gần nhất → public/audio/hsk6kw/NN.mp3 + timings.json
import os, re, json, subprocess, sys
SRC, ROOT = sys.argv[1], os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
OUT = os.path.join(ROOT, "public/audio/hsk6kw"); os.makedirs(OUT, exist_ok=True)
han = lambda s: len(re.findall(r"[一-鿿0-9]", s))
def dur(f): return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).strip())
def sil(f, d):
    o = subprocess.run(["ffmpeg", "-i", f, "-af", f"silencedetect=noise=-35dB:d={d}", "-f", "null", "-"], capture_output=True, text=True).stderr
    return [(float(a), float(b)) for a, b in zip(re.findall(r"silence_start: ([\d.]+)", o), re.findall(r"silence_end: ([\d.]+)", o))]
res = {}
only = sys.argv[2:]
for f in sorted(os.listdir(SRC)):
    m = re.match(r"(\d\d)\.mp3$", f)
    if not m or (only and m.group(1) not in only): continue
    L = m.group(1); path = os.path.join(SRC, f)
    T = json.load(open(os.path.join(ROOT, f"public/data/con-duong/hsk6-{L}.json"), encoding="utf-8"))["T"]
    D = dur(path); S = sil(path, 0.35)
    # bắt đầu bài khoá: sau khoảng lặng dài nhất trong 30 giây đầu (kết thúc phần đọc tên bài)
    head = [s for s in S if s[1] < 32 and s[0] > 3]
    t0 = max(head, key=lambda s: s[1] - s[0])[1] if head else 0
    tend = S[-1][0] if S and S[-1][1] > D - 0.5 else D
    lens = [han(t["zh"]) for t in T]; tot = sum(lens)
    rate = (tend - t0) / tot
    cuts, cum, prev = [t0], 0, t0
    for i in range(len(T) - 1):
        cum += lens[i]; exp = t0 + cum * rate
        cand = [s for s in S if prev + 1 < s[0] < tend - 1 and abs((s[0] + s[1]) / 2 - exp) < 6]
        best = min(cand, key=lambda s: abs((s[0] + s[1]) / 2 - exp) - 2.5 * min(s[1] - s[0], 1.5)) if cand else (exp, exp)
        c = (best[0] + best[1]) / 2; cuts.append(c); prev = c
        # cập nhật lại tốc độ theo phần còn lại để sai số không dồn
        rest = tot - cum
        if rest > 0: rate = (tend - c) / rest; t0, cum = c - 0, 0; tot = rest
    cuts.append(tend)
    seg = [[round(cuts[i], 2), round(cuts[i + 1], 2)] for i in range(len(T))]
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", path, "-ac", "1", "-b:a", "32k", os.path.join(OUT, f"{L}.mp3")], check=True)
    res[L] = {"seg": seg, "head": round(seg[0][0], 2), "dur": round(D, 2)}
    print(L, len(T), "đoạn", "bắt đầu", seg[0][0], "hết", round(tend, 1))
tf = os.path.join(OUT, "timings.json")
old = json.load(open(tf)) if os.path.exists(tf) else {}
old.update(res); json.dump(old, open(tf, "w"), indent=0)
