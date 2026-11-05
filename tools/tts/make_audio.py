# -*- coding: utf-8 -*-
"""
TẠO GIỌNG ĐỌC CHO SƠN HẢI THƯ VIỆN bằng Gemini TTS (cùng chỉ dẫn giọng của skill "chỉ dẫn giọng đọc tiếng Trung")
Chạy trên máy của cô (máy chủ web không gọi được Google). Cách dùng xem README.md cùng thư mục.

  python make_audio.py --thu                 # thử 5 file đầu (4 câu Trắc Linh Đài + 1 từ) để nghe duyệt
  python make_audio.py trac-linh hsk1        # tạo theo nhóm
  python make_audio.py tat-ca                # tất cả (~10.900 file)

Kết quả: public/audio/tts/<nhóm>/<mã>.mp3 (hoặc .wav nếu máy chưa có ffmpeg) và public/audio/tts/manifest.json
Chạy lại thì bỏ qua file đã có. Muốn làm lại một từ: xoá file của từ đó rồi chạy lại.
"""
import argparse, base64, json, os, shutil, subprocess, sys, time, wave

# ========= CẤU HÌNH — điền theo nút "Get code" trong Google AI Studio =========
MODEL = os.environ.get("TTS_MODEL", "gemini-3.8-flash-tts")          # mã model TTS (vd. lấy từ Get code); để trống sẽ báo lỗi
VOICE = os.environ.get("TTS_VOICE", "Sulafat")    # giọng có sẵn; series video HSK đã dùng Sulafat
API_KEY = os.environ.get("GEMINI_API_KEY", "")
NGHI_GIUA = 0.6
KIEM = os.environ.get("TTS_KIEM", "1") != "0"     # tự nghe lại từng file (tốn thêm một lượt gọi mỗi file); đặt TTS_KIEM=0 để tắt                                   # giây nghỉ giữa hai lần gọi (tránh vượt hạn mức)
# Cách ghép Style + Text thành một lời nhắc. Nếu "Get code" của AI Studio ghép khác, sửa dòng này cho giống.
PROMPT = "### DIRECTOR'S NOTES\n{style}\n\n#### TRANSCRIPT\n{text}"  # đã thử với gemini-3.8-flash-tts: chỉ đọc phần TRANSCRIPT
# ==============================================================================

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
# Đặt trong mã nguồn web thì ghi thẳng vào public/audio/tts; tải riêng hai tệp về máy thì ghi vào thư mục "tts" bên cạnh
OUT = os.environ.get("TTS_OUT") or (os.path.join(ROOT, "public", "audio", "tts") if os.path.isdir(os.path.join(ROOT, "public", "audio")) else os.path.join(HERE, "tts"))

# ---- Style theo skill (mục 3A, 5). Từ đơn: Chế độ A mức 1. Câu nghe: Chế độ B, câu dễ mức 2, câu khó mức 3. ----
STYLE_TU = ("Speaking slowly and clearly, like a native Beijing Mandarin teacher saying a vocabulary word for students; unhurried, every syllable fully formed. "
            "Natural native Putonghua, crisp articulation, full pitch movement, all four tones clearly audible, nothing exaggerated or sung. "
            "Dictionary pinyin: {py}; apply standard tone sandhi and neutral tones as a native speaker would. Say the word once, nothing before or after it. "
            "Let every tone contour finish before moving to the next syllable.")
LOI = "Natural spoken Mandarin, crisp articulation, full pitch movement, all four tones clearly audible."
STYLE_CAU = {
    "cau-1": "Speaking slowly and clearly, unhurried teaching pace, every syllable fully formed, never rushing through a phrase. " + LOI +
             " Warm, friendly self-introduction. Read the whole line in one continuous take, never repeat or split it. Short beat after the greeting; stress on the name at the end, falling statement ending. Let every tone contour finish before moving to the next syllable.",
    "cau-2": "Speaking slowly and clearly, unhurried teaching pace, every syllable fully formed, never rushing through a phrase. " + LOI +
             " Clear and friendly, natural explanatory delivery. Read the whole line in one continuous take, never repeat or split it. Stress on the time phrase at the start and on the final verb phrase, descending in steps to a falling ending. Let every tone contour finish before moving to the next syllable.",
    "cau-3": "Measured, natural reading pace, slightly slower than conversation, never rushing. " + LOI +
             " Narrative, slightly admiring. Read the whole line in one continuous take, never repeat or split it. First clause rising then held at the comma; second clause stress on the adverb meaning on time, falling ending. Let every tone contour finish before moving to the next syllable.",
    "cau-4": "Measured, natural reading pace, slightly slower than conversation, never rushing. " + LOI +
             " Firm, steady, gently persuasive. Read the whole line in one continuous take, never repeat or split it. Contrast the two clauses: first clause level then a lift at the comma, second clause stress on the verb phrase about finding a way, falling ending. Let every tone contour finish before moving to the next syllable.",
}

def style_of(job):
    if job["kind"] == "tu":
        return STYLE_TU.format(py=job.get("py") or "as in the standard dictionary") + VERB
    return STYLE_CAU[job["kind"]] + VERB

# ---- Tự kiểm: cho Gemini nghe lại file vừa tạo, phải ra đúng chữ Hán, không có chữ Latin ----
KIEM_MODEL = os.environ.get("TTS_CHECK_MODEL", "gemini-3-flash-preview")
import re, difflib
def han(t): return "".join(re.findall(r"[\u4e00-\u9fff]", t or ""))
def kiem(client, types, pcm, text):
    import io
    b = io.BytesIO(); w = wave.open(b, "wb"); w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000); w.writeframes(pcm); w.close()
    for _ in range(3):
        try:
            r = client.models.generate_content(model=KIEM_MODEL, contents=[types.Part.from_bytes(data=b.getvalue(), mime_type="audio/wav"), "Transcribe exactly as spoken, original language and script, nothing else."])
            got = (r.text or "").strip(); break
        except Exception as e:
            time.sleep(8); got = None
    if got is None: return True, "(không kiểm được)"
    if re.search(r"[A-Za-z]{2,}", got) and not re.search(r"[A-Za-z]", text): return False, got
    a, g = han(text), han(got)
    if len(a) <= 2: return (len(g) == len(a)), got          # từ ngắn: đồng âm vẫn chấp nhận, chỉ cần đúng số chữ, không phải tiếng Anh
    return difflib.SequenceMatcher(None, a, g).ratio() >= 0.85, got

def die(msg):
    print("LỖI:", msg); sys.exit(1)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("nhom", nargs="*", help="trac-linh hsk1 hsk2 hsk3 hsk4 hsk5 hsk6 hsk7-9 | tat-ca")
    ap.add_argument("--thu", action="store_true", help="chỉ tạo 5 file đầu để nghe thử")
    a = ap.parse_args()
    if not API_KEY: die("chưa có khóa API. Đặt biến môi trường GEMINI_API_KEY (xem README).")
    if not MODEL: die("chưa có mã model. Đặt biến môi trường TTS_MODEL theo nút Get code trong AI Studio (xem README).")
    try:
        from google import genai
        from google.genai import types
    except ImportError:
        die("chưa cài thư viện. Chạy: pip install google-genai")
    jobs = json.load(open(os.path.join(HERE, "jobs.json"), encoding="utf-8"))
    want = set(a.nhom)
    if a.thu: jobs = [j for j in jobs if j["nhom"] == "trac-linh"] + [j for j in jobs if j["nhom"] == "hsk1"][:1]
    elif "tat-ca" not in want:
        if not want: die("chọn nhóm, ví dụ: python make_audio.py trac-linh hsk1   (hoặc --thu, hoặc tat-ca)")
        jobs = [j for j in jobs if j["nhom"] in want]
    has_ffmpeg = shutil.which("ffmpeg") is not None
    if not has_ffmpeg: print("Chưa có ffmpeg — sẽ lưu .wav (nặng hơn mp3 khoảng 6 lần). Cài ffmpeg rồi chạy lại để có mp3.")
    client = genai.Client(api_key=API_KEY)
    man_path = os.path.join(OUT, "manifest.json")
    manifest = json.load(open(man_path, encoding="utf-8")) if os.path.exists(man_path) else {}
    done = loi = 0
    for n, j in enumerate(jobs, 1):
        rel = f'{j["nhom"]}/{j["id"]}.{"mp3" if has_ffmpeg else "wav"}'
        dst = os.path.join(OUT, rel)
        if os.path.exists(dst):
            manifest[j["text"]] = rel; continue
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        prompt = PROMPT.format(style=style_of(j), text=j["text"])
        pcm = None
        for lan in range(6):
            try:
                r = client.models.generate_content(model=MODEL, contents=prompt, config=types.GenerateContentConfig(
                    response_modalities=["AUDIO"],
                    speech_config=types.SpeechConfig(voice_config=types.VoiceConfig(prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=VOICE)))))
                part = r.candidates[0].content.parts[0].inline_data
                pcm = part.data if isinstance(part.data, (bytes, bytearray)) else base64.b64decode(part.data)
                ok, got = kiem(client, types, pcm, j["text"]) if KIEM else (True, "")
                if ok: break
                print(f"  [{j['text']}] đọc sai thành: {got[:60]} — tạo lại"); pcm = None; continue
            except Exception as e:
                if "RESOURCE_EXHAUSTED" in str(e) and "per day" in str(e).lower() or "free_tier_requests" in str(e):
                    json.dump(manifest, open(man_path, "w", encoding="utf-8"), ensure_ascii=False)
                    die("hết hạn mức gọi trong ngày của khóa API (gói miễn phí). Đã lưu phần đã làm; chạy lại sau hoặc bật thanh toán.")
                cho = 10 * (lan + 1)
                print(f"  [{j['text']}] lỗi: {str(e)[:120]} — thử lại sau {cho}s"); time.sleep(cho); pcm = None
        if not pcm:
            loi += 1; continue
        wav = dst if not has_ffmpeg else dst[:-4] + ".wav"
        with wave.open(wav, "wb") as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000); w.writeframes(pcm)
        if has_ffmpeg:
            subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", wav, "-af", "silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse", "-ac", "1", "-b:a", "48k", dst], check=False)
            if os.path.exists(dst): os.remove(wav)
            else: rel = rel[:-4] + ".wav"
        manifest[j["text"]] = rel; done += 1
        if done % 20 == 0:
            json.dump(manifest, open(man_path, "w", encoding="utf-8"), ensure_ascii=False)
        print(f"{n}/{len(jobs)} {j['text']}")
        time.sleep(NGHI_GIUA)
    os.makedirs(OUT, exist_ok=True)
    json.dump(manifest, open(man_path, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"Xong: tạo mới {done} file, lỗi {loi}. Danh mục: {man_path}")

if __name__ == "__main__":
    main()
