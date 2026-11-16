# Cắt audio gốc Sách bài tập HSK6 (标准教程6 练习册) thành từng câu/đoạn cho phần luyện đề
# Vào: thư mục có LL-1.mp3 (第一部分, 5 câu), LL-2.mp3 (第二部分, phỏng vấn + 5 câu), LL-3.mp3 (第三部分, 2 đoạn: 3 + 4 câu)
# Ra : public/audio/hsk6wb/LL-q1..q5.mp3, LL-p2.mp3, LL-p3a.mp3, LL-p3b.mp3 + báo cáo
# Ranh giới câu = khoảng lặng dài (~13 giây) sau mỗi câu; khoảng lặng dài được rút còn 2 giây.
import os, re, subprocess, sys, json
SRC, OUT = sys.argv[1], sys.argv[2]
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../public/data/con-duong')
os.makedirs(OUT, exist_ok=True)

def dur(f):
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).strip())

def silences(f, d, noise="-35dB"):
    o = subprocess.run(["ffmpeg", "-i", f, "-af", f"silencedetect=noise={noise}:d={d}", "-f", "null", "-"], capture_output=True, text=True).stderr
    st = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", o)]
    en = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", o)]
    return list(zip(st, en + [None] * (len(st) - len(en))))

def segments(f):
    D = dur(f)
    gaps = [(s, e if e else D) for s, e in silences(f, 6)]
    segs, t = [], 0.0
    for s, e in gaps:
        if s - t > 1.0: segs.append([t, s])
        t = e
    if D - t > 1.0: segs.append([t, D])
    return segs

def cut(f, parts, out, pad=0.25):
    # ghép các đoạn [a,b] với 2 giây lặng ở giữa, mono 48 kbps
    inputs, filt = [], []
    for i, (a, b) in enumerate(parts):
        a = max(0, a - pad); b = b + pad
        filt.append(f"[0:a]atrim={a:.2f}:{b:.2f},asetpts=PTS-STARTPTS[s{i}]")
    n = len(parts)
    chain = ""
    for i in range(n):
        chain += f"[s{i}]"
        if i < n - 1:
            filt.append(f"anullsrc=r=44100:cl=mono,atrim=0:2[z{i}]"); chain += f"[z{i}]"
    filt.append(f"{chain}concat=n={2*n-1}:v=0:a=1[o]")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", f, "-filter_complex", ";".join(filt), "-map", "[o]", "-ac", "1", "-b:a", "32k", out], check=True)

rep = {}
for f in sorted(os.listdir(SRC)):
    m = re.match(r"(\d\d)-([123])\.mp3$", f)
    if not m: continue
    L, p = m.groups(); path = os.path.join(SRC, f)
    segs = segments(path)
    r = rep.setdefault(L, {})
    r[p] = len(segs)
    if p == "1":
        if len(segs) != 5: r["bad1"] = [round(x[0]) for x in segs]; continue
        # câu 1: bỏ lời hướng dẫn đầu băng — bắt đầu từ số "1" (trước khoảng lặng ngắn cuối cùng trước bài đọc)
        # ước lượng điểm bắt đầu bài đọc câu 1 từ tốc độ đọc của câu 2–5 và độ dài văn bản
        a0, b0 = segs[0]
        say = [re.sub(r"[^\u4e00-\u9fff0-9]", "", q.get("say", "")) for q in json.load(open(os.path.join(DATA, f"hsk6-{L}.json"), encoding="utf-8"))["HSK"]["listen"][0]["qs"]]
        rates = sorted((segs[i][1] - segs[i][0] - 2.0) / max(1, len(say[i])) for i in range(1, 5))
        est = b0 - (rates[1] + rates[2]) / 2 * len(say[0])
        # tìm tiếng đọc số "1": một quãng tiếng ngắn (<1.1 giây) kẹp giữa hai khoảng lặng, gần điểm ước lượng nhất
        sil = [(x, y) for x, y in silences(path, 0.6) if y and x < b0 and y > a0]
        voiced, t = [], a0
        for x, y in sil:
            if x - t > 0.05: voiced.append((t, x, y - x))   # (bắt đầu, kết thúc, độ dài lặng sau đó)
            t = y
        nums = [(st, en) for st, en, g in voiced if en - st < 1.1 and g >= 0.9 and en < b0 - 5]
        start = min(nums, key=lambda v: abs(v[1] - est) + (2 if v[1] > est + 3 else 0))[0] if nums else est - 1.5
        segs[0][0] = start
        r["q1est"] = round(est, 1)
        r["q1start"] = round(segs[0][0], 1)
        for i, sg in enumerate(segs): cut(path, [sg], os.path.join(OUT, f"{L}-q{i+1}.mp3"))
    elif p == "2":
        if len(segs) != 5: r["bad2"] = len(segs)
        cut(path, segs, os.path.join(OUT, f"{L}-p2.mp3"))
    else:
        if len(segs) != 7: r["bad3"] = len(segs); continue
        cut(path, segs[:3], os.path.join(OUT, f"{L}-p3a.mp3"))
        cut(path, segs[3:], os.path.join(OUT, f"{L}-p3b.mp3"))
json.dump(rep, open(os.path.join(SRC, "report.json"), "w"), indent=0)
for k, v in rep.items():
    if any(x.startswith("bad") for x in v): print("!!", k, v)
print("xong", len(rep), "bài")
