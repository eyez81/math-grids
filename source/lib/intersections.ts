import { distance, inFunctionDomain } from "./geometry";
import type { Point, PointObject, MathObject, SegmentObject, FunctionObject, CircleObject, PolygonObject } from "./geometry";

const lineIntersection = (
  a: Point,
  b: Point,
  c: Point,
  d: Point,
): Point | null => {
  const den = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x);
  if (Math.abs(den) < 1e-10) return null;
  const cross1 = a.x * b.y - a.y * b.x,
    cross2 = c.x * d.y - c.y * d.x;
  return {
    x: (cross1 * (c.x - d.x) - (a.x - b.x) * cross2) / den,
    y: (cross1 * (c.y - d.y) - (a.y - b.y) * cross2) / den,
  };
};
const lineCircleIntersections = (
  a: Point,
  b: Point,
  center: Point,
  r: number,
) => {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    fx = a.x - center.x,
    fy = a.y - center.y;
  const A = dx * dx + dy * dy,
    B = 2 * (fx * dx + fy * dy),
    C = fx * fx + fy * fy - r * r,
    disc = B * B - 4 * A * C;
  if (A < 1e-12 || disc < -1e-10) return [] as Point[];
  const root = Math.sqrt(Math.max(0, disc));
  return [(-B - root) / (2 * A), (-B + root) / (2 * A)]
    .filter((t, i, x) => i === 0 || Math.abs(t - x[0]) > 1e-8)
    .map((t) => ({ x: a.x + t * dx, y: a.y + t * dy }));
};
const circleCircleIntersections = (
  c0: Point,
  r0: number,
  c1: Point,
  r1: number,
) => {
  const d = distance(c0, c1);
  if (d < 1e-10 || d > r0 + r1 + 1e-9 || d < Math.abs(r0 - r1) - 1e-9)
    return [] as Point[];
  const a = (r0 * r0 - r1 * r1 + d * d) / (2 * d),
    h = Math.sqrt(Math.max(0, r0 * r0 - a * a)),
    x2 = c0.x + (a * (c1.x - c0.x)) / d,
    y2 = c0.y + (a * (c1.y - c0.y)) / d;
  const rx = (-(c1.y - c0.y) * h) / d,
    ry = ((c1.x - c0.x) * h) / d;
  return h < 1e-9
    ? [{ x: x2, y: y2 }]
    : [
        { x: x2 + rx, y: y2 + ry },
        { x: x2 - rx, y: y2 - ry },
      ];
};

type IntersectionContext = {
  centerX: number;
  pointById: (id?: string) => PointObject | undefined;
  segmentPoints: (object: SegmentObject) => { a: Point; b: Point };
  circleData: (object: CircleObject) => { center: Point; r: number };
  polygonPoints: (object: PolygonObject) => PointObject[];
  expressionEvaluator: (expression: string) => { evaluate: (x: number) => number };
};

export function findIntersections(first: MathObject, second: MathObject, context: IntersectionContext): Point[] {
  const { centerX, pointById, segmentPoints, circleData, polygonPoints, expressionEvaluator } = context;
    let points: Point[] = [];
    const isLine = (o: MathObject): o is SegmentObject =>
      o.type === "line" || o.type === "segment";
    const onObject = (point: Point, object: SegmentObject) => {
      if (object.type === "line") return true;
      const ends = segmentPoints(object);
      return (
        point.x >= Math.min(ends.a.x, ends.b.x) - 1e-7 &&
        point.x <= Math.max(ends.a.x, ends.b.x) + 1e-7 &&
        point.y >= Math.min(ends.a.y, ends.b.y) - 1e-7 &&
        point.y <= Math.max(ends.a.y, ends.b.y) + 1e-7
      );
    };
    const boundaryParts = (object: MathObject): MathObject[] => {
      if (object.type === "polygon") {
        const points = polygonPoints(object);
        return points.map((point, index) => {
          const next = points[(index + 1) % points.length];
          return {
            id: `${object.id}-edge-${index}`,
            type: "segment",
            name: `${point.name}${next.name}`,
            a: point,
            b: next,
            aId: point.id,
            bId: next.id,
            color: object.color,
            showLength: false,
            showSlope: false,
            showLabel: false,
            strokeWidth: object.strokeWidth,
            strokeStyle: object.strokeStyle,
          } satisfies SegmentObject;
        });
      }
      if (object.type === "angle") {
        const a = pointById(object.aId),
          vertex = pointById(object.vertexId),
          c = pointById(object.cId);
        if (!a || !vertex || !c) return [];
        return [
          {
            id: `${object.id}-ray-a`,
            type: "segment",
            name: `${vertex.name}${a.name}`,
            a: vertex,
            b: a,
            aId: vertex.id,
            bId: a.id,
            color: object.color,
            showLength: false,
            showSlope: false,
            showLabel: false,
            strokeWidth: object.strokeWidth,
            strokeStyle: object.strokeStyle,
          } satisfies SegmentObject,
          {
            id: `${object.id}-ray-c`,
            type: "segment",
            name: `${vertex.name}${c.name}`,
            a: vertex,
            b: c,
            aId: vertex.id,
            bId: c.id,
            color: object.color,
            showLength: false,
            showSlope: false,
            showLabel: false,
            strokeWidth: object.strokeWidth,
            strokeStyle: object.strokeStyle,
          } satisfies SegmentObject,
        ];
      }
      return [object];
    };
    const functionRange = (fn: FunctionObject) => ({
      min: fn.domainMin ?? centerX - 20,
      max: fn.domainMax ?? centerX + 20,
    });
    const rootsOf = (
      evaluate: (x: number) => number,
      min: number,
      max: number,
    ) => {
      const roots: number[] = [];
      if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) return roots;
      if (Number.isFinite(evaluate(min)) && Math.abs(evaluate(min)) < 1e-8) roots.push(min);
      const span = Math.max(0.001, max - min);
      const step = Math.max(0.002, span / 1600);
      let previousX = min,
        previousValue = evaluate(min),
        beforePreviousValue = previousValue,
        beforePreviousX = previousX;
      for (let x = min + step; x <= max + step / 2; x += step) {
        const currentX = Math.min(x, max),
          value = evaluate(currentX);
        if (Number.isFinite(value) && Math.abs(value) < 1e-6)
          roots.push(currentX);
        if (
          Number.isFinite(value) &&
          Number.isFinite(previousValue) &&
          value * previousValue < 0
        ) {
          let lo = previousX,
            hi = currentX,
            loValue = previousValue;
          for (let iteration = 0; iteration < 40; iteration++) {
            const middle = (lo + hi) / 2,
              middleValue = evaluate(middle);
            if (!Number.isFinite(middleValue)) break;
            if (loValue * middleValue <= 0) hi = middle;
            else {
              lo = middle;
              loValue = middleValue;
            }
          }
          const root = (lo + hi) / 2;
          if (Math.abs(evaluate(root)) < 1e-4) roots.push(root);
        }
        if (
          Number.isFinite(beforePreviousValue) &&
          Number.isFinite(previousValue) &&
          Number.isFinite(value) &&
          Math.abs(previousValue) <= Math.abs(beforePreviousValue) &&
          Math.abs(previousValue) <= Math.abs(value)
        ) {
          let lo = beforePreviousX,
            hi = currentX;
          for (let iteration = 0; iteration < 36; iteration++) {
            const left = lo + (hi - lo) / 3,
              right = hi - (hi - lo) / 3;
            if (Math.abs(evaluate(left)) <= Math.abs(evaluate(right))) hi = right;
            else lo = left;
          }
          const candidate = (lo + hi) / 2;
          if (Math.abs(evaluate(candidate)) < 1e-5) roots.push(candidate);
        }
        beforePreviousX = previousX;
        beforePreviousValue = previousValue;
        previousX = currentX;
        previousValue = value;
      }
      return roots.filter(
        (root, index) =>
          roots.findIndex((candidate) => Math.abs(candidate - root) < 0.002) ===
          index,
      );
    };
    if (
      first.type === "polygon" ||
      second.type === "polygon" ||
      first.type === "angle" ||
      second.type === "angle"
    ) {
      const firstParts = boundaryParts(first),
        secondParts = boundaryParts(second);
      points = firstParts.flatMap((a) =>
        secondParts.flatMap((b) => findIntersections(a, b, context)),
      );
    } else if (isLine(first) && isLine(second)) {
      const a = segmentPoints(first),
        b = segmentPoints(second),
        p = lineIntersection(a.a, a.b, b.a, b.b);
      if (p && onObject(p, first) && onObject(p, second)) points = [p];
    } else if (
      (isLine(first) && second.type === "circle") ||
      (first.type === "circle" && isLine(second))
    ) {
      const line = isLine(first) ? first : (second as SegmentObject),
        circle = first.type === "circle" ? first : (second as CircleObject),
        l = segmentPoints(line),
        c = circleData(circle);
      points = lineCircleIntersections(l.a, l.b, c.center, c.r).filter(
        (point) => onObject(point, line),
      );
    } else if (first.type === "circle" && second.type === "circle") {
      const a = circleData(first),
        b = circleData(second);
      points = circleCircleIntersections(a.center, a.r, b.center, b.r);
    } else if (
      (isLine(first) && second.type === "function") ||
      (first.type === "function" && isLine(second))
    ) {
      try {
        const line = isLine(first) ? first : (second as SegmentObject),
          fn = first.type === "function" ? first : (second as FunctionObject),
          f = expressionEvaluator(fn.expression).evaluate,
          ends = segmentPoints(line),
          range = functionRange(fn);
        if (Math.abs(ends.a.x - ends.b.x) < 1e-10) {
          const x = ends.a.x,
            y = f(x),
            point = { x, y };
          if (
            x >= range.min &&
            x <= range.max &&
            Number.isFinite(y) &&
            onObject(point, line)
          )
            points = [point];
        } else {
          const m = (ends.b.y - ends.a.y) / (ends.b.x - ends.a.x),
            b = ends.a.y - m * ends.a.x;
          points = rootsOf((x) => f(x) - (m * x + b), range.min, range.max)
            .map((x) => ({ x, y: f(x) }))
            .filter((point) => onObject(point, line));
        }
      } catch {}
    } else if (
      (first.type === "circle" && second.type === "function") ||
      (first.type === "function" && second.type === "circle")
    ) {
      try {
        const circle =
            first.type === "circle" ? first : (second as CircleObject),
          fn = first.type === "function" ? first : (second as FunctionObject),
          f = expressionEvaluator(fn.expression).evaluate,
          data = circleData(circle),
          range = functionRange(fn);
        points = rootsOf(
          (x) =>
            (x - data.center.x) ** 2 +
            (f(x) - data.center.y) ** 2 -
            data.r ** 2,
          range.min,
          range.max,
        ).map((x) => ({ x, y: f(x) }));
      } catch {}
    } else if (first.type === "function" && second.type === "function") {
      try {
        const f = expressionEvaluator(first.expression).evaluate,
          g = expressionEvaluator(second.expression).evaluate,
          firstRange = functionRange(first),
          secondRange = functionRange(second),
          min = Math.max(firstRange.min, secondRange.min),
          max = Math.min(firstRange.max, secondRange.max);
        if (max >= min)
          points = rootsOf((x) => f(x) - g(x), min, max).map((x) => ({
            x,
            y: f(x),
          }));
      } catch {}
    }
    points = points.filter((point) => [first, second].every(
      (object) => object.type !== "function" || inFunctionDomain(point.x, object, 1e-8),
    ));
    points = points.filter(
      (point, index, all) =>
        all.findIndex((candidate) => distance(candidate, point) < 1e-5) === index,
    );
  return points;
}
