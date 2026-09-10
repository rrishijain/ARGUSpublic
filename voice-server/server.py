"""Optional local speech and transcription. No cloud voice keys or env files."""
import asyncio
import io
import pathlib
from contextlib import asynccontextmanager
import soundfile as sf
from fastapi import FastAPI, HTTPException, Request, Response
from pydantic import BaseModel, Field
import uvicorn

HERE = pathlib.Path(__file__).resolve().parent
VOICES = {'af_heart': 'en-us', 'am_michael': 'en-us', 'bf_emma': 'en-gb', 'bm_george': 'en-gb'}
kokoro = None
whisper = None
lock = asyncio.Lock()

@asynccontextmanager
async def lifespan(app):
    global kokoro
    from kokoro_onnx import Kokoro
    kokoro = Kokoro(str(HERE/'models/kokoro-v1.0.onnx'), str(HERE/'models/voices-v1.0.bin'))
    yield

app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None)

@app.middleware('http')
async def local_only(request: Request, call_next):
    if request.headers.get('host') not in ('127.0.0.1:3118','localhost:3118') or request.headers.get('origin') not in (None,'http://127.0.0.1:3117','http://localhost:3117'):
        return Response('Forbidden',status_code=403)
    return await call_next(request)

@app.get('/health')
def health():
    return {'ok': kokoro is not None, 'stt': True, 'engine':'kokoro', 'voices':list(VOICES)}

class Speech(BaseModel):
    text: str = Field(min_length=1,max_length=2000)
    voice: str = 'af_heart'
    speed: float = Field(default=1.0,ge=0.5,le=2)

def synthesise(body):
    samples, rate = kokoro.create(body.text, voice=body.voice, speed=body.speed, lang=VOICES[body.voice])
    out=io.BytesIO(); sf.write(out,samples,rate,format='WAV'); return out.getvalue()

@app.post('/speak')
async def speak(body: Speech):
    if body.voice not in VOICES: raise HTTPException(400,'Unsupported voice')
    async with lock: audio=await asyncio.to_thread(synthesise,body)
    return Response(audio,media_type='audio/wav',headers={'Cache-Control':'no-store'})

def transcribe(raw):
    global whisper
    if whisper is None:
        from faster_whisper import WhisperModel
        whisper=WhisperModel('tiny.en',device='cpu',compute_type='int8',download_root=str(HERE/'models/whisper'))
    # PyAV accepts a file-like object; no microphone recording is persisted.
    segments,_=whisper.transcribe(io.BytesIO(raw),beam_size=1,language='en')
    return ' '.join(s.text.strip() for s in segments)

@app.post('/stt')
async def stt(request: Request):
    raw=bytearray()
    async for chunk in request.stream():
        raw.extend(chunk)
        if len(raw)>15*1024*1024: raise HTTPException(413,'Recording too large')
    if not raw: raise HTTPException(400,'Empty recording')
    async with lock:
        try: text=await asyncio.to_thread(transcribe,bytes(raw))
        except Exception: raise HTTPException(400,'Could not transcribe this recording')
    return {'text':text}

if __name__=='__main__': uvicorn.run(app,host='127.0.0.1',port=3118,access_log=False)
