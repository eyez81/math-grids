import type { MathObject, Viewport } from "./geometry";

/** File extension for saved drawings of the workspace. The content is JSON. */
export const SCENE_EXTENSION = ".merhav";
export const SCENE_FORMAT = "merhav-scene";
export const SCENE_VERSION = 1;

export type SceneSettings = {
  mode: string;
  viewport: Viewport;
  gridStep: number;
  xTickStep: number;
  yTickStep: number;
  axisLabels: { x: Record<number, string>; y: Record<number, string> };
  snap: boolean;
  showGrid: boolean;
  showAxes: boolean;
  showNumbers: boolean;
  quadrantView: string;
  clipToQuadrants: boolean;
  xAxisName: string;
  yAxisName: string;
};

export type SceneFile = {
  format: typeof SCENE_FORMAT;
  version: number;
  title: string;
  savedAt: string;
  settings: SceneSettings;
  objects: MathObject[];
};

const OBJECT_TYPES = new Set(["point", "segment", "line", "function", "sketch", "angle", "polygon", "circle", "slider", "text"]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isPositive = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

export function serializeScene(title: string, settings: SceneSettings, objects: MathObject[]) {
  const scene: SceneFile = {
    format: SCENE_FORMAT,
    version: SCENE_VERSION,
    title,
    savedAt: new Date().toISOString(),
    settings,
    objects,
  };
  return JSON.stringify(scene, null, 2);
}

/** Sanitize a user-chosen name so it can be used as a download file name. */
export function sceneFileName(title: string) {
  const clean = title.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").trim().replace(/\.merhav$/i, "");
  return `${clean || "שרטוט"}${SCENE_EXTENSION}`;
}

/** Parse and validate a saved drawing. Throws an Error with a Hebrew message when the file is invalid. */
export function parseScene(text: string): { title: string; settings: Partial<SceneSettings>; objects: MathObject[] } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("הקובץ אינו שרטוט תקין של המרחב המתמטי.");
  }
  if (!isRecord(data) || data.format !== SCENE_FORMAT || !Array.isArray(data.objects))
    throw new Error("הקובץ אינו שרטוט תקין של המרחב המתמטי.");
  if (typeof data.version !== "number" || data.version > SCENE_VERSION)
    throw new Error("לא ניתן לפתוח: השרטוט נשמר בגרסה חדשה יותר של היישומון.");
  const ids = new Set<string>();
  for (const object of data.objects) {
    if (!isRecord(object) || typeof object.id !== "string" || typeof object.type !== "string" || !OBJECT_TYPES.has(object.type) || ids.has(object.id))
      throw new Error("לא ניתן לפתוח: השרטוט מכיל אובייקט פגום.");
    ids.add(object.id);
  }
  const raw = isRecord(data.settings) ? data.settings : {};
  const settings: Partial<SceneSettings> = {};
  if (typeof raw.mode === "string") settings.mode = raw.mode;
  if (isRecord(raw.viewport) && Number.isFinite(raw.viewport.centerX) && Number.isFinite(raw.viewport.centerY) && isPositive(raw.viewport.scale))
    settings.viewport = { centerX: raw.viewport.centerX as number, centerY: raw.viewport.centerY as number, scale: raw.viewport.scale };
  if (isPositive(raw.gridStep)) settings.gridStep = raw.gridStep;
  if (isPositive(raw.xTickStep)) settings.xTickStep = raw.xTickStep;
  if (isPositive(raw.yTickStep)) settings.yTickStep = raw.yTickStep;
  if (isRecord(raw.axisLabels) && isRecord(raw.axisLabels.x) && isRecord(raw.axisLabels.y))
    settings.axisLabels = raw.axisLabels as SceneSettings["axisLabels"];
  for (const key of ["snap", "showGrid", "showAxes", "showNumbers", "clipToQuadrants"] as const)
    if (typeof raw[key] === "boolean") settings[key] = raw[key] as boolean;
  for (const key of ["quadrantView", "xAxisName", "yAxisName"] as const)
    if (typeof raw[key] === "string") settings[key] = raw[key] as string;
  return {
    title: typeof data.title === "string" ? data.title : "",
    settings,
    objects: data.objects as MathObject[],
  };
}
