// FPS of a server's load samples (0 = unknown) as drawn and averaged: a
// single sample between two known neighbours takes the middle value of the
// three. RCON "stats" right after a map change reads low once (100, 31, 100);
// a drop that lasts two samples or more stays. Raw data is not changed.
export function steadyFps(fps: number[]): number[] {
  return fps.map((v, i) => {
    const a = fps[i - 1];
    const b = fps[i + 1];
    if (!(v > 0 && a > 0 && b > 0)) return v;
    return Math.max(Math.min(a, b), Math.min(Math.max(a, b), v));
  });
}
