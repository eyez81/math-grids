import { circumcircle, distance, midpoint, pointOnCircle } from "./geometry";
import type { MathObject, PointObject, SegmentObject, CircleObject, AngleObject, FunctionObject, SketchObject, Point } from "./geometry";

/** Resolve dependencies in mathematical coordinates, independently of the viewport. */
export function createGeometryResolver(
  objects: MathObject[],
  expressionEvaluator: (expression: string) => { evaluate: (x: number) => number },
) {
  const pointById = (id?: string, seen = new Set<string>()): PointObject | undefined => {
      if (!id || seen.has(id)) return;
      const raw = objects.find(
        (o): o is PointObject => o.type === "point" && o.id === id,
      );
      if (!raw) return;
      seen.add(id);
      if (raw.dependency?.kind === "midpoint") {
        const a = pointById(raw.dependency.aId, new Set(seen)),
          b = pointById(raw.dependency.bId, new Set(seen));
        if (a && b) return { ...raw, ...midpoint(a, b) };
      }
      if (raw.dependency?.kind === "function") {
        const dependency = raw.dependency;
        const fn = objects.find(
          (object): object is FunctionObject =>
            object.type === "function" &&
            object.id === dependency.functionId,
        );
        if (fn) {
          try {
            const x = dependency.x,
              y = expressionEvaluator(fn.expression).evaluate(x);
            if (Number.isFinite(y)) return { ...raw, x, y };
          } catch {}
        }
      }
      if (raw.dependency?.kind === "onLine") {
        const { sourceId, aId, bId, t } = raw.dependency;
        const source = objects.find((o) => o.id === sourceId);
        const ends = source && (source.type === "segment" || source.type === "line")
            ? segmentPoints(source)
            : aId && bId
              ? { a: pointById(aId, new Set(seen)), b: pointById(bId, new Set(seen)) }
            : null;
        if (ends?.a && ends?.b)
          return { ...raw, x: ends.a.x + t * (ends.b.x - ends.a.x), y: ends.a.y + t * (ends.b.y - ends.a.y) };
      }
      if (raw.dependency?.kind === "onCircle") {
        const dependency = raw.dependency;
        const source = objects.find((o): o is CircleObject => o.type === "circle" && o.id === dependency.sourceId);
        const data = source && circleData(source);
        if (data) return { ...raw, ...pointOnCircle(data.center, data.r, dependency.angle) };
      }
      if (raw.dependency?.kind === "onSketch") {
        const { sourceId, segment, t } = raw.dependency;
        const sketch = objects.find((o): o is SketchObject => o.type === "sketch" && o.id === sourceId);
        if (sketch?.points[segment + 1]) {
          const a = sketch.points[segment], b = sketch.points[segment + 1];
          return { ...raw, x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
        }
      }
      return raw;
    };
  const segmentPoints = (o: SegmentObject): { a: Point; b: Point } => {
      const construction = o.construction;
      if (
        construction?.kind === "parallel" ||
        construction?.kind === "perpendicular"
      ) {
        const sourceId = construction.sourceId,
          source = objects.find(
            (x): x is SegmentObject =>
              (x.type === "segment" || x.type === "line") && x.id === sourceId,
          ),
          sourceA = pointById(construction.sourceAId),
          sourceB = pointById(construction.sourceBId),
          through = pointById(construction.throughId);
        if ((source || (sourceA && sourceB)) && through) {
          const sourceEnds = source
              ? segmentPoints(source)
              : { a: sourceA!, b: sourceB! },
            dx = sourceEnds.b.x - sourceEnds.a.x,
            dy = sourceEnds.b.y - sourceEnds.a.y,
            vector =
              construction.kind === "parallel"
                ? { x: dx, y: dy }
                : { x: -dy, y: dx };
          return {
            a: through,
            b: { x: through.x + vector.x, y: through.y + vector.y },
          };
        }
      }
      if (construction?.kind === "angleBisector") {
        const angle = construction.angleId
            ? objects.find(
                (x): x is AngleObject =>
                  x.type === "angle" && x.id === construction.angleId,
              )
            : undefined,
          a = pointById(angle?.aId ?? construction.aId),
          v = pointById(angle?.vertexId ?? construction.vertexId),
          c = pointById(angle?.cId ?? construction.cId);
        if (a && v && c) {
          const firstLength = distance(a, v),
            secondLength = distance(c, v);
          if (firstLength > 1e-10 && secondLength > 1e-10) {
            const u1 = {
                x: (a.x - v.x) / firstLength,
                y: (a.y - v.y) / firstLength,
              },
              u2 = {
                x: (c.x - v.x) / secondLength,
                y: (c.y - v.y) / secondLength,
              };
            return { a: v, b: { x: v.x + u1.x + u2.x, y: v.y + u1.y + u2.y } };
          }
        }
      }
      return { a: pointById(o.aId) ?? o.a, b: pointById(o.bId) ?? o.b };
    };
  const circleData = (o: CircleObject) => {
      if (o.threePointIds) {
        const [a, b, c] = o.threePointIds.map((id) => pointById(id));
        if (a && b && c) {
          const result = circumcircle(a, b, c);
          if (result) return result;
        }
      }
      const center = pointById(o.centerId) ?? o.center,
        through = pointById(o.throughId) ?? o.through;
      return {
        center,
        r: o.radius ?? (through ? distance(center, through) : 1),
      };
    };
  return { pointById, segmentPoints, circleData };
}
