export type Progress = {
  percent: number | null;
  phase: "starting" | "download" | "processing" | "complete" | "error" | "paused" | "stopping" | "stopped";
  format?: string; item?: string; downloaded?: number; total?: number; speed?: number; eta?: number;
  resolution?: string; codec?: string; extension?: string;
};
// source "x.com", format "MP4", resolution "3840x2160"; accent is macOS AppleAccentColor;
// decimal is the separator for the user's region ("," shows "20,7 MB" like Downie).
export type CardInfo = { source?: string; format?: string; resolution?: string; audio?: string; thumbnail?: string; appearance?: string; accent?: string; decimal?: string };
export const marker = "TINYCAST_PROGRESS:";
const number = (value?: string) => { const n = Number(value); return value && Number.isFinite(n) && n >= 0 ? n : undefined; };
export function parseProgress(log: string): Progress | null {
  const lines = log.split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].startsWith("TINYCAST_PROCESSING:")) return { phase: "processing", percent: 100 };
    if (!lines[i].startsWith(marker)) continue;
    const [raw, format, item, downloaded, total, estimate, speed, eta, resolution, codec, extension] = lines[i].slice(marker.length).split("|");
    const percent = parseFloat(raw.replace("%", "").trim());
    return combine(lines, i, { phase: "download", percent: Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : null,
      format, item: item === "NA" ? undefined : item, downloaded: number(downloaded), total: number(total) ?? number(estimate),
      speed: number(speed), eta: number(eta), resolution: resolution === "NA" ? undefined : resolution,
      codec: codec === "NA" || codec === "none" ? undefined : codec, extension: extension === "NA" ? undefined : extension });
  }
  return null;
}
export const formatsMarker = "TINYCAST_FORMATS:";
type Requested = { format_id?: unknown; filesize?: unknown; filesize_approx?: unknown };
const size = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
// Merged downloads fetch video and audio as separate transfers that each run 0–100%.
// yt-dlp prints the requested formats and their sizes before downloading
// (TINYCAST_FORMATS), so report one combined figure across all of them.
function combine(lines: string[], end: number, current: Progress): Progress {
  let start = end;
  while (start >= 0 && !lines[start].startsWith(formatsMarker)) start--;
  if (start < 0) return current;
  let requested: Requested[];
  try { requested = JSON.parse(lines[start].slice(formatsMarker.length)); } catch { return current; }
  if (!Array.isArray(requested) || requested.length < 2 || !requested.some(f => String(f.format_id) === current.format)) return current;
  // Latest reported total per format; transfers run one after another in requested order.
  const reported = new Map<string, number | undefined>();
  for (let i = start + 1; i <= end; i++) if (lines[i].startsWith(marker)) {
    const [, format, , , total, estimate] = lines[i].slice(marker.length).split("|");
    reported.set(format, number(total) ?? number(estimate));
  }
  let total = 0, downloaded = 0;
  for (const f of requested) {
    const id = String(f.format_id);
    const expected = reported.get(id) ?? size(f.filesize) ?? size(f.filesize_approx);
    if (expected === undefined) return current;
    total += expected;
    downloaded += id === current.format ? Math.min(current.downloaded ?? 0, expected) : reported.has(id) ? expected : 0;
  }
  return { ...current, downloaded, total, percent: Math.min(100, downloaded / total * 100),
    eta: current.speed ? (total - downloaded) / current.speed : current.eta };
}
export function bytes(n?: number, decimal = ".") {
  if (n === undefined) return "";
  const one = (v: number) => v.toFixed(1).replace(".", decimal);
  if (n >= 1e9) return `${one(n / 1e9)} GB`;
  if (n >= 1e6) return `${one(n / 1e6)} MB`;
  return `${Math.round(n / 1000)} KB`;
}
export function time(n?: number) {
  if (n === undefined) return "";
  n = Math.max(0, Math.round(n));
  const two = (v: number) => v.toString().padStart(2, "0");
  return n >= 3600 ? `${Math.floor(n / 3600)}:${two(Math.floor(n / 60) % 60)}:${two(n % 60)}` : `${two(Math.floor(n / 60))}:${two(n % 60)}`;
}
// Decimal separator for a macOS AppleLocale such as "en_GB@rg=trzzzz" (region formats win).
export function decimalSeparator(appleLocale: string) {
  try {
    const region = (appleLocale.match(/@rg=([a-z]{2})/i)?.[1] || appleLocale.match(/_([A-Z]{2})/)?.[1] || "").toUpperCase();
    if (!region) return ".";
    const language = new Intl.Locale(`und-${region}`).maximize().language;
    return (1.5).toLocaleString(`${language}-${region}`).charAt(1) === "," ? "," : ".";
  } catch { return "."; }
}

const FONT = `font-family="'SF Pro Text','Helvetica Neue',Helvetica,Arial,sans-serif"`;
const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const clip = (s: string, n: number) => [...s].length > n ? [...s].slice(0, n - 1).join("") + "…" : s;
// Downie fills the bar with the macOS accent colour, darkened. Keys are AppleAccentColor
// values; an unset value (multicolour) is blue.
const accents: Record<string, string> = { "-1": "#6D6D6D", "0": "#C74044", "1": "#C06515", "2": "#B08A00", "3": "#4C9137", "4": "#1F63C4", "5": "#814784", "6": "#C13E7B" };
const mix = (hex: string, toward: string, amount: number) => "#" + [1, 3, 5].map(i => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - amount) + parseInt(toward.slice(i, i + 2), 16) * amount).toString(16).padStart(2, "0")).join("");
type Theme = { card: string; title: string; muted: string; track: string; text: string; icon: string; edge: string };
const themes: Record<"dark" | "light", Theme> = {
  dark: { card: "#4F4F4F", title: "#FAFAFA", muted: "#9E9E9E", track: "#484848", text: "#E8E8E8", icon: "#E0E0E0", edge: "#FFFFFF" },
  light: { card: "#F2F2F2", title: "#1D1D1F", muted: "#6E6E73", track: "#E3E3E6", text: "#1D1D1F", icon: "#3A3A3C", edge: "#000000" },
};
// Glyphs drawn around (0,0); the caller translates them into place.
const glyphs = {
  pause: `<rect x="-3.6" y="-5.5" width="1.7" height="11" rx="0.8"/><rect x="1.9" y="-5.5" width="1.7" height="11" rx="0.8"/>`,
  play: `<path d="M-3 -5.5L5 0L-3 5.5Z"/>`,
  reveal: `<circle cx="-1.5" cy="-1.5" r="4.8" fill="none" stroke-width="1.6"/><path d="M2 2L5.6 5.6" fill="none" stroke-width="1.8" stroke-linecap="round"/>`,
  failed: `<path d="M0 -5.5V1.2" fill="none" stroke-width="1.9" stroke-linecap="round"/><circle cx="0" cy="4.6" r="1.2" stroke="none"/>`,
  subtitles: `<path d="M-7 -5.5h14a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1 -1.5 1.5h-8.5l-3 3v-3h-2.5a1.5 1.5 0 0 1 -1.5 -1.5v-7a1.5 1.5 0 0 1 1.5 -1.5z" fill="none" stroke-width="1.2"/><path d="M-4.5 -1.5h4M1.5 -1.5h3M-4.5 1.5h2.5M0 1.5h4.5" fill="none" stroke-width="1.1"/>`,
  more: `<circle r="7.5" fill="none" stroke-width="1.3"/><circle cx="-3.3" r="1.1" stroke="none"/><circle r="1.1" stroke="none"/><circle cx="3.3" r="1.1" stroke="none"/>`,
  close: `<circle r="7.5" fill="none" stroke-width="1.5"/><path d="M-2.8 -2.8L2.8 2.8M2.8 -2.8L-2.8 2.8" fill="none" stroke-width="1.6" stroke-linecap="round"/>`,
};
const glyph = (name: keyof typeof glyphs, x: number, y: number, color: string) => `<g transform="translate(${x} ${y})" fill="${color}" stroke="${color}">${glyphs[name]}</g>`;

// A Downie-style row: the dimmed thumbnail fills the card; title and "source – format –
// resolution" at the top left, a close button at the top right, and a full-width pill
// progress bar with the status text centred inside it.
export function progressCard(progress: Progress, title: string, status: string, info: CardInfo = {}) {
  const light = info.appearance === "light";
  const theme = themes[light ? "light" : "dark"];
  const d = info.decimal || ".";
  const done = progress.phase === "complete", failed = progress.phase === "error";
  const idle = ["paused", "stopped", "stopping"].includes(progress.phase);
  const base = done ? "#2E5B2E" : failed ? "#7E2D2D" : idle ? "#6A6A6A" : accents[info.accent ?? "4"] ?? accents["4"];
  const fill = light ? mix(base, "#FFFFFF", 0.45) : base;
  const percent = done || failed ? 100 : progress.percent;
  const pct = percent == null ? "" : `${Math.floor(percent)}%`;
  const amount = progress.downloaded !== undefined && progress.total ? `${bytes(progress.downloaded, d)}/${bytes(progress.total, d)}` : "";
  // Status wording follows Downie: "33% - Downloading - 20,7 MB/57,8 MB - 00:12 remaining - 3,0 MB/s".
  const line = progress.phase === "download"
    ? amount
      ? [pct, "Downloading", amount, progress.eta !== undefined ? `${time(progress.eta)} remaining` : "", progress.speed ? `${bytes(progress.speed, d)}/s` : ""].filter(Boolean).join(" - ")
      : `Downloaded ${bytes(progress.downloaded ?? 0, d)} - unknown size - ${progress.speed ? `${bytes(progress.speed, d)}/s` : "Zero KB/s"}`
    : progress.phase === "processing" ? "Processing…"
    : progress.phase === "starting" ? "Preparing download…"
    : progress.phase === "paused" ? [pct, "Paused", amount].filter(Boolean).join(" - ")
    : progress.phase === "stopping" ? "Stopping…"
    : progress.phase === "stopped" ? "Stopped. Partial files are kept."
    : done ? "Finished."
    : "Failed. Use Copy Error in Actions for details.";
  const host = (info.source || "").replace(/^www\./, "");
  const meta = [host, info.format, info.resolution, info.audio, progress.item ? `Item ${progress.item}` : "", done && progress.total ? bytes(progress.total, d) : ""].filter(Boolean).join(" – ");
  const left = done ? glyph("reveal", 22, 89.5, theme.icon) : failed ? glyph("failed", 22, 89.5, theme.icon)
    : progress.phase === "paused" ? glyph("play", 22, 89.5, theme.icon) : progress.phase === "stopped" ? "" : glyph("pause", 22, 89.5, theme.icon);
  const width = percent == null ? 0 : Math.round(710 * percent / 100);
  // AppKit resolves clip paths in the parent's space, so clips sit on untransformed groups.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="108" viewBox="0 0 720 108"><defs>` +
    `<clipPath id="card"><rect width="720" height="108" rx="10"/></clipPath><clipPath id="pill"><rect x="5" y="76" width="710" height="27" rx="13.5"/></clipPath></defs>` +
    `<g clip-path="url(#card)"><rect width="720" height="108" fill="${theme.card}"/>${info.thumbnail || ""}</g>` +
    `<text x="16" y="28" fill="${theme.title}" ${FONT} font-size="14.5" font-weight="500">${xml(clip(title, 80))}</text>` +
    `<text x="16" y="47" fill="${theme.muted}" ${FONT} font-size="12">${xml(clip(meta, 100))}</text>` +
    glyph("close", 699, 21, theme.icon) +
    `<g clip-path="url(#pill)"><rect x="5" y="76" width="710" height="27" fill="${theme.track}" fill-opacity="0.92"/>${width ? `<rect x="5" y="76" width="${width}" height="27" fill="${fill}"/>` : ""}</g>` +
    `<rect x="5.5" y="76.5" width="709" height="26" rx="13" fill="none" stroke="${done ? "#5C9E5C" : theme.edge}" stroke-opacity="${done ? 0.7 : 0.18}"/>` +
    left +
    `<text x="360" y="93.8" text-anchor="middle" fill="${theme.text}" ${FONT} font-size="12.5">${xml(clip(line, 96))}</text>` +
    glyph("subtitles", 674, 89.5, theme.icon) + glyph("more", 699, 89.5, theme.icon) +
    `</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
