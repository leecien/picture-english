#!/usr/bin/env python3
"""英語小旅人 AudioPractice：預錄素材響度量測與正規化。

用法（在專案根目錄或任何位置執行皆可）：
  python3 loudness.py measure  --root <專案根目錄> --out report-before.json
  python3 loudness.py normalize --root <專案根目錄> --dest <輸出資料夾> [--target -18] [--ceiling -1.5]
  python3 loudness.py measure  --root <輸出資料夾> --prefix "" --out report-after.json
  python3 loudness.py compare  report-before.json report-after.json --md loudness-report.md

只讀取 <root>/assets/voice/**.mp3，不改來源檔。輸出保持原資料夾結構（words/、sentences/、zh/...）。
需要 ffmpeg / ffprobe 與 numpy。

量測項目（每個檔案）：
  lufs      ITU-R BS.1770 整合響度（ffmpeg ebur128）。少於 0.4 秒的音檔量不出來，會標 unreliable。
  tp        真峰值 dBTP（ffmpeg ebur128 peak=true）
  peak      樣本峰值 dBFS
  rms       全檔 RMS dBFS
  speech_rms 只計有聲段（20 ms 框，比最大框低 30 dB 以內）的 RMS dBFS：短字的音量比較值
  dur       秒數；lead / tail 為開頭、結尾靜音秒數
正規化：
  以 lufs（可靠時）或 speech_rms＋類別偏移（不可靠時）估出增益，使檔案達到 target LUFS；
  整檔線性增益；若增益後真峰值會超過 ceiling，只對最高的峰值做短時限制（最多 --max-limit dB，超過就少加一點音量），
  被限制的檔案與限制量列在 normalize-plan.json。不做壓縮、不裁切頭尾。
"""
import argparse, json, math, os, re, subprocess, sys
import numpy as np

SR = 24000


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=False)


def decode(path):
    p = run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"])
    if p.returncode:
        raise RuntimeError(p.stderr.decode(errors="ignore"))
    return np.frombuffer(p.stdout, dtype=np.float32)


def ebur128(path):
    p = run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af", "ebur128=peak=true", "-f", "null", "-"])
    t = p.stderr.decode(errors="ignore")
    summ = t[t.rfind("Summary:"):]
    i = re.search(r"I:\s+(-?[\d.]+|-inf|nan)\s+LUFS", summ)
    tp = re.search(r"Peak:\s+(-?[\d.]+|-inf)\s+dBFS", summ)
    f = lambda m: float(m.group(1)) if m and m.group(1) not in ("-inf", "nan") else None
    return f(i), f(tp)


def db(x):
    return 20 * math.log10(x) if x > 0 else -120.0


def analyse(path):
    x = decode(path)
    dur = len(x) / SR
    lufs, tp = ebur128(path)
    peak = float(np.max(np.abs(x))) if len(x) else 0.0
    rms = float(np.sqrt(np.mean(x.astype(np.float64) ** 2))) if len(x) else 0.0
    n = int(0.02 * SR)
    frames = x[: len(x) // n * n].reshape(-1, n) if len(x) >= n else x.reshape(1, -1)
    fr = np.sqrt(np.mean(frames.astype(np.float64) ** 2, axis=1))
    top = fr.max() if len(fr) else 0
    act = fr > top * (10 ** (-30 / 20)) if top > 0 else np.zeros_like(fr, bool)
    speech = float(np.sqrt(np.mean(fr[act] ** 2))) if act.any() else 0.0
    idx = np.where(fr > top * (10 ** (-40 / 20)))[0] if top > 0 else []
    lead = float(idx[0] * n / SR) if len(idx) else dur
    tail = float(dur - (idx[-1] + 1) * n / SR) if len(idx) else 0.0
    unreliable = lufs is None or dur < 0.4 or lufs < -70
    return dict(dur=round(dur, 3), lufs=lufs, tp=tp, peak=round(db(peak), 2), rms=round(db(rms), 2),
                speech_rms=round(db(speech), 2), lead=round(lead, 3), tail=round(max(0, tail), 3),
                lufs_unreliable=unreliable)


def category(rel):
    parts = rel.split("/")
    if parts[0] == "zh":
        return "zh/" + (parts[1] if len(parts) > 2 else "?")
    return "en/" + parts[0]


def files(root, prefix):
    base = os.path.join(root, prefix) if prefix else root
    out = []
    for d, _, fs in os.walk(base):
        for f in sorted(fs):
            if f.lower().endswith(".mp3"):
                full = os.path.join(d, f)
                out.append((os.path.relpath(full, base).replace(os.sep, "/"), full))
    return sorted(out)


def stats(vals):
    v = [x for x in vals if x is not None]
    if not v:
        return {}
    a = np.array(v)
    return dict(n=len(v), mean=round(float(a.mean()), 2), min=round(float(a.min()), 2), max=round(float(a.max()), 2),
                spread=round(float(a.max() - a.min()), 2), sd=round(float(a.std()), 2))


def summarise(rows):
    cats = {}
    for r in rows:
        cats.setdefault(r["cat"], []).append(r)
    summ = {}
    for c, rs in sorted(cats.items()):
        summ[c] = dict(lufs=stats([r["lufs"] for r in rs if not r["lufs_unreliable"]]),
                       speech_rms=stats([r["speech_rms"] for r in rs]), tp=stats([r["tp"] for r in rs]),
                       unreliable=sum(r["lufs_unreliable"] for r in rs), files=len(rs))
    allr = rows
    summ["ALL"] = dict(lufs=stats([r["lufs"] for r in allr if not r["lufs_unreliable"]]),
                       speech_rms=stats([r["speech_rms"] for r in allr]), tp=stats([r["tp"] for r in allr]),
                       unreliable=sum(r["lufs_unreliable"] for r in allr), files=len(allr))
    return summ


def cmd_measure(a):
    rows = []
    for rel, full in files(a.root, a.prefix):
        r = analyse(full)
        r.update(file=rel, cat=category(rel))
        rows.append(r)
    out = dict(root=os.path.abspath(a.root), rows=rows, summary=summarise(rows))
    with open(a.out, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, indent=1)
    print(json.dumps(out["summary"], ensure_ascii=False, indent=1))


def cmd_normalize(a):
    src = files(a.root, a.prefix)
    rows = []
    for rel, full in src:
        rows.append(dict(analyse(full), file=rel, cat=category(rel), full=full))
    # Per-category offset LUFS - speech_rms (from reliable files) estimates LUFS for very short clips.
    off = {}
    for c in set(r["cat"] for r in rows):
        d = [r["lufs"] - r["speech_rms"] for r in rows if r["cat"] == c and not r["lufs_unreliable"]]
        off[c] = float(np.median(d)) if d else -3.0
    plan = []
    for r in rows:
        est = r["lufs"] if not r["lufs_unreliable"] else r["speech_rms"] + off[r["cat"]]
        gain = a.target - est
        headroom = a.ceiling - (r["tp"] if r["tp"] is not None else r["peak"])
        over = gain - headroom  # dB of peak that would exceed the ceiling
        g = gain
        if over > a.max_limit:  # never squash more than max_limit dB: give up some loudness instead
            g = headroom + a.max_limit
        limited = g > headroom
        # Peak limiter only touches the few highest peaks (2 ms attack, 50 ms release); a 1 dB margin below
        # the ceiling covers inter-sample peaks the sample-peak limiter cannot see, and mp3 overshoot.
        lim = f",alimiter=limit={10 ** ((a.ceiling - 1.0) / 20):.4f}:attack=2:release=50:level=disabled" if limited else ""
        dst = os.path.join(a.dest, r["file"])
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        def encode(gain_db):
            p = run(["ffmpeg", "-v", "error", "-y", "-i", r["full"], "-af", f"aresample=96000,volume={gain_db:.2f}dB{lim},aresample={SR}",
                     "-ar", str(SR), "-ac", "1", "-c:a", "libmp3lame", "-b:a", "64k", "-map_metadata", "-1", dst])
            if p.returncode:
                raise RuntimeError(p.stderr.decode(errors="ignore"))
        encode(g)
        # Second pass: the limiter and mp3 encoding shift loudness a little; correct once (never past the limiter cap).
        got, _ = ebur128(dst)
        if got is not None and abs(a.target - got) > 0.2 and not (limited and g < gain):
            g = g + (a.target - got)
            if not limited:
                g = min(g, headroom)  # stay under the ceiling without switching the limiter on
            encode(g)
        plan.append(dict(file=r["file"], cat=r["cat"], est_lufs=round(est, 2), estimated=r["lufs_unreliable"],
                         gain_db=round(g, 2), wanted_db=round(gain, 2), peak_limited=limited,
                         limiter_db=round(max(0.0, g - headroom), 2)))
    cfg = dict(target_lufs=a.target, ceiling_dbtp=a.ceiling, max_limiter_db=a.max_limit, codec="mp3 libmp3lame 64k mono 24 kHz", short_clip_offset=off, files=plan)
    with open(os.path.join(a.dest, "normalize-plan.json"), "w", encoding="utf-8") as fh:
        json.dump(cfg, fh, ensure_ascii=False, indent=1)
    print(f"wrote {len(plan)} files to {a.dest}; peak-limited: {sum(p['peak_limited'] for p in plan)}")


def fmt(s, k):
    return f"{s[k]:.1f}" if s and k in s else "–"


def cmd_compare(a):
    b = json.load(open(a.before, encoding="utf-8"))
    f = json.load(open(a.after, encoding="utf-8"))
    L = ["| 類別 | 檔數 | LUFS 平均（前→後） | LUFS 最小～最大（前） | LUFS 最小～最大（後） | 差距 LU（前→後） | 有聲 RMS 差距 dB（前→後） | 真峰值最大 dBTP（前→後） |",
         "|---|---|---|---|---|---|---|---|"]
    for c in b["summary"]:
        sb, sa = b["summary"][c], f["summary"].get(c, {})
        L.append(f"| {c} | {sb['files']} | {fmt(sb['lufs'],'mean')} → {fmt(sa.get('lufs'),'mean')} | {fmt(sb['lufs'],'min')}～{fmt(sb['lufs'],'max')} | "
                 f"{fmt(sa.get('lufs'),'min')}～{fmt(sa.get('lufs'),'max')} | {fmt(sb['lufs'],'spread')} → {fmt(sa.get('lufs'),'spread')} | "
                 f"{fmt(sb['speech_rms'],'spread')} → {fmt(sa.get('speech_rms'),'spread')} | {fmt(sb['tp'],'max')} → {fmt(sa.get('tp'),'max')} |")
    text = "\n".join(L)
    if a.md:
        open(a.md, "w", encoding="utf-8").write(text + "\n")
    print(text)


def main():
    ap = argparse.ArgumentParser()
    sp = ap.add_subparsers(dest="cmd", required=True)
    m = sp.add_parser("measure"); m.add_argument("--root", required=True); m.add_argument("--prefix", default="assets/voice"); m.add_argument("--out", required=True)
    n = sp.add_parser("normalize"); n.add_argument("--root", required=True); n.add_argument("--prefix", default="assets/voice"); n.add_argument("--dest", required=True)
    n.add_argument("--target", type=float, default=-18.0); n.add_argument("--ceiling", type=float, default=-1.5); n.add_argument("--max-limit", type=float, default=4.0)
    c = sp.add_parser("compare"); c.add_argument("before"); c.add_argument("after"); c.add_argument("--md")
    a = ap.parse_args()
    {"measure": cmd_measure, "normalize": cmd_normalize, "compare": cmd_compare}[a.cmd](a)


if __name__ == "__main__":
    main()
