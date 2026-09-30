import assert from "node:assert/strict";
import { test } from "node:test";
import { parseEquation } from "../lib/expressions";
import { circumcircle, distance, inFunctionDomain, polygonInteriorAngle } from "../lib/geometry";
import { createGeometryResolver } from "../lib/resolveGeometry";
import { findIntersections } from "../lib/intersections";
import type { PointObject, MathObject, FunctionObject, SegmentObject, CircleObject, PolygonObject } from "../lib/geometry";

const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`);
const variables = { a: 2, b: 1 };
for (const [expression, x, expected] of [
  ["y=ax+b", 3, 7], ["y=2a+x", 3, 7], ["y=a(x+1)", 3, 8],
  ["y=2x+1", 3, 7], ["y=-x^2", 3, -9], ["y=(-x)^2", 3, 9],
  ["y=2^-2", 0, .25], ["y=2^3^2", 0, 512], ["y=2sin(x)", Math.PI / 2, 2],
  ["y=|x-2|", -1, 3], ["y=2|x|", -2, 4], ["y=sqrt(x-4)", 8, 2],
  ["y=sqrt(x-10000)", 10004, 2], ["y=pi*x", 2, Math.PI * 2],
  ["y=cot(x)", Math.PI / 4, 1], ["y=sec(x)", 0, 1], ["y=csc(x)", Math.PI / 2, 1],
  ["y=arcsin(x)", 1, Math.PI / 2], ["y=arccos(x)", 1, 0], ["y=arctan(x)", 1, Math.PI / 4],
  ["y=arccsc(x)", 1, Math.PI / 2], ["y=arcsec(x)", 1, 0], ["y=arccot(x)", 0, Math.PI / 2],
  ["y=root(3)(x)", -8, -2], ["y=log_2(x)", 8, 3], ["y=log_(10)(x)", 100, 2],
  ["y=(x+1)(x-1)", 3, 8], ["y=(x)/(2)", 3, 1.5], ["y=e^x", 1, Math.E],
  ["f(x)=a x+b", 3, 7],
] as const) test(expression, () => close(parseEquation(expression, variables).evaluate(x), expected));

test("syntax errors are rejected without executing code", () => {
  for (const expression of ["y=x+", "y=sin()", "y=missing(x)", "y=x;alert(1)", "y=x.constructor", "y=1,2", "y=(x", "y=x)"])
    assert.throws(() => parseEquation(expression));
});
test("parameter references include implicit multiplication", () => {
  assert.deepEqual([...parseEquation("y=ax+b", variables).usedVariables].sort(), ["a", "b"]);
});
const point = (id: string, x: number, y: number, dependency?: PointObject["dependency"]): PointObject => ({
  id, type: "point", name: id, x, y, color: "#000", showName: true, showCoords: true, guides: false, dependency,
});
const fn = (expression: string, patch: Partial<FunctionObject> = {}): FunctionObject => ({
  id: expression, type: "function", name: "f", expression, latex: expression, functionKind: "general", color: "#000",
  showEquation: true, showTable: false, strokeWidth: 2, strokeStyle: "solid", minClosed: true, maxClosed: true, ...patch,
});
const line = (x: number): SegmentObject => ({
  id: `x=${x}`, type: "line", name: "line", a: {x, y: 0}, b: {x, y: 1}, color: "#000",
  showLength: false, showSlope: false, showLabel: false, strokeWidth: 2, strokeStyle: "solid",
});
const circle = (patch: Partial<CircleObject> = {}): CircleObject => ({
  id: "circle", type: "circle", name: "circle", center: {x: 0,y: 0}, radius: 2, color: "#000", fill: false,
  showCenter: true, showRadius: false, showDiameter: false, showCircumference: false, showArea: false,
  strokeWidth: 2, strokeStyle: "solid", ...patch,
});
const resolver = (objects: MathObject[]) => createGeometryResolver(objects, (expression) => parseEquation(expression, variables));
const context = (objects: MathObject[] = []) => {
  const resolved = resolver(objects);
  return { ...resolved, centerX: 0, expressionEvaluator: (expression: string) => parseEquation(expression, variables),
    polygonPoints: (polygon: PolygonObject) => polygon.pointIds.map((id) => resolved.pointById(id)!).filter(Boolean) };
};

test("nested midpoints update when shared ancestors move", () => {
  const objects = [point("A", 0, 0), point("B", 2, 0),
    point("M", 1, 0, {kind: "midpoint", aId: "A", bId: "B"}),
    point("N", .5, 0, {kind: "midpoint", aId: "A", bId: "M"})];
  close(resolver(objects).pointById("N")!.x, .5);
  objects[1] = point("B", 4, 0);
  close(resolver(objects).pointById("N")!.x, 1);
  objects[0] = point("A", 2, 4);
  close(resolver(objects).pointById("N")!.x, 2.5);
  close(resolver(objects).pointById("N")!.y, 3);
});
test("circles and constrained points use world coordinates", () => {
  const c = circle({centerId: "O", throughId: "P", radius: undefined});
  const objects = [point("O", 0, 0), point("P", 0, 2), c,
    point("Q", 0, 0, {kind: "onCircle", sourceId: c.id, angle: Math.PI/2})];
  const r = resolver(objects);
  close(r.circleData(c).r, 2);
  close(r.pointById("Q")!.y, 2);
  const data = circumcircle({x: 2,y: 0}, {x: 0,y: 2}, {x: -2,y: 0})!;
  close(data.r, 2); close(data.center.x, 0); close(data.center.y, 0);
  for (const [xStep, yStep] of [[1,2], [2,1], [1,1]]) {
    // Display stretching must not change the mathematical point or measured radius.
    const q = r.pointById("Q")!;
    const screen = {x: q.x*64/xStep, y: -q.y*64/yStep};
    close(distance(data.center, q), 2);
    close((screen.x/(2*64/xStep))**2+(screen.y/(2*64/yStep))**2, 1);
  }
});
test("concave polygon angles sum to (n-2)*180 in either winding", () => {
  const points = [{x:0,y:0},{x:2,y:0},{x:1,y:1},{x:2,y:2},{x:0,y:2}];
  for (const pts of [points, [...points].reverse()]) {
    const angles = pts.map((_, i) => polygonInteriorAngle(pts, i));
    close(angles[2], 270);
    close(angles.reduce((a,b) => a+b, 0), 540);
  }
});
test("open endpoints are excluded from all function intersection pairings", () => {
  const f = fn("y=x", {domainMin: 0, domainMax: 1, minClosed: false, maxClosed: false});
  for (const other of [line(0), line(1), fn("y=0"), fn("y=1"), circle({center:{x:0,y:1},radius:1})]) {
    assert.deepEqual(findIntersections(f, other, context()), []);
    assert.deepEqual(findIntersections(other, f, context()), []);
  }
  assert.equal(findIntersections(f, line(.5), context()).length, 1);
  assert.equal(inFunctionDomain(0, f), false);
  assert.equal(inFunctionDomain(1, f), false);
});
test("closed endpoints and one-point domains remain valid intersections", () => {
  const f = fn("y=x", {domainMin: 0, domainMax: 1});
  assert.deepEqual(findIntersections(f, line(0), context()), [{x:0,y:0}]);
  assert.deepEqual(findIntersections(f, fn("y=0"), context()), [{x:0,y:0}]);
  const singleton = fn("y=x", {domainMin: 1, domainMax: 1});
  assert.deepEqual(findIntersections(singleton, fn("y=1"), context()), [{x:1,y:1}]);
});
test("circle intersections match their coordinate radii", () => {
  assert.deepEqual(findIntersections(circle(), line(0), context()), [{x:0,y:-2},{x:0,y:2}]);
});

test("renaming parameters preserves implicit products and function names", async () => {
  const { renameMathVariable } = await import("../lib/expressions");
  const equation = renameMathVariable("f(x)=ax+arcsin(x)+abs(x)", "a", "b");
  assert.equal(equation, "f(x)=bx+arcsin(x)+abs(x)");
  close(parseEquation(equation, {b:2}).evaluate(1), 3+Math.PI/2);
  assert.equal(renameMathVariable("f(x)=\\frac{ax}{2}+\\arcsin(x)", "a", "b"), "f(x)=\\frac{bx}{2}+\\arcsin(x)");
});
