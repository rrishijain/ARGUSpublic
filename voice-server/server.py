"""Local speech. All models are verified by setup; requests never download files."""
import asyncio
import hashlib
import io
import json
import os
import pathlib
import sys
import time
from contextlib import asynccontextmanager

os.environ['HF_HUB_OFFLINE'] = '1'
import numpy as np
import soundfile as sf
from fastapi import FastAPI, HTTPException, Request, Response
from pydantic import BaseModel, Field
import uvicorn

ROOT = pathlib.Path(__file__).resolve().parent.parent
MODELS = ROOT / '.argus-local/voice/models'
INSTANCE = hashlib.sha256(str(ROOT).encode()).hexdigest()[:24]
VOICES = {'af_heart': 'en-us', 'am_michael': 'en-us', 'bf_emma': 'en-gb', 'bm_george': 'en-gb'}
kokoro = None
whisper = None
readiness = {'speaking': False, 'listening': False, 'errors': {}}
lock = asyncio.Lock()

class Speech(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    voice: str = 'af_heart'
    speed: float = Field(default=1.0, ge=0.5, le=2)

def synthesise(body):
    samples, rate = kokoro.create(body.text, voice=body.voice, speed=body.speed, lang=VOICES[body.voice])
    out = io.BytesIO()
    sf.write(out, samples, rate, format='WAV')
    return out.getvalue()

def transcribe(raw):
    segments, info = whisper.transcribe(io.BytesIO(raw), beam_size=1, language='en', vad_filter=False, condition_on_previous_text=False)
    if info.duration > 48:
        raise ValueError('Recording exceeds the 45-second turn limit.')
    return ' '.join(segment.text.strip() for segment in segments)

def preload():
    global kokoro, whisper
    try:
        from kokoro_onnx import Kokoro
        kokoro = Kokoro(str(MODELS / 'kokoro-v1.0.onnx'), str(MODELS / 'voices-v1.0.bin'))
        audio = synthesise(Speech(text='Your local voice is ready.'))
        samples, rate = sf.read(io.BytesIO(audio))
        if rate < 16000 or len(samples) < 1000 or float(np.max(np.abs(samples))) < 0.001:
            raise ValueError('Synthesis produced no usable audio.')
        readiness['speaking'] = True
    except Exception as error:
        readiness['errors']['speaking'] = str(error)
    try:
        from faster_whisper import WhisperModel
        whisper = WhisperModel(str(MODELS / 'whisper-small.en'), device='cpu', compute_type='int8', local_files_only=True, cpu_threads=min(4, os.cpu_count() or 2))
        # Exercise decoding separately, even if synthesis did not start.
        silence = io.BytesIO()
        sf.write(silence, np.zeros(16000, dtype=np.float32), 16000, format='WAV')
        transcribe(silence.getvalue())
        readiness['listening'] = True
    except Exception as error:
        readiness['errors']['listening'] = str(error)

@asynccontextmanager
async def lifespan(app):
    task = asyncio.create_task(asyncio.to_thread(preload))
    yield
    await task

app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None)

@app.middleware('http')
async def local_only(request: Request, call_next):
    if request.headers.get('host') not in ('127.0.0.1:3118', 'localhost:3118') or request.headers.get('origin') not in (None, 'http://127.0.0.1:3117', 'http://localhost:3117'):
        return Response('Forbidden', status_code=403)
    if request.url.path in ('/speak', '/stt') and request.headers.get('x-argus-instance') != INSTANCE:
        return Response('This voice service belongs to a different ARGUS folder.', status_code=403)
    return await call_next(request)

@app.get('/health')
def health():
    return {'ok': readiness['speaking'] and readiness['listening'], 'stt': readiness['listening'], 'engine': 'kokoro', 'voices': list(VOICES), 'instance': INSTANCE, **readiness}

@app.post('/speak')
async def speak(body: Speech):
    if not readiness['speaking']:
        raise HTTPException(503, 'Local speech is still preparing.')
    if body.voice not in VOICES:
        raise HTTPException(400, 'Unsupported voice')
    started = time.perf_counter()
    async with lock:
        audio = await asyncio.to_thread(synthesise, body)
    return Response(audio, media_type='audio/wav', headers={'Cache-Control': 'no-store', 'Server-Timing': f'synthesis;dur={(time.perf_counter()-started)*1000:.0f}'})

@app.post('/stt')
async def stt(request: Request):
    if not readiness['listening']:
        raise HTTPException(503, 'Local recognition is still preparing.')
    raw = bytearray()
    async for chunk in request.stream():
        raw.extend(chunk)
        if len(raw) > 15 * 1024 * 1024:
            raise HTTPException(413, 'Recording too large')
    if not raw:
        raise HTTPException(400, 'Empty recording')
    started = time.perf_counter()
    async with lock:
        try:
            text = await asyncio.to_thread(transcribe, bytes(raw))
        except Exception:
            raise HTTPException(400, 'Could not transcribe this recording')
    return {'text': text, 'transcriptionMs': round((time.perf_counter() - started) * 1000)}

def self_test():
    preload()
    result = {**readiness}
    if readiness['speaking'] and readiness['listening']:
        started = time.perf_counter()
        audio = synthesise(Speech(text='Welcome to your business workspace.'))
        result['synthesisMs'] = round((time.perf_counter() - started) * 1000)
        started = time.perf_counter()
        text = transcribe(audio)
        result['transcriptionMs'] = round((time.perf_counter() - started) * 1000)
        result['roundTrip'] = text
        result['listening'] = 'business' in text.lower() and 'workspace' in text.lower()
    print(json.dumps(result), flush=True)
    return 0 if result['speaking'] and result['listening'] else 1

if __name__ == '__main__':
    if '--self-test' in sys.argv:
        sys.exit(self_test())
    uvicorn.run(app, host='127.0.0.1', port=3118, access_log=False)
