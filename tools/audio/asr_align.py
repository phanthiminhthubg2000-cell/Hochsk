# Gióng chính xác bài khoá với audio gốc bằng nhận dạng giọng nói có mốc thời gian từng chữ (sherpa-onnx paraformer-zh)
# python3 asr_align.py <model_dir> <thư mục mp3 NN.mp3> [NN...]  → cập nhật public/audio/hsk6kw/timings.json (seg mỗi đoạn)
import os, re, sys, json, subprocess, difflib
import numpy as np, sherpa_onnx
MD, SRC = sys.argv[1], sys.argv[2]
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
rec = sherpa_onnx.OfflineRecognizer.from_paraformer(paraformer=f"{MD}/model.int8.onnx", tokens=f"{MD}/tokens.txt", num_threads=2)
han = re.compile(r"[一-鿿]")

def pcm(f):
    raw = subprocess.check_output(["ffmpeg", "-v", "error", "-i", f, "-ac", "1", "-ar", "16000", "-f", "s16le", "-"])
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768

def voiced(f):
    # các quãng có tiếng, tách tại khoảng lặng ≥ 0.3 giây
    o = subprocess.run(["ffmpeg", "-i", f, "-af", "silencedetect=noise=-35dB:d=0.3", "-f", "null", "-"], capture_output=True, text=True).stderr
    st = [float(v) for v in re.findall(r"silence_start: ([\d.]+)", o)]; en = [float(v) for v in re.findall(r"silence_end: ([\d.]+)", o)]
    D = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).strip())
    out, t = [], 0.0
    for a, b in zip(st, en + [D] * (len(st) - len(en))):
        if a - t > 0.15: out.append((t, a))
        t = b
    if D - t > 0.15: out.append((t, D))
    return out

def recognize(f):
    x = pcm(f); chars, times = [], []
    for a, b in voiced(f):
        s = rec.create_stream(); s.accept_waveform(16000, x[int(max(0, a - 0.1) * 16000):int((b + 0.1) * 16000)]); rec.decode_stream(s)
        cs = [c for c in s.result.text if han.match(c)]
        for k, c in enumerate(cs):
            chars.append(c); times.append(a if k == 0 else a + (b - a) * k / len(cs))
    return "".join(chars), times

tf = os.path.join(ROOT, "public/audio/hsk6kw/timings.json")
TM = json.load(open(tf)) if os.path.exists(tf) else {}
only = sys.argv[3:]
for f in sorted(os.listdir(SRC)):
    m = re.match(r"(\d\d)\.mp3$", f)
    if not m or (only and m.group(1) not in only): continue
    L = m.group(1)
    T = json.load(open(os.path.join(ROOT, f"public/data/con-duong/hsk6-{L}.json"), encoding="utf-8"))["T"]
    got, tim = recognize(os.path.join(SRC, f))
    exp = "".join(han.findall("".join(t["zh"] for t in T)))
    starts, k = [], 0
    for t in T:
        starts.append(k); k += len(han.findall(t["zh"]))
    sm = difflib.SequenceMatcher(None, exp, got, autojunk=False)
    mp = {}
    for blk in sm.get_matching_blocks():
        for d in range(blk.size): mp[blk.a + d] = blk.b + d
    def t_of(i, fwd=True):
        # chữ thứ i của bài → thời điểm; nếu chữ đó không nhận ra, lấy chữ khớp gần nhất phía sau
        for d in range(0, 12):
            j = i + d if fwd else i - d
            if j in mp: return tim[mp[j]], d
        return None, None
    seg, ok = [], 0
    for i, st in enumerate(starts):
        t, d = t_of(st)
        if t is not None and d <= 2: ok += 1
        seg.append(t)
    end_t = tim[-1] + 0.6 if tim else None
    S = []
    for i, t in enumerate(seg):
        a = max(0, (t or 0) - 0.35)
        b = (seg[i + 1] - 0.35) if i + 1 < len(seg) and seg[i + 1] else end_t
        S.append([round(a, 2), round(b, 2)])
    ratio = sm.ratio()
    TM[L] = {"seg": S, "match": round(ratio, 3), "ok": f"{ok}/{len(T)}"}
    print(L, "khớp chữ", round(ratio, 3), "đầu đoạn tìm thấy", f"{ok}/{len(T)}", flush=True)
json.dump(TM, open(tf, "w"), indent=0)
