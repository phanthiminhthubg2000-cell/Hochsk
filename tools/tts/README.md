# Tạo giọng đọc cho Sơn Hải Thư Viện

Công cụ này đọc **10.923 mục** (4 câu nghe Trắc Linh Đài + từ vựng HSK1 → HSK7–9) bằng Gemini TTS, dùng đúng chỉ dẫn giọng của skill *chỉ dẫn giọng đọc tiếng Trung*: từ đơn đọc chậm kiểu cô giáo làm mẫu (Chế độ A, mức 1), câu nghe đọc theo Chế độ B (câu dễ mức 2, câu khó mức 3).
Web tự phát file thu sẵn; mục nào chưa có file thì vẫn dùng giọng trình duyệt như cũ.

## Cần chuẩn bị (một lần)
1. **Khóa API**: vào aistudio.google.com → *Get API key* → tạo khóa, chép lại.
2. **Mã model**: trong AI Studio mở phần tạo giọng nói với **Gemini 3.8 Flash TTS**, bấm **Get code**, chép tên model trong đoạn mã (dạng `gemini-…-tts`). Nhìn luôn xem đoạn mã ghép phần Style và Text thế nào — nếu khác dòng `PROMPT` trong `make_audio.py` thì sửa dòng đó cho giống.
3. **Python 3** và thư viện: `pip install google-genai`
4. (Nên có) **ffmpeg** để lưu mp3 nhẹ; không có thì lưu wav.

## Chạy
Đặt `make_audio.py` và `jobs.json` vào cùng một thư mục, mở cửa sổ lệnh ở thư mục đó:

```
# Windows (PowerShell)
$env:GEMINI_API_KEY="khóa-của-cô"; $env:TTS_MODEL="mã-model"
# macOS
export GEMINI_API_KEY="khóa-của-cô"; export TTS_MODEL="mã-model"

python make_audio.py --thu            # 5 file đầu: 4 câu Trắc Linh Đài + 1 từ HSK1 — nghe duyệt trước
python make_audio.py hsk1 hsk2 hsk3   # sau khi giọng đạt
python make_audio.py tat-ca           # toàn bộ
```

- File ra nằm trong thư mục `tts/` (kèm `manifest.json`). Chạy lại thì bỏ qua file đã có, nên có thể dừng giữa chừng rồi chạy tiếp.
- Muốn đổi giọng: đặt `TTS_VOICE` (mặc định Sulafat). Muốn làm lại một từ: xoá file của từ đó (tìm mã trong `manifest.json`) rồi chạy lại.
- Nghe thấy nhanh hay chậm quá: báo Claude để chỉnh Style đúng một bước theo thang nhịp của skill.

## Gửi lại
Nén thư mục `tts` và gửi vào khung chat; Claude đưa lên web (thư mục `public/audio/tts`).
Ước lượng dung lượng mp3: HSK1–4 khoảng 20 MB, toàn bộ khoảng 100 MB — nên làm HSK1–4 trước.
