#!/usr/bin/env python3
"""Mix the voice-over over the music: the music ducks under the voice, then the whole thing is set to a social-video loudness.

    python3 mix.py [af_heart]            needs out/soundtrack.wav (audio.py) and out/voice_<VOICE>.npy (voice.py); FFMPEG=/path/to/ffmpeg
    -> out/mix_<VOICE>.wav

The music dips about 12 dB a moment before she speaks and comes back slowly after, so every word is clear and the beat is still there
between phrases. Final loudness about -14.5 LUFS integrated with the peak under -1.5 dBFS (measured with ffmpeg's ebur128).
"""
import math
import os
import re
import subprocess
import sys
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')
SR = 48000
VOICE = sys.argv[1] if len(sys.argv) > 1 else os.environ.get('VOICE', 'af_heart')
FFMPEG = os.environ.get('FFMPEG', 'ffmpeg')
TARGET_LUFS = float(os.environ.get('TARGET_LUFS', '-14.5'))
DEPTH = 0.75               # how far the music dips under her (1 - 0.75 = -12 dB)
MUSIC = 0.85               # and the whole music bed a little lower than in the music-only version


def read_wav(p):
    w = wave.open(p)
    x = np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').reshape(-1, w.getnchannels()).astype(np.float64) / 32768
    assert w.getframerate() == SR
    return x


def write_wav(p, x):
    with wave.open(p, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(x, -1, 1) * 32767).astype('<i2').tobytes())


def loudness(p):
    r = subprocess.run([FFMPEG, '-hide_banner', '-nostats', '-i', p, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    tail = r[r.rindex('Integrated loudness'):]
    return float(re.search(r'I:\s*(-?[\d.]+) LUFS', tail).group(1)), float(re.search(r'Peak:\s*(-?[\d.]+) dBFS', tail).group(1))


def duck_curve(voice, pre=0.10, post=0.30):
    hop = int(0.01 * SR); n = len(voice) // hop
    rms = np.sqrt(np.add.reduceat(voice[:n * hop] ** 2, np.arange(0, n * hop, hop)) / hop)
    act = (rms > 10 ** (-50 / 20)).astype(float)
    npre, npost = int(pre / 0.01), int(post / 0.01)
    c = np.convolve(act, np.ones(npre + npost + 1))
    d = (c[npre:npre + n] > 0).astype(float)                               # any speech from `post` before to `pre` after this frame
    d = np.convolve(np.pad(d, 3, mode='edge'), np.ones(7) / 7, mode='valid')   # soft edges (70 ms)
    return np.interp(np.arange(len(voice)), (np.arange(n) + 0.5) * hop, d)


def main():
    music = read_wav(os.path.join(OUT, 'soundtrack.wav'))
    voice = np.load(os.path.join(OUT, f'voice_{VOICE}.npy')).astype(np.float64)
    n = min(len(music), len(voice))
    music, voice = music[:n], voice[:n]
    g = 1 - DEPTH * duck_curve(voice)
    mix = music * g[:, None] * MUSIC + voice[:, None] * 1.0
    tmp = os.path.join(OUT, f'mix_{VOICE}_pre.wav')
    write_wav(tmp, mix * 0.5)
    lufs, _ = loudness(tmp)
    gain = 10 ** ((TARGET_LUFS - lufs) / 20) * 0.5
    mix *= gain
    for _ in range(2):                                                     # soft ceiling, then re-measure
        pk = np.abs(mix).max()
        mix = np.tanh(mix * 1.15) / math.tanh(1.15) if pk > 0.80 else mix
        pk = np.abs(mix).max()
        if pk > 0.84:
            mix *= 0.84 / pk
        write_wav(os.path.join(OUT, f'mix_{VOICE}.wav'), mix)
        lufs2, tp = loudness(os.path.join(OUT, f'mix_{VOICE}.wav'))
        if lufs2 > TARGET_LUFS + 0.4 or lufs2 < TARGET_LUFS - 0.4:
            mix *= 10 ** ((TARGET_LUFS - lufs2) / 20)
        else:
            break
    os.remove(tmp)
    print(f'wrote out/mix_{VOICE}.wav  {len(mix) / SR:.1f}s  integrated {lufs2:.1f} LUFS  true peak {tp:.1f} dBFS')


if __name__ == '__main__':
    main()
