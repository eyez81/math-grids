import type { Point } from "./geometry";

const length = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

const distanceToLine = (point: Point, a: Point, b: Point) => {
  const dx = b.x - a.x, dy = b.y - a.y;
  const size = Math.hypot(dx, dy);
  return size ? Math.abs(dx * (point.y - a.y) - dy * (point.x - a.x)) / size : length(point, a);
};

const fitParabola = (points: Point[]): Point[] | null => {
  const first = points[0], last = points[points.length - 1];
  const span = Math.abs(last.x - first.x);
  if (span < 100) return null;
  const direction = Math.sign(last.x - first.x);
  let backwards = 0;
  for (let i = 1; i < points.length; i += 1)
    backwards += Math.max(0, -direction * (points[i].x - points[i - 1].x));
  if (backwards > span * 0.12) return null;
  const center = (first.x + last.x) / 2, half = span / 2;
  const sums = Array(5).fill(0) as number[];
  let sy = 0, sty = 0, st2y = 0, minY = Infinity, maxY = -Infinity;
  for (const point of points) {
    const t = (point.x - center) / half;
    let power = 1;
    for (let j = 0; j < 5; j += 1) { sums[j] += power; power *= t; }
    sy += point.y; sty += t * point.y; st2y += t * t * point.y;
    minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y);
  }
  const m = [[sums[0], sums[1], sums[2], sy], [sums[1], sums[2], sums[3], sty], [sums[2], sums[3], sums[4], st2y]];
  for (let col = 0; col < 3; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < 3; row += 1) if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row;
    [m[col], m[pivot]] = [m[pivot], m[col]];
    if (Math.abs(m[col][col]) < 1e-8) return null;
    const divisor = m[col][col];
    for (let j = col; j < 4; j += 1) m[col][j] /= divisor;
    for (let row = 0; row < 3; row += 1) if (row !== col) {
      const factor = m[row][col];
      for (let j = col; j < 4; j += 1) m[row][j] -= factor * m[col][j];
    }
  }
  const [c, b, a] = m.map((row) => row[3]);
  const vertex = -b / (2 * a);
  if (Math.abs(a) < 12 || Math.abs(vertex) > 0.9 || maxY - minY < 35) return null;
  const evaluate = (x: number) => { const t = (x - center) / half; return a * t * t + b * t + c; };
  let errors = 0, maximum = 0;
  for (const point of points) {
    const error = Math.abs(evaluate(point.x) - point.y);
    errors += error * error; maximum = Math.max(maximum, error);
  }
  const height = maxY - minY;
  if (Math.sqrt(errors / points.length) > Math.max(12, Math.min(35, height * 0.11)) || maximum > Math.max(25, height * 0.18)) return null;
  const count = Math.ceil(span / 4);
  return Array.from({ length: count + 1 }, (_, i) => {
    const x = first.x + (last.x - first.x) * i / count;
    return { x, y: evaluate(x) };
  });
};

const simplify = (points: Point[], tolerance: number): Point[] => {
  if (points.length < 3) return points;
  let farthest = 0, index = 0;
  for (let i = 1; i < points.length - 1; i += 1) {
    const deviation = distanceToLine(points[i], points[0], points[points.length - 1]);
    if (deviation > farthest) { farthest = deviation; index = i; }
  }
  if (farthest <= tolerance) return [points[0], points[points.length - 1]];
  return [...simplify(points.slice(0, index + 1), tolerance).slice(0, -1), ...simplify(points.slice(index), tolerance)];
};

/** Refine a pointer stroke in screen pixels, before converting it to graph coordinates. */
export const beautifySketch = (raw: Point[]): Point[] => {
  if (raw.length < 3) return raw;
  let spaced: Point[] = [raw[0]];
  // Uniform spacing makes the result independent of the mouse event rate.
  for (let i = 1; i < raw.length; i += 1) {
    const a = raw[i - 1], b = raw[i], steps = Math.ceil(length(a, b) / 4);
    for (let j = 1; j <= steps; j += 1)
      spaced.push({ x: a.x + (b.x - a.x) * j / steps, y: a.y + (b.y - a.y) * j / steps });
  }
  if (spaced.length > 4000) {
    const stride = Math.ceil(spaced.length / 4000);
    spaced = spaced.filter((_, i) => i % stride === 0 || i === spaced.length - 1);
  }
  const start = spaced[0], end = spaced[spaced.length - 1];
  if (length(start, end) > 40) {
    const deviations = spaced.map((point) => distanceToLine(point, start, end));
    const rms = Math.hypot(...deviations) / Math.sqrt(deviations.length);
    if (rms < 8 && Math.max(...deviations) < 22) return [start, end];
  }
  const parabola = fitParabola(spaced);
  if (parabola) return parabola;

  // Smooth movements over roughly 15px, retaining both ends of the stroke.
  const radius = 5;
  const filtered = spaced.map((point, i) => {
    if (i === 0 || i === spaced.length - 1) return point;
    let x = 0, y = 0, total = 0;
    for (let offset = -radius; offset <= radius; offset += 1) {
      const sample = spaced[Math.max(0, Math.min(spaced.length - 1, i + offset))];
      const weight = Math.exp(-offset * offset / 8);
      x += sample.x * weight; y += sample.y * weight; total += weight;
    }
    return { x: x / total, y: y / total };
  });
  const anchors = simplify(filtered, 7);
  if (anchors.length < 3) return anchors;

  // Catmull–Rom interpolation rounds the joins between meaningful bends.
  const result: Point[] = [anchors[0]];
  for (let i = 0; i < anchors.length - 1; i += 1) {
    const p0 = anchors[Math.max(0, i - 1)], p1 = anchors[i];
    const p2 = anchors[i + 1], p3 = anchors[Math.min(anchors.length - 1, i + 2)];
    const steps = Math.max(1, Math.ceil(length(p1, p2) / 4));
    for (let k = 1; k <= steps; k += 1) {
      const t = k / steps, t2 = t * t, t3 = t2 * t;
      const coordinate = (a: number, b: number, c: number, d: number) =>
        0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      result.push({ x: coordinate(p0.x, p1.x, p2.x, p3.x), y: coordinate(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  return result;
};
