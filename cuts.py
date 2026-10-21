"""Silence detection (auto-cuts) and time re-mapping after cuts."""
import bisect
import re
import subprocess


def detect_silences(ffmpeg, path, duration, noise_db=-30.0, min_silence=0.5):
    cmd = [ffmpeg, "-hide_banner", "-nostats", "-i", str(path), "-vn", "-af",
           f"silencedetect=noise={noise_db}dB:d={min_silence}", "-f", "null", "-"]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError("Could not analyse the audio of this video.")
    out, start = [], None
    for line in r.stderr.splitlines():
        m = re.search(r"silence_start:\s*(-?[\d.]+)", line)
        if m:
            start = max(0.0, float(m.group(1)))
            continue
        m = re.search(r"silence_end:\s*([\d.]+)", line)
        if m and start is not None:
            out.append((start, float(m.group(1))))
            start = None
    if start is not None:           # silence runs to the end
        out.append((start, duration))
    return out


def plan_cuts(silences, duration, pad=0.12, min_cut=0.3, max_cuts=140):
    """Turn silent gaps into regions to REMOVE, keeping `pad` seconds of breathing room each side."""
    cuts = []
    for s, e in silences:
        a, b = s + pad, e - pad
        if s <= 0.01:               # silence at the very start: trim all but a tiny lead-in
            a = 0.0
            b = e - min(pad, 0.1)
        if e >= duration - 0.05:    # silence at the very end
            b = duration
            a = s + min(pad, 0.1)
        a, b = max(0.0, a), min(duration, b)
        if b - a >= min_cut:
            cuts.append([round(a, 3), round(b, 3)])
    if len(cuts) > max_cuts:        # keep the longest gaps only (keeps the ffmpeg command small)
        cuts = sorted(sorted(cuts, key=lambda c: c[1] - c[0], reverse=True)[:max_cuts])
    return cuts


def keep_segments(cuts, duration):
    cuts = sorted([min(c[0], c[1]), max(c[0], c[1])] for c in cuts)
    keep, pos = [], 0.0
    for a, b in cuts:
        a, b = max(0.0, a), min(duration, b)
        if a > pos + 0.02:
            keep.append([pos, a])
        pos = max(pos, b)
    if duration - pos > 0.02:
        keep.append([pos, duration])
    return keep


class Remap:
    """Maps a time on the ORIGINAL video to the time on the CUT video."""
    def __init__(self, keep):
        self.keep = keep
        self.starts = [k[0] for k in keep]
        self.offsets, tot = [], 0.0
        for a, b in keep:
            self.offsets.append(tot)
            tot += b - a
        self.total = tot

    def __call__(self, t):
        if not self.keep:
            return t
        i = bisect.bisect_right(self.starts, t) - 1
        if i < 0:
            return 0.0
        a, b = self.keep[i]
        if t <= b:
            return self.offsets[i] + (t - a)
        return self.offsets[i] + (b - a)     # t is inside a removed gap -> end of this segment


def remap_captions(captions, remap):
    out = []
    for c in captions:
        words = []
        for w in c["words"]:
            s, e = remap(w["s"]), remap(w["e"])
            if e - s >= 0.04:
                words.append({**w, "s": s, "e": e})
        if words:
            out.append({"start": words[0]["s"], "end": max(remap(c["end"]), words[-1]["e"]), "words": words})
    return out
