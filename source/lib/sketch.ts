import type { Point } from "./geometry";

const length = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

const distanceToLine = (point: Point, a: Point, b: Point) => {
  const dx = b.x - a.x, dy = b.y - a.y;
  const size = Math.hypot(dx, dy);
  return size ? Math.abs(dx * (point.y - a.y) - dy * (point.x - a.x)) / size : length(point, a);
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
  if (length(start, end) > 30 && spaced.every((point) => distanceToLine(point, start, end) < 7))
    return [start, end];

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
