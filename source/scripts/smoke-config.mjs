import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const testUrl = process.env.TEST_URL || "http://127.0.0.1:8765/math-grids/";
export const screenshotPath = (name) => join(tmpdir(), name);
export function browserOptions() {
  const executablePath = process.env.CHROMIUM_PATH || [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome",
    process.env.PROGRAMFILES && join(process.env.PROGRAMFILES, "Google/Chrome/Application/chrome.exe"),
  ].find((candidate) => candidate && existsSync(candidate));
  if (!executablePath) throw new Error("Set CHROMIUM_PATH to an installed Chrome or Chromium executable before running browser smoke tests.");
  return { executablePath, headless: true };
}
export async function openSection(page, titles) {
  for (const title of titles) {
    const clicked = await page.$$eval(".tool-section-head", (buttons, title) => {
      const button = buttons.find((element) =>
        element.getAttribute("aria-expanded") === "false" && element.textContent.includes(title));
      button?.click();
      return Boolean(button);
    }, title);
    if (clicked)
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  }
}
