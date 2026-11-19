import subprocess,re,sys,json
def sil(f):
    o=subprocess.run(["ffmpeg","-hide_banner","-i",f,"-af","silencedetect=n=-40dB:d=0.7","-f","null","-"],capture_output=True,text=True).stderr
    s=[float(x) for x in re.findall(r"silence_start: ([\d.]+)",o)]; e=[float(x) for x in re.findall(r"silence_end: ([\d.]+)",o)]
    return list(zip(s,e))
def segs(f):
    S=sil(f); out=[]
    longs=[i for i,(a,b) in enumerate(S) if b-a>=60]
    for i in longs[:3]:
        end=S[i-1][0]
        j=i-2
        while j>=0 and not (S[j][1]-S[j][0]>=1.2 and end-S[j][1]>8): j-=1
        out.append((round(S[j][1]-0.2,2),round(end+0.4,2)))
    return out
if __name__=="__main__":
    R={}
    for f in sys.argv[1:]:
        try: R[f]=segs(f)
        except Exception as e: R[f]=str(e)
        print(f.split("/")[-1],R[f])
    json.dump(R,open("segs.json","w"),indent=0)
