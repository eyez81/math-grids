import { access, cp, mkdir, rm, writeFile } from "node:fs/promises";
const output = new URL("../out/", import.meta.url);
const docs = new URL("../../docs/", import.meta.url);
await access(new URL("index.html", output));
await mkdir(docs, { recursive: true });
// Remove obsolete generated chunks, preserving public files and .nojekyll.
await rm(new URL("_next/", docs), { recursive: true, force: true });
await cp(output, docs, { recursive: true });
await writeFile(new URL(".nojekyll", docs), "");
console.log("Updated docs/ from the successful static export.");
