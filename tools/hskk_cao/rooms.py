# -*- coding: utf-8 -*-
"""Dựng phòng thi HSKK cao cấp (Hanban H9xxxx) cho /hskk-exam từ file nghe gốc.
  python3 tools/hskk_cao/rooms.py <thư mục chứa 'Copy of Hxxxxx.mp3'> [--dry]
Cắt bỏ khoảng lặng dài (cửa sổ ghi âm / chuẩn bị) → file nghe ngắn + timeline play/win cho room.js."""
import json, os, re, subprocess, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
EX = os.path.join(ROOT, "public", "hskk-exam")
SRC = sys.argv[1]; DRY = "--dry" in sys.argv

def sil(f):
    o = subprocess.run(["ffmpeg", "-hide_banner", "-i", f, "-af", "silencedetect=noise=-38dB:d=3", "-f", "null", "-"], capture_output=True, text=True).stderr
    st = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", o)]; en = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", o)]
    dur = re.search(r"Duration: (\d+):(\d+):([\d.]+)", o); D = int(dur[1]) * 3600 + int(dur[2]) * 60 + float(dur[3])
    return list(zip(st, en)), D

def plan(f):
    S, D = sil(f)
    first = next(i for i, (a, b) in enumerate(S) if b - a >= 55)
    intro = [s for s in S[:first] if s[1] - s[0] >= 4.5][:3]
    rest = S[first:]
    retell = [s for s in rest if s[1] - s[0] >= 55][:3]
    after = [s for s in rest if s[0] > retell[-1][1]]
    pi = next(i for i, s in enumerate(after) if s[1] - s[0] >= 300)
    prep = [after[pi][0], after[pi][1]]
    j = pi + 1
    while j < len(after) and after[j][0] - prep[1] < 2.5 and after[j][1] - after[j][0] >= 20: prep[1] = after[j][1]; j += 1   # "还有1分钟" ngắn xen giữa
    rd = next(s for s in after[j:] if s[1] - s[0] >= 80)
    qa = [s for s in after if s[0] > rd[1] and s[1] - s[0] >= 110][:2]
    wins = [("intro", s) for s in intro] + [("ret", s) for s in retell] + [("prep", tuple(prep)), ("read", rd)] + [("qa", s) for s in qa]
    return wins, D

def build(code, f):
    wins, D = plan(f)
    segs, tl, t, cur = [], [], 0.0, 0.0
    for k, (a, b) in wins:
        a2 = a + 0.4  # giữ một chút lặng sau lời nhắc
        segs.append((cur, a2)); tl.append({"t": "play", "a": round(t, 2), "b": round(t + a2 - cur, 2)}); t += a2 - cur
        tl.append({"t": "win", "d": round(b - a - 0.4)}); cur = b - 0.3
    segs.append((cur, D)); tl.append({"t": "play", "a": round(t, 2), "b": round(t + D - cur, 2)})
    return wins, segs, tl

def cut(f, segs, out):
    fl = "".join(f"[0:a]atrim={a:.2f}:{b:.2f},asetpts=PTS-STARTPTS[s{i}];" for i, (a, b) in enumerate(segs)) + "".join(f"[s{i}]" for i in range(len(segs))) + f"concat=n={len(segs)}:v=0:a=1[o]"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", f, "-filter_complex", fl, "-map", "[o]", "-ac", "1", "-ar", "24000", "-b:a", "40k", out], check=True)

if __name__ == "__main__":
    for fn in sorted(os.listdir(SRC)):
        m = re.match(r"Copy of (H9\d{4})\.mp3$", fn)
        if not m or os.path.getsize(os.path.join(SRC, fn)) < 1e6: continue
        code = m[1]; wins, segs, tl = build(code, os.path.join(SRC, fn))
        print(code, " ".join(f"{k}:{round(b-a)}" for k, (a, b) in wins), "→", round(tl[-1]["b"]), "s")
        if not DRY:
            os.makedirs(os.path.join(EX, "audio"), exist_ok=True)
            cut(os.path.join(SRC, fn), segs, os.path.join(EX, "audio", f"hskkg_{code}.mp3"))
            json.dump(tl, open(os.path.join(ROOT, "tools", "hskk_cao", f"tl_{code}.json"), "w"))
