#!/usr/bin/env python3
"""Original soundtrack for the vertical ad. Everything is synthesized here with numpy: no samples, no recordings,
no licensed music, so it can be posted anywhere. It reads out/cues.json (written by `node render.js cues`: the moments the
page animates something) so the sound effects land exactly on the pictures.

    python3 audio.py [out/soundtrack.wav]

100 bpm (one beat = 0.6 s), C major, C - G - Am - F: a soft pad and a mallet arpeggio under the hook, the beat comes in with
the app at 4.2 s, a clap joins at the real food (9.0 s), the last bar is the call to action. Peak and loudness are checked
with ffmpeg afterwards (README.md).
"""
import json
import math
import os
import sys
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 48000
BEAT = 0.6
BAR = BEAT * 4
cues = json.load(open(os.path.join(HERE, 'out', 'cues.json')))
DUR = float(cues['duration'])
N = int(SR * DUR)
rng = np.random.default_rng(11)
L = np.zeros(N); R = np.zeros(N)           # dry bus
WL = np.zeros(N); WR = np.zeros(N)         # reverb send


def put(sig, t, gain=1.0, pan=0.0, send=0.0):
    i = int(round(t * SR))
    a = max(0, -i); b = min(len(sig), N - i)
    if b <= a:
        return
    seg = sig[a:b] * gain
    ang = (pan + 1) * math.pi / 4
    gl, gr = math.cos(ang), math.sin(ang)
    L[i + a:i + b] += seg * gl; R[i + a:i + b] += seg * gr
    if send:
        WL[i + a:i + b] += seg * gl * send; WR[i + a:i + b] += seg * gr * send


def tt(d):
    return np.arange(int(d * SR)) / SR


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


# ───────────────────────────────────────────── voices
def pluck(f, d=1.0, bright=1.0):
    """a soft mallet / kalimba note: a few partials, each with its own decay"""
    t = tt(d)
    y = np.zeros_like(t)
    for mult, amp, tau in ((1.0, 1.0, 0.5), (2.0, 0.36 * bright, 0.26), (3.0, 0.18 * bright, 0.16), (4.01, 0.09 * bright, 0.1), (5.4, 0.04 * bright, 0.05)):
        y += amp * np.sin(2 * math.pi * f * mult * t) * np.exp(-t / tau)
    return y * np.minimum(1.0, t / 0.004)


def bell(f, d=1.8):
    t = tt(d)
    y = np.sin(2 * math.pi * f * t) * np.exp(-t / 0.6) + 0.42 * np.sin(2 * math.pi * f * 2.76 * t) * np.exp(-t / 0.28) + 0.18 * np.sin(2 * math.pi * f * 5.4 * t) * np.exp(-t / 0.12)
    return y * np.minimum(1.0, t / 0.003)


def pad(freqs, d, a=0.5, r=0.8):
    t = tt(d + r)
    y = np.zeros_like(t)
    for f in freqs:
        for det in (-2.5, 2.5):
            ff = f * 2 ** (det / 1200)
            y += np.sin(2 * math.pi * ff * t) + 0.26 * np.sin(2 * math.pi * 2 * ff * t)
    env = np.minimum(1.0, t / a) * np.where(t < d, 1.0, np.exp(-(t - d) / (r / 3.0)))
    return y * env / (len(freqs) * 2)


def bass(f, d=0.5):
    t = tt(d)
    y = np.sin(2 * math.pi * f * t) + 0.22 * np.sin(2 * math.pi * 2 * f * t)
    return y * np.exp(-t / (d * 0.55)) * np.minimum(1.0, t / 0.006)


def kick():
    t = tt(0.42)
    f = 46 + 110 * np.exp(-t / 0.03)
    y = np.sin(2 * math.pi * np.cumsum(f) / SR) * np.exp(-t / 0.13)
    return (y + 0.22 * np.sin(2 * math.pi * 1800 * t) * np.exp(-t / 0.002)) * np.minimum(1.0, t / 0.001)


def hat(open_=False):
    n = int(SR * (0.2 if open_ else 0.07)); t = np.arange(n) / SR
    x = rng.standard_normal(n)
    x = np.diff(x, prepend=0.0); x = np.diff(x, prepend=0.0)
    return x * np.exp(-t / (0.06 if open_ else 0.014)) * 0.5


def biquad_bp(x, f0, q):
    w0 = 2 * math.pi * f0 / SR; al = math.sin(w0) / (2 * q)
    a0 = 1 + al; b0 = al / a0; b2 = -al / a0; a1 = -2 * math.cos(w0) / a0; a2 = (1 - al) / a0
    y = np.zeros_like(x); x1 = x2 = y1 = y2 = 0.0
    for i in range(len(x)):
        xi = x[i]; yi = b0 * xi + b2 * x2 - a1 * y1 - a2 * y2
        x2 = x1; x1 = xi; y2 = y1; y1 = yi; y[i] = yi
    return y


def clap():
    n = int(SR * 0.3); t = np.arange(n) / SR
    x = biquad_bp(rng.standard_normal(n), 1700, 1.1)
    env = np.exp(-t / 0.09) * 0.35
    for k, off in enumerate((0.0, 0.011, 0.023)):
        i = int(off * SR); env[i:] += np.exp(-t[:n - i] / 0.012) * (0.7 if k < 2 else 1.0)
    return x * env * 2.2


def sweep(d, f_lo, f_hi, up=True, q=1.7, shape='bell'):
    """band-limited noise whose centre frequency glides: whooshes, swishes and the riser"""
    n = int(d * SR); t = np.arange(n) / SR; x = rng.standard_normal(n)
    y = np.zeros(n); lp = bp = 0.0; qq = 1.0 / q
    for i in range(n):
        u = i / n; fc = f_lo * (f_hi / f_lo) ** (u if up else 1 - u)
        f = 2 * math.sin(math.pi * fc / SR)
        hp = x[i] - lp - qq * bp; bp += f * hp; lp += f * bp
        y[i] = bp
    u = np.clip(t / d, 0, 1)
    env = np.sin(np.pi * u) ** 2 if shape == 'bell' else u ** 2.2
    return y * env


def blip(f0, f1, d, tau):
    t = tt(d)
    f = f0 + (f1 - f0) * np.clip(t / (d * 0.6), 0, 1)
    return np.sin(2 * math.pi * np.cumsum(f) / SR) * np.exp(-t / tau) * np.minimum(1.0, t / 0.002)


def thump(d=0.7):
    t = tt(d)
    y = np.sin(2 * math.pi * np.cumsum(38 + 70 * np.exp(-t / 0.08)) / SR) * np.exp(-t / 0.22)
    return y * np.minimum(1.0, t / 0.003)


# ───────────────────────────────────────────── the music
CH = [  # root (bass), pad tones, arpeggio tones
    (48, [60, 64, 67, 72], [72, 76, 79, 84]),   # C
    (43, [59, 62, 67, 71], [71, 74, 79, 83]),   # G
    (45, [60, 64, 69, 72], [72, 76, 81, 84]),   # Am
    (41, [60, 65, 69, 72], [72, 77, 81, 84]),   # F
]
PROG = [0, 1, 2, 3, 0, 1, 2, 3, 0, 0]
nbars = int(math.ceil(DUR / BAR))
for k in range(nbars):
    ch = CH[PROG[k % len(PROG)]]
    put(pad([midi(m) for m in ch[1]], BAR + 0.25), k * BAR, gain=0.42, send=0.35)

GROOVE = 4.2                                     # the app lands: the beat comes in (beat 7)
PAT = [0, 1, 2, 1, 0, 1, 2, 3]                   # eighth-note arpeggio over the chord tones
step = 0.3
for j in range(int(DUR / step)):
    t = j * step
    bar = int(t // BAR); sub = int(round((t - bar * BAR) / step)) % 8
    ch = CH[PROG[min(bar, len(PROG) - 1)]]
    if t < 1.2 or t >= DUR - 1.5:
        continue
    if t < GROOVE - 0.01:                        # the hook: sparse, building
        if sub % 2 == 0:
            g = 0.10 + 0.22 * (t - 1.2) / 3.0
            put(pluck(midi(ch[2][PAT[sub]] - 12)), t, gain=g, pan=-0.25 if (j % 2) else 0.25, send=0.45)
        continue
    accent = 1.0 if sub % 2 == 0 else 0.62
    put(pluck(midi(ch[2][PAT[sub]])), t, gain=0.30 * accent, pan=-0.35 if (j % 2) else 0.35, send=0.4)

# the beat
nb = int(DUR / BEAT)
for n in range(nb):
    t = n * BEAT
    if t < GROOVE - 0.01:
        continue
    bar = int(t // BAR)
    ch = CH[PROG[min(bar, len(PROG) - 1)]]
    if n % 4 in (0, 2) or (n % 4 == 3 and bar % 2 == 1):     # kick on 1 and 3, a ghost on the last beat of every second bar
        put(kick(), t, gain=0.62 if n % 4 != 3 else 0.32)
    put(hat(), t + BEAT / 2, gain=0.10 if t < 9.0 else 0.13, pan=0.3)
    if t >= 9.0 - 0.01 and n % 4 in (1, 3):
        put(clap(), t, gain=0.20, pan=-0.1, send=0.25)
    if n % 4 == 0:
        put(bass(midi(ch[0]), 0.9), t, gain=0.42)
    if n % 4 == 2:
        put(bass(midi(ch[0]), 0.28), t + BEAT / 2, gain=0.26)
    if t >= 13.2 - 0.01 and t < 19.2 and n % 2 == 1:         # a shaker lifts the ordering scenes
        put(hat(), t + BEAT / 4, gain=0.05, pan=-0.3)

# a riser into the app and into the call to action
put(sweep(1.2, 500, 5200, up=True, q=1.4, shape='rise'), GROOVE - 1.2, gain=0.16, send=0.3)
put(sweep(0.9, 500, 5200, up=True, q=1.4, shape='rise'), 19.2 - 0.9, gain=0.16, send=0.3)

# ───────────────────────────────────────────── sound effects, one per cue the page registered
GAIN = dict(tick=0.10, pop=0.16, tap=0.14, swipe=0.12, whoosh=0.22, swish=0.14, impact=0.5, ding=0.2, chime=0.2, draw=0.07)
for c in cues['cues']:
    t, k = float(c['t']), c['k']
    pan = float(np.clip(math.sin(t * 7.3) * 0.35, -0.4, 0.4))
    if k == 'tick':
        put(blip(2300, 1800, 0.05, 0.012), t, gain=GAIN[k], pan=pan)
    elif k == 'pop':
        put(blip(520, 980, 0.12, 0.035), t, gain=GAIN[k], pan=pan, send=0.15)
    elif k == 'tap':
        put(blip(1500, 1100, 0.06, 0.014), t, gain=GAIN[k], pan=pan); put(thump(0.06), t, gain=0.05)
    elif k == 'swipe':
        put(sweep(0.28, 900, 3600, up=True, q=2.2), t - 0.06, gain=GAIN[k], pan=pan)
    elif k == 'whoosh':
        put(sweep(0.75, 350, 4200, up=False, q=1.5), t - 0.35, gain=GAIN[k], pan=pan, send=0.2)
    elif k == 'swish':
        put(sweep(0.5, 600, 3800, up=True, q=1.8), t - 0.1, gain=GAIN[k], send=0.15)
    elif k == 'impact':
        put(thump(0.8), t, gain=GAIN[k]); put(sweep(0.5, 200, 3000, up=False, q=1.0), t, gain=0.08, send=0.3)
    elif k == 'ding':
        put(bell(midi(88), 1.2), t, gain=GAIN[k], pan=0.15, send=0.35); put(bell(midi(95), 1.2), t + 0.12, gain=GAIN[k] * 0.8, pan=0.15, send=0.35)
    elif k == 'chime':
        for i, m in enumerate((84, 88, 91, 96)):
            put(bell(midi(m), 2.0), t + i * 0.09, gain=GAIN[k] * (1.0 - 0.1 * i), pan=-0.15 + 0.1 * i, send=0.45)
    elif k == 'draw':
        put(blip(420, 1500, 0.8, 0.5) * (0.6 + 0.4 * np.sin(2 * math.pi * 9 * tt(0.8))), t, gain=GAIN[k], pan=0.0, send=0.3)
    # 'swell' is the pad's own fade-in

# ───────────────────────────────────────────── reverb, master
def ir(rt, seed):
    r = np.random.default_rng(seed); n = int(SR * rt * 1.4); t = np.arange(n) / SR
    h = r.standard_normal(n) * np.exp(-t / (rt / 6.9))
    h = np.convolve(h, np.ones(28) / 28, mode='same')
    pre = int(0.014 * SR); h[:pre] = 0
    k = int(0.02 * SR); h[pre:pre + k] *= np.linspace(0, 1, k)
    return h / np.sqrt(np.sum(h ** 2))


def fftconv(x, h):
    n = 1 << int(np.ceil(np.log2(len(x) + len(h))))
    return np.fft.irfft(np.fft.rfft(x, n) * np.fft.rfft(h, n), n)[:len(x)]


L += fftconv(WL, ir(1.5, 3)) * 0.8
R += fftconv(WR, ir(1.5, 4)) * 0.8
# gentle high-pass below ~35 Hz
for ch in (L, R):
    a = math.exp(-2 * math.pi * 35 / SR); prev_x = prev_y = 0.0
    out = np.empty_like(ch)
    for i in range(len(ch)):
        y = a * (prev_y + ch[i] - prev_x); prev_x = ch[i]; prev_y = y; out[i] = y
    ch[:] = out
fade_in = np.minimum(1.0, np.arange(N) / (0.05 * SR))
fade_out = np.clip((DUR - np.arange(N) / SR) / 1.2, 0, 1) ** 1.5
L *= fade_in * fade_out; R *= fade_in * fade_out
peak = max(np.abs(L).max(), np.abs(R).max())
gain = float(os.environ.get('AUDIO_GAIN', '0')) or (0.5 / peak)
L *= gain; R *= gain
L = np.tanh(L * 1.25) / np.tanh(1.25); R = np.tanh(R * 1.25) / np.tanh(1.25)     # soft ceiling
pk = max(np.abs(L).max(), np.abs(R).max())
if pk > 0.89:
    L *= 0.89 / pk; R *= 0.89 / pk
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'out', 'soundtrack.wav')
pcm = (np.stack([L, R], 1) * 32767).astype('<i2')
with wave.open(out, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('wrote', out, f'{DUR:.1f}s  peak {20 * math.log10(max(np.abs(L).max(), np.abs(R).max())):.1f} dBFS  gain {gain:.2f}')
