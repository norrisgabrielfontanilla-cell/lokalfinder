#!/usr/bin/env python3
"""Voice-over for the vertical ad: a woman's voice, made on this machine by a neural text-to-speech model.

    KOKORO_MODELS=<folder> VOICE=af_heart python3 voice.py        (VOICE=af_bella for the second voice)

Model: Kokoro-82M (Apache-2.0) through the `kokoro-onnx` package, files from the kokoro-onnx GitHub release "model-files-v1.0":
    kokoro-v1.0.onnx   sha256 7d5df8ecf7d4b1878015a32686053fd0eebe2bc377234608764cc0ef3636a6c5
    voices-v1.0.bin    sha256 bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d
It is a SYNTHETIC voice (nobody's recording and no real person's voice is imitated). Platforms such as TikTok and Meta ask you to
label AI-generated voices: use their label when you post it.

Every line is made on its own, trimmed, levelled, placed at the second the picture needs it (LINES below), and the whole voice is
lightly EQ'd and compressed so it sits on top of the music. Writes out/voice_<VOICE>.npy (mono float32, 48 kHz, the full length of the
ad), out/voice_<VOICE>.wav (the same, to listen to) and out/voice_<VOICE>.json (where each line landed). mix.py puts it over the music.
"""
import json
import math
import os
import sys
import time
import wave

import numpy as np
from kokoro_onnx import Kokoro

HERE = os.path.dirname(os.path.abspath(__file__))
MODELS = os.environ.get('KOKORO_MODELS', HERE)
VOICE = os.environ.get('VOICE', 'af_heart')
OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True)
SR_IN, SR = 24000, 48000
DUR = float(json.load(open(os.path.join(OUT, 'cues.json')))['duration'])
N = int(SR * DUR)

# id, what she says, the second she starts, the longest she may run (the picture needs the air after that)
LINES = [
    ('hook-1', "Dinner shouldn't mean going downstairs.", 0.25, 1.85),
    ('hook-2', "Order from a neighbor instead.", 2.18, 1.90),
    ('meet', "Meet Lokal Finder!", 4.40, 1.50),
    ('open', "See who's open right now.", 6.20, 2.30),
    ('real', "Real food, from real sellers in your community.", 9.20, 3.50),
    ('steps-1', "Pick your meal, add your unit,", 13.90, 2.30),
    ('steps-2', "Pay cash or GCash, and follow it live.", 16.20, 2.70),
    ('tag-1', "Everything local. One place.", 19.38, 2.00),
    ('tag-2', "Now open at Grass Residences.", 21.48, 2.00),
]
MAX_SPEED = 1.18           # never rush a line more than this: it stops sounding human


def trim(x, thr=0.004, pad=0.03):
    idx = np.where(np.abs(x) > thr)[0]
    if not len(idx):
        return x
    return x[max(0, idx[0] - int(pad * SR_IN)):min(len(x), idx[-1] + int(pad * SR_IN))]


def up2(x):
    """band-limited 24 kHz -> 48 kHz (zero-pad the spectrum)"""
    X = np.fft.rfft(x)
    Y = np.zeros(len(x) + 1, dtype=complex)
    Y[:len(X)] = X
    return np.fft.irfft(Y, 2 * len(x)) * 2


def rms_db(x, floor=0.01):
    a = x[np.abs(x) > floor]
    return 20 * math.log10(math.sqrt(np.mean(a ** 2)) + 1e-9) if len(a) else -99


def biquad(x, b0, b1, b2, a1, a2):
    y = np.zeros_like(x)
    x1 = x2 = y1 = y2 = 0.0
    for i in range(len(x)):
        xi = x[i]
        yi = b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
        x2 = x1; x1 = xi; y2 = y1; y1 = yi; y[i] = yi
    return y


def peaking(x, f0, q, gain_db):
    A = 10 ** (gain_db / 40); w0 = 2 * math.pi * f0 / SR; al = math.sin(w0) / (2 * q)
    a0 = 1 + al / A
    return biquad(x, (1 + al * A) / a0, -2 * math.cos(w0) / a0, (1 - al * A) / a0, -2 * math.cos(w0) / a0, (1 - al / A) / a0)


def highpass(x, f0, q=0.707):
    w0 = 2 * math.pi * f0 / SR; al = math.sin(w0) / (2 * q); c = math.cos(w0); a0 = 1 + al
    return biquad(x, (1 + c) / 2 / a0, -(1 + c) / a0, (1 + c) / 2 / a0, -2 * c / a0, (1 - al) / a0)


def compress(x, thr_db=-24.0, ratio=2.2, att=0.004, rel=0.09):
    aa, ar = math.exp(-1 / (att * SR)), math.exp(-1 / (rel * SR)); thr = 10 ** (thr_db / 20)
    env = 0.0; g = np.ones_like(x); ax = np.abs(x)
    for i in range(len(x)):
        v = ax[i]
        env = aa * env + (1 - aa) * v if v > env else ar * env + (1 - ar) * v
        if env > thr:
            g[i] = (env / thr) ** (1 / ratio - 1)
    return x * g


def main():
    k = Kokoro(os.path.join(MODELS, 'kokoro-v1.0.onnx'), os.path.join(MODELS, 'voices-v1.0.bin'))
    timeline = np.zeros(N, dtype=np.float64)
    report = []
    for lid, text, t0, win in LINES:
        speed = 1.0
        for _ in range(3):
            s, sr = k.create(text, voice=VOICE, speed=speed, lang='en-us')
            assert sr == SR_IN
            s = trim(s)
            d = len(s) / SR_IN
            if d <= win or speed >= MAX_SPEED:
                break
            speed = min(MAX_SPEED, speed * d / win * 1.01)
        x = up2(s.astype(np.float64))
        x *= 10 ** ((-20.0 - rms_db(x)) / 20)                                   # every line at the same level
        n_in, n_out = int(0.008 * SR), int(0.040 * SR)
        x[:n_in] *= np.linspace(0, 1, n_in); x[-n_out:] *= np.linspace(1, 0, n_out)
        i = int(round(t0 * SR))
        seg = x[:max(0, N - i)]
        timeline[i:i + len(seg)] += seg
        report.append({'id': lid, 'text': text, 'start': round(t0, 3), 'end': round(t0 + len(x) / SR, 3), 'speed': round(speed, 3), 'window': win,
                       'fits': bool(len(x) / SR <= win + 0.05)})
        print(f'{lid:8s} {t0:5.2f} -> {t0 + len(x) / SR:5.2f}  (window {win:.2f}, speed {speed:.2f})  {text}', flush=True)
    v = highpass(timeline, 80)
    v = peaking(v, 3200, 0.9, 2.0)
    v = compress(v)
    v *= 10 ** ((-19.0 - rms_db(v)) / 20)
    pk = np.abs(v).max()
    if pk > 0.9:
        v *= 0.9 / pk
    np.save(os.path.join(OUT, f'voice_{VOICE}.npy'), v.astype(np.float32))
    with wave.open(os.path.join(OUT, f'voice_{VOICE}.wav'), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(v, -1, 1) * 32767).astype('<i2').tobytes())
    json.dump({'voice': VOICE, 'model': 'Kokoro-82M (kokoro-onnx, model-files-v1.0)', 'lines': report}, open(os.path.join(OUT, f'voice_{VOICE}.json'), 'w'), indent=1)
    late = [r['id'] for r in report if not r['fits']]
    print('wrote', f'out/voice_{VOICE}.wav', f'{DUR:.1f}s', 'all lines fit their windows' if not late else f'LINES TOO LONG: {late}')


if __name__ == '__main__':
    t = time.time(); main(); print(f'{time.time() - t:.0f}s')
