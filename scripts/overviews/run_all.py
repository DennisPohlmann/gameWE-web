"""Render every map of tmp/bsp/<game>/ into tmp/radar-out/<game>/ (PNG and
calibration JSON), with the .nav where there is one. Skips maps already done.
usage: python3 -I run_all.py <bsp-root> <out-root> [workers]"""
import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor

here = os.path.dirname(os.path.abspath(__file__))
src, out = sys.argv[1], sys.argv[2]
workers = int(sys.argv[3]) if len(sys.argv) > 3 else max(1, (os.cpu_count() or 2) // 2)
jobs = []
for game in sorted(os.listdir(src)):
    gdir = os.path.join(src, game)
    if not os.path.isdir(gdir) or game == "css":
        continue
    os.makedirs(os.path.join(out, game), exist_ok=True)
    for f in sorted(os.listdir(gdir)):
        if not f.endswith(".bsp"):
            continue
        m = f[:-4]
        png = os.path.join(out, game, m + ".png")
        if os.path.exists(png):
            continue
        nav = os.path.join(gdir, m + ".nav")
        jobs.append((game, m, os.path.join(gdir, f), nav if os.path.exists(nav) else "-", png, png[:-4] + ".json"))


def run(j):
    game, m, bsp, nav, png, js = j
    try:
        r = subprocess.run([sys.executable, "-I", os.path.join(here, "radar.py"), bsp, nav, png, js], capture_output=True, text=True, timeout=900)
        ok = r.returncode == 0
        msg = (r.stdout if ok else r.stderr).strip().splitlines()[-1:] or [""]
    except subprocess.TimeoutExpired:
        ok, msg = False, ["timeout"]
    line = f"{'ok  ' if ok else 'FAIL'} {game}/{m} {msg[0]}"
    print(line, flush=True)
    return ok


print(f"{len(jobs)} maps, {workers} workers", flush=True)
with ThreadPoolExecutor(workers) as ex:
    res = list(ex.map(run, jobs))
print(f"done: {sum(res)} ok, {len(res) - sum(res)} failed", flush=True)
