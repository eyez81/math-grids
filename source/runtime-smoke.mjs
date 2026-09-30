import puppeteer from "puppeteer-core";
import { browserOptions, openSection, testUrl } from "./scripts/smoke-config.mjs";

const browser = await puppeteer.launch(browserOptions());
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(`pageerror: ${error.stack || error}`));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(`console: ${message.text()}`);
});
page.on("response", (response) => {
  if (response.status() >= 400) errors.push(`http ${response.status()}: ${response.url()}`);
});

await page.goto(testUrl, { waitUntil: "networkidle0" });
await page.waitForSelector("canvas");
await openSection(page, ["נקודות", "כלים בסיסיים"]);
const pointButton = await page.$$(".tool-grid button").then(async (buttons) => {
  for (const button of buttons) {
    if (await button.evaluate((element) => element.textContent?.includes("נקודה"))) return button;
  }
  return null;
});
const canvas = await page.$("canvas");
if (!pointButton || !canvas) errors.push("missing canvas or point tool");
else {
  await pointButton.evaluate((button) => button.click());
  const box = await canvas.boundingBox();
  if (!box) errors.push("canvas has no bounding box");
  else {
    await page.mouse.click(box.x + box.width / 2 + 64, box.y + box.height / 2 - 64);
    await page.waitForFunction(() => document.querySelectorAll(".object-card").length === 1);
  }
}

const state = await page.evaluate(() => ({
  title: document.title,
  canvas: Boolean(document.querySelector("canvas")),
  objects: document.querySelectorAll(".object-card").length,
}));
console.log(JSON.stringify({ errors, state }));
await browser.close();
process.exit(errors.length ? 1 : 0);
