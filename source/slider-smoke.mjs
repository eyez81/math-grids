import puppeteer from "puppeteer-core";
import { browserOptions, testUrl, openSection, screenshotPath } from "./scripts/smoke-config.mjs";

const browser = await puppeteer.launch(browserOptions());
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
const errors = [];
page.on("pageerror", (error) => errors.push(`pageerror: ${error.stack || error}`));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(`console: ${message.text()}`);
});
page.on("response", (response) => {
  if (response.status() >= 400) errors.push(`http ${response.status()}: ${response.url()}`);
});

const pause = () => new Promise((resolve) => setTimeout(resolve, 100));
const clickButton = async (wanted) => {
  if (wanted.includes("הוספת פונקציה")) await openSection(page, ["גרפים ופונקציות"]);
  for (const button of await page.$$("button")) {
    const label = await button.evaluate((element) =>
      (element.textContent || "").replace(/\s+/g, " ").trim(),
    );
    if (label === wanted || label.includes(wanted)) {
      await button.click();
      await pause();
      return;
    }
  }
  throw new Error(`Button not found: ${wanted}`);
};
const addFunction = async (expression) => {
  await clickButton("הוספת פונקציה");
  await page.waitForSelector("math-keyboard-field");
  await page.$eval(
    "math-keyboard-field",
    (field, value) => {
      if (typeof field.setValue === "function") field.setValue(value);
      else field.value = value;
      field.dispatchEvent(new CustomEvent("mkf-input", { bubbles: true, detail: { latex: value } }));
    },
    expression,
  );
  await pause();
  await clickButton("הוספה למישור");
};

const expressions = [
  { latex: "f(x)=ax+b", normalized: "f(x)=ax+b" },
  { latex: "g(x)=a\\sin(x)", normalized: "g(x)=asin(x)" },
  { latex: "h(x)=(x-a)^2+b", normalized: "h(x)=(x-a)^2+b" },
  { latex: "p(x)=\\sqrt{\\left|ax\\right|}+b", normalized: "p(x)=sqrt(|ax|)+b" },
  { latex: "q(x)=2a+x", normalized: "q(x)=2a+x" },
  { latex: "r(x)=a(x+1)", normalized: "r(x)=a(x+1)" },
];
const canvasHash = () =>
  page.$eval("canvas", (canvas) => {
    const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
    let hash = 2166136261;
    for (let index = 0; index < data.length; index += 97)
      hash = Math.imul(hash ^ data[index], 16777619);
    return hash >>> 0;
  });

for (const expression of expressions) {
  await page.goto(testUrl, { waitUntil: "networkidle0" });
  await page.waitForSelector("canvas");
  await page.select("#workspace-mode", "graphs");
  await pause();
  await clickButton("מחוונים דינמיים");
  await clickButton("הוספת מחוון");
  await clickButton("הוספת מחוון");
  const names = await page.$$eval(".live-slider b", (nodes) =>
    nodes.map((node) => (node.textContent || "").split("=")[0].trim()),
  );
  if (!names.includes("a") || !names.includes("b"))
    errors.push(`sliders were not created: ${names.join(", ")}`);
  await addFunction(expression.latex);
  const titles = await page.$$eval(".function-object-label", (nodes) =>
    nodes.map((node) => node.getAttribute("title")),
  );
  if (!titles.includes(expression.normalized))
    errors.push(`dynamic function was not added: ${expression.latex}; titles=${titles.join(", ")}`);
  if (expression === expressions[0]) {
    const before = await canvasHash();
    await page.focus(".live-slider input[type=range]");
    await page.keyboard.press("ArrowRight");
    await pause();
    const after = await canvasHash();
    if (before === after) errors.push("changing a slider did not redraw the functions");
  }
}

console.log(JSON.stringify({ errors }));
await browser.close();
process.exit(errors.length ? 1 : 0);
