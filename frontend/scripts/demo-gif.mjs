// Builds the animated GIF of the main demo flow for the README from the desktop
// screenshots captured by `npm run test:e2e:demo-screenshots` (T33).
//
// Usage: npm run demo:gif
// Output: docs/screenshots/demo/demo-flow.gif
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import gifenc from "gifenc";
import { PNG } from "pngjs";

// gifenc ships CommonJS only: take the functions from its default export.
const { GIFEncoder, applyPalette, quantize } = gifenc;

const SCREENSHOTS = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "docs",
  "screenshots",
  "demo",
);
const OUTPUT = join(SCREENSHOTS, "demo-flow.gif");
const WIDTH = 960;
const FRAME_DELAY_MS = 2200;

// The 10-minute demo script of docs/DEMO.md, in order.
const FRAMES = [
  "01-login",
  "02-second-factor",
  "03-agenda-today",
  "04-agenda-week",
  "06-deadlines-detainees",
  "07-case-list",
  "08-case-summary",
  "09-case-defendants",
  "10-case-deadlines",
  "13-settings-catalogs",
  "18-import-errors",
  "19-import-done",
];

/** Downscales an RGBA image by averaging the source pixels behind each target pixel. */
function resize(image, width) {
  const scale = image.width / width;
  const height = Math.round(image.height / scale);
  const out = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const y0 = Math.floor(y * scale);
    const y1 = Math.min(image.height, Math.max(y0 + 1, Math.floor((y + 1) * scale)));
    for (let x = 0; x < width; x++) {
      const x0 = Math.floor(x * scale);
      const x1 = Math.min(image.width, Math.max(x0 + 1, Math.floor((x + 1) * scale)));
      const sum = [0, 0, 0, 0];
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const i = (sy * image.width + sx) * 4;
          for (let c = 0; c < 4; c++) sum[c] += image.data[i + c];
        }
      }
      const count = (y1 - y0) * (x1 - x0);
      const o = (y * width + x) * 4;
      for (let c = 0; c < 4; c++) out[o + c] = Math.round(sum[c] / count);
    }
  }
  return { width, height, data: out };
}

const gif = GIFEncoder();
let size;
for (const name of FRAMES) {
  const png = PNG.sync.read(readFileSync(join(SCREENSHOTS, `${name}-desktop.png`)));
  const frame = resize(png, WIDTH);
  // The GIF canvas takes the first frame's size: a different one would clip or leave remnants.
  size ??= `${frame.width}x${frame.height}`;
  if (`${frame.width}x${frame.height}` !== size) {
    throw new Error(`${name} is ${frame.width}x${frame.height}, expected ${size}`);
  }
  const palette = quantize(frame.data, 256);
  const index = applyPalette(frame.data, palette);
  gif.writeFrame(index, frame.width, frame.height, { palette, delay: FRAME_DELAY_MS });
  console.log(`frame ${name} (${frame.width}x${frame.height})`);
}
gif.finish();
writeFileSync(OUTPUT, gif.bytes());
console.log(`wrote ${OUTPUT}`);
