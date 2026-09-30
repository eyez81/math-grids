export type StrokeStyle = "solid" | "dashed" | "dotted";
export type Point = { x: number; y: number };
export type LabelOffsets = Record<string, Point>;

export type PointObject = {
  id: string;
  type: "point";
  name: string;
  x: number;
  y: number;
  color: string;
  hidden?: boolean;
  showName: boolean;
  showCoords: boolean;
  guides: boolean;
  labelOffsets?: LabelOffsets;
  dependency?:
    | { kind: "midpoint"; aId: string; bId: string }
    | { kind: "function"; functionId: string; x: number }
    | { kind: "onLine"; sourceId: string; t: number; aId?: string; bId?: string }
    | { kind: "onCircle"; sourceId: string; angle: number }
    | { kind: "onSketch"; sourceId: string; segment: number; t: number };
};

export type SegmentObject = {
  id: string;
  type: "segment" | "line";
  name: string;
  a: Point;
  b: Point;
  aId?: string;
  bId?: string;
  color: string;
  hidden?: boolean;
  showLength: boolean;
  showSlope: boolean;
  showLabel: boolean;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  labelOffsets?: LabelOffsets;
  construction?:
    | {
        kind: "parallel" | "perpendicular";
        sourceId?: string;
        sourceAId?: string;
        sourceBId?: string;
        throughId: string;
      }
    | {
        kind: "angleBisector";
        angleId?: string;
        aId?: string;
        vertexId?: string;
        cId?: string;
      }
    | {
        kind: "median";
        polygonId: string;
        vertexId: string;
      };
};

export type FunctionObject = {
  id: string;
  type: "function";
  name: string;
  expression: string;
  latex: string;
  functionKind: "linear" | "quadratic" | "general";
  color: string;
  hidden?: boolean;
  showEquation: boolean;
  showTable: boolean;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  labelOffsets?: LabelOffsets;
  domainMin?: number;
  domainMax?: number;
  minClosed: boolean;
  maxClosed: boolean;
};

export type SketchObject = {
  id: string;
  type: "sketch";
  name: string;
  points: Point[];
  color: string;
  hidden?: boolean;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  labelOffsets?: LabelOffsets;
};

export type AngleObject = {
  id: string;
  type: "angle";
  name: string;
  aId: string;
  vertexId: string;
  cId: string;
  color: string;
  hidden?: boolean;
  showMeasure: boolean;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  labelOffsets?: LabelOffsets;
};

export type PolygonObject = {
  id: string;
  type: "polygon";
  name: string;
  pointIds: string[];
  color: string;
  hidden?: boolean;
  fill: boolean;
  showLengths: boolean;
  showAngles: boolean;
  showPerimeter: boolean;
  showArea: boolean;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  labelOffsets?: LabelOffsets;
};

export type CircleObject = {
  id: string;
  type: "circle";
  name: string;
  centerId?: string;
  center: Point;
  throughId?: string;
  through?: Point;
  radius?: number;
  threePointIds?: [string, string, string];
  color: string;
  hidden?: boolean;
  fill: boolean;
  showCenter: boolean;
  showRadius: boolean;
  showDiameter: boolean;
  showCircumference: boolean;
  showArea: boolean;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  labelOffsets?: LabelOffsets;
};

export type SliderObject = {
  id: string;
  type: "slider";
  name: string;
  value: number;
  min: number;
  max: number;
  step: number;
  color: string;
  showOnCanvas?: boolean;
  hidden?: boolean;
  labelOffsets?: LabelOffsets;
};

export type TextObject = {
  id: string;
  type: "text";
  name: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  bold: boolean;
  color: string;
  hidden?: boolean;
  labelOffsets?: LabelOffsets;
};

export type MathObject =
  | PointObject
  | SegmentObject
  | FunctionObject
  | SketchObject
  | AngleObject
  | PolygonObject
  | CircleObject
  | SliderObject
  | TextObject;

export type Tool =
  | "select"
  | "pan"
  | "point"
  | "segment"
  | "line"
  | "angle"
  | "polygon"
  | "circle"
  | "circleRadius"
  | "circleThree"
  | "midpoint"
  | "parallel"
  | "perpendicular"
  | "perpendicularBisector"
  | "median"
  | "angleBisector"
  | "intersection"
  | "text"
  | "sketch";

export type Viewport = { centerX: number; centerY: number; scale: number };

export const COLORS = [
  "#0f766e",
  "#2563eb",
  "#dc2626",
  "#7c3aed",
  "#ea580c",
  "#111827",
  "#0891b2",
  "#16a34a",
  "#ca8a04",
  "#db2777",
  "#4f46e5",
  "#9333ea",
  "#65a30d",
  "#c2410c",
  "#475569",
  "#000000",
];

export const round = (n: number, digits = 2) => Number(n.toFixed(digits));
export const distance = (a: Point, b: Point) =>
  Math.hypot(b.x - a.x, b.y - a.y);
export const slope = (a: Point, b: Point) =>
  b.x === a.x ? Infinity : (b.y - a.y) / (b.x - a.x);
export const midpoint = (a: Point, b: Point): Point => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});
export const polygonArea = (points: Point[]) =>
  Math.abs(
    points.reduce((sum, p, i) => {
      const next = points[(i + 1) % points.length];
      return sum + p.x * next.y - next.x * p.y;
    }, 0),
  ) / 2;
export const polygonPerimeter = (points: Point[]) =>
  points.reduce(
    (sum, p, i) => sum + distance(p, points[(i + 1) % points.length]),
    0,
  );
export const angleDegrees = (a: Point, vertex: Point, c: Point) => {
  const first = Math.atan2(a.y - vertex.y, a.x - vertex.x);
  const second = Math.atan2(c.y - vertex.y, c.x - vertex.x);
  let value = Math.abs(((second - first) * 180) / Math.PI) % 360;
  if (value > 180) value = 360 - value;
  return value;
};
export const nextPointName = (objects: MathObject[]) => {
  const used = new Set(
    objects.filter((o) => o.type === "point").map((o) => o.name.toUpperCase()),
  );
  for (let index = 0; index < 26; index += 1) {
    const candidate = String.fromCharCode(65 + index);
    if (!used.has(candidate)) return candidate;
  }
  let suffix = 2;
  while (used.has(`A${suffix}`)) suffix += 1;
  return `A${suffix}`;
};
export const uid = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `obj-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const circumcircle = (a: Point, b: Point, c: Point) => {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < 1e-10) return null;
  const aa = a.x * a.x + a.y * a.y,
    bb = b.x * b.x + b.y * b.y,
    cc = c.x * c.x + c.y * c.y,
    center = {
      x: (aa * (b.y - c.y) + bb * (c.y - a.y) + cc * (a.y - b.y)) / d,
      y: (aa * (c.x - b.x) + bb * (a.x - c.x) + cc * (b.x - a.x)) / d,
    };
  return { center, r: distance(center, a) };
};

/** Interior angles, including reflex angles, for a simple polygon in either winding. */
export const polygonInteriorAngle = (points: Point[], index: number) => {
  if (points.length < 3) return NaN;
  const p = points[index], a = points[(index + points.length - 1) % points.length],
    b = points[(index + 1) % points.length];
  const winding = Math.sign(points.reduce((sum, point, i) => {
    const next = points[(i + 1) % points.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0));
  const turn = (p.x - a.x) * (b.y - p.y) - (p.y - a.y) * (b.x - p.x);
  const small = angleDegrees(a, p, b);
  return turn * winding < 0 ? 360 - small : small;
};

export const pointOnCircle = (center: Point, radius: number, angle: number): Point => ({
  x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle),
});

export const inFunctionDomain = (
  x: number,
  fn: Pick<FunctionObject, "domainMin" | "domainMax" | "minClosed" | "maxClosed">,
  tolerance = 0,
) => Number.isFinite(x)
  && (fn.domainMin === undefined || (fn.minClosed ? x >= fn.domainMin - tolerance : x > fn.domainMin + tolerance))
  && (fn.domainMax === undefined || (fn.maxClosed ? x <= fn.domainMax + tolerance : x < fn.domainMax - tolerance));
