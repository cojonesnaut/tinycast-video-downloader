import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execa } from "./tinycast-execa";

// Like Downie, the thumbnail fills the whole 720×108 card behind the text, dimmed.
// It is sampled at 360×54 (one pixel per 2 units; the dimmed background looks the same
// as at 480×72 but the card SVG is less than half the size) and dimmed before encoding:
// a dark card keeps a third of the brightness (as Downie does), a light card is
// washed towards white. Dimming narrows the colour range, which keeps runs long.
const CARD_WIDTH = 720, CARD_HEIGHT = 108;
const SAMPLE_WIDTH = 360, SAMPLE_HEIGHT = 54;

export function dimPixels(rgb: Uint8Array, appearance?: string) {
  const out = new Uint8Array(rgb.length);
  for (let i = 0; i < rgb.length; i++) out[i] = appearance === "light" ? Math.round(0.25 * rgb[i] + 0.75 * 242) : Math.round(rgb[i] * 0.33);
  return out;
}

// AppKit's SVG decoder drops embedded bitmap <image> elements. Encode the
// thumbnail once as horizontal 1-pixel stroked runs grouped by colour, then
// reuse it in every card. Runs overlap slightly so no seams show when scaled.
export function thumbnailPaths(rgb: Uint8Array, width = SAMPLE_WIDTH, height = SAMPLE_HEIGHT) {
  if (rgb.length !== width * height * 3) throw new Error("Invalid thumbnail pixels");
  const colors = new Map<string, string[]>();
  const colorAt = (pixel: number) => [0, 1, 2].map(c => (rgb[pixel * 3 + c] & 0xf8).toString(16).padStart(2, "0")).join("");
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width;) {
      const start = x, color = colorAt(y * width + x++);
      while (x < width && colorAt(y * width + x) === color) x++;
      const runs = colors.get(color) || [];
      runs.push(`M${start} ${y}.5h${x - start}.3`);
      colors.set(color, runs);
    }
  }
  return `<g transform="scale(${CARD_WIDTH / width} ${CARD_HEIGHT / height})" fill="none" stroke-width="1.1">${[...colors].map(([color, runs]) => `<path stroke="#${color}" d="${runs.join("")}"/>`).join("")}</g>`;
}

export async function loadThumbnail(url: string, ffmpeg: string, appearance?: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Thumbnail request failed");
  const data = await response.arrayBuffer();
  if (!data.byteLength || data.byteLength > 8000000) throw new Error("Thumbnail is too large");
  const directory = mkdtempSync(path.join(tmpdir(), "tinycast-thumbnail-"));
  try {
    const input = path.join(directory, "image"), output = path.join(directory, "pixels.rgb");
    writeFileSync(input, Buffer.from(data));
    const filter = `scale=${SAMPLE_WIDTH}:${SAMPLE_HEIGHT}:force_original_aspect_ratio=increase:flags=lanczos,crop=${SAMPLE_WIDTH}:${SAMPLE_HEIGHT}`;
    await execa(ffmpeg, ["-nostdin", "-v", "error", "-i", input, "-vf", filter, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", output], { timeout: 15000 });
    return thumbnailPaths(dimPixels(readFileSync(output), appearance));
  } finally { rmSync(directory, { recursive: true, force: true }); }
}
