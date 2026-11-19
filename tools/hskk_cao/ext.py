import os,sys,json,glob,subprocess,time
from google import genai
from google.genai import types
D=glob.glob("/tmp/claude-0/-home-claude/c1d1be6c-69c3-53e6-9a09-0acc6c18fa4e/scratchpad/hskk/x_ĐỀ_THI_HSKK_CAO_C/*/")[0]
c=genai.Client(api_key=os.environ["GEMINI_API_KEY"])
MODELS=os.environ.get("MODELS","gemini-3.8-flash,gemini-3.7-flash,gemini-3.5-flash").split(",")
P="""Đây là đề thi thật HSKK 高级 mã {code}: ảnh trang đề{a}{au}.
Trả về JSON:
{{"code":"{code}",
 "retell":[{{"n":1,"text":"nguyên văn đoạn văn của câu 1 听后复述 (không gồm '1.（2分钟）')","start":giây bắt đầu đọc đoạn văn trong file nghe,"end":giây kết thúc}}, …3 câu],
 "read":"nguyên văn đoạn 朗读 câu 4 (bỏ '(2分钟)')",
 "questions":[{{"n":5,"text":"câu hỏi 5 (bỏ phần (2.5分钟))"}},{{"n":6,"text":"…"}}]}}
Chép chính xác chữ Hán, giữ dấu câu tiếng Trung. {extra}Chỉ trả JSON."""
def run(code):
    out=f"ext_{code}.json"
    if os.path.exists(out): return code,"đã có"
    parts=[]
    tmp=f"img_{code}"; subprocess.run(["pdftoppm","-r","110","-gray","-jpeg",D+f"Copy of {code}.pdf",tmp],check=True)
    for f in sorted(glob.glob(tmp+"*.jpg")): parts.append(types.Part.from_bytes(data=open(f,"rb").read(),mime_type="image/jpeg"))
    ans=glob.glob(D+f"Copy of {code}*đáp*.pdf")+glob.glob(D+f"Copy of {code}*#U0111#U00e1p*.pdf")
    if ans:
        t2=f"ans_{code}"; subprocess.run(["pdftoppm","-r","110","-gray","-jpeg",ans[0],t2],check=True)
        for f in sorted(glob.glob(t2+"*.jpg")): parts.append(types.Part.from_bytes(data=open(f,"rb").read(),mime_type="image/jpeg"))
    mp3=D+f"Copy of {code}.mp3"; au=os.path.exists(mp3) and os.path.getsize(mp3)>100000
    if au:
        clip=f"clip_{code}.mp3"
        subprocess.run(["ffmpeg","-v","error","-y","-i",mp3,"-t","540","-ac","1","-ar","16000","-b:a","32k",clip],check=True)
        parts.append(types.Part.from_bytes(data=open(clip,"rb").read(),mime_type="audio/mpeg"))
    extra="" if au else "Không có file nghe: start/end để null; nếu không có lời đoạn văn thì text để rỗng. "
    if au and not ans: extra+="Không có bản in lời bài nghe: hãy nghe file và chép lại chính xác từng chữ ba đoạn văn. "
    if au and ans: extra+="Lời đoạn văn lấy theo bản in 录音材料, file nghe chỉ dùng để xác định start/end. "
    parts.append(P.format(code=code,a=(", ảnh bản in 录音材料" if ans else ""),au=(", file nghe 9 phút đầu (đọc đoạn 1-3, mỗi đoạn sau tiếng bíp là khoảng lặng để thí sinh nói)" if au else ""),extra=extra))
    for i in range(9):
        m=MODELS[i%len(MODELS)]
        try:
            r=c.models.generate_content(model=m,contents=parts,config=types.GenerateContentConfig(response_mime_type="application/json",temperature=0))
            d=json.loads(r.text); d=d[0] if isinstance(d,list) else d; d["_m"]=m
            json.dump(d,open(out,"w"),ensure_ascii=False,indent=1); return code,"xong "+m
        except Exception as e: print(code,m,str(e)[:100],flush=True); time.sleep(10)
    return code,"lỗi"
import concurrent.futures as cf
with cf.ThreadPoolExecutor(3) as ex:
    for r in ex.map(run,sys.argv[1:]): print(*r,flush=True)
