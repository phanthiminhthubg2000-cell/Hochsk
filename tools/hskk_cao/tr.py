import os,json,glob,subprocess,time,concurrent.futures as cf
from google import genai
from google.genai import types
D=glob.glob("/tmp/claude-0/-home-claude/c1d1be6c-69c3-53e6-9a09-0acc6c18fa4e/scratchpad/hskk/x_ĐỀ_THI_HSKK_CAO_C/*/")[0]
c=genai.Client(api_key=os.environ["GEMINI_API_KEY"])
S=json.load(open("segs2.json"))
def go(job):
    code,k=job; a,b=S[code][k][:2]; f=f"cut/{code}_{k+1}.mp3"
    subprocess.run(["ffmpeg","-v","error","-y","-ss",str(a-2),"-to",str(b+2),"-i",D+f"Copy of {code}.mp3","-ac","1","-b:a","48k",f],check=True)
    for i in range(6):
        try:
            r=c.models.generate_content(model=os.environ.get("M","gemini-3.5-flash-lite"),contents=[types.Part.from_bytes(data=open(f,"rb").read(),mime_type="audio/mpeg"),'Chép lại chính xác từng chữ Hán mọi lời nói trong đoạn âm thanh (kể cả câu mở đầu như "第1题" nếu có), có dấu câu tiếng Trung. Ghi [bíp] nếu nghe tiếng bíp. Chỉ trả văn bản.'])
            return code,k,r.text.strip()
        except Exception as e: time.sleep(10)
    return code,k,"LỖI"
ONLY=os.environ.get("ONLY","").split(",")
jobs=[(c_,k) for c_ in S for k in range(3) if not ONLY[0] or c_ in ONLY]
R=json.load(open("tr.json")) if os.path.exists("tr.json") else {}
with cf.ThreadPoolExecutor(6) as ex:
    for code,k,t in ex.map(go,jobs): R[f"{code}_{k+1}"]=t
json.dump(R,open("tr.json","w"),ensure_ascii=False,indent=1)
