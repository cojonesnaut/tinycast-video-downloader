export type Progress = {
  percent: number | null;
  phase: "starting" | "download" | "processing" | "complete" | "error" | "paused" | "stopping" | "stopped";
  format?: string; item?: string; downloaded?: number; total?: number; speed?: number; eta?: number;
  resolution?: string; codec?: string; extension?: string;
};
// source "x.com", format "MP4", resolution "3840x2160"; accent is macOS AppleAccentColor;
// decimal is the separator for the user's region ("," shows "20,7 MB" like Downie).
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
      speed: number(speed) ?? lastKnown(lines, i, format, 6), eta: number(eta) ?? lastKnown(lines, i, format, 7), resolution: resolution === "NA" ? undefined : resolution,
      codec: codec === "NA" || codec === "none" ? undefined : codec, extension: extension === "NA" ? undefined : extension });
  }
  return null;
}
// yt-dlp downloads YouTube in ~10 MB chunks and reports no speed or ETA on the first
// line of each chunk. Carry the most recent value for the same transfer forward so the
// view doesn't flicker to "—" when its once-a-second update lands on such a line.
function lastKnown(lines: string[], end: number, format: string, field: number) {
  for (let j = end - 1, seen = 0; j >= 0 && seen < 40; j--) {
    if (!lines[j].startsWith(marker)) continue;
    seen++;
    const fields = lines[j].slice(marker.length).split("|");
    if (fields[1] !== format) return undefined;
    const value = number(fields[field]);
    if (value !== undefined) return value;
  }
  return undefined;
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
// Time left, as "10 s", "1 min 5 s" or "1 h 2 min".
export function timeLeft(n?: number) {
  if (n === undefined) return "";
  n = Math.max(0, Math.round(n));
  if (n < 60) return `${n} s`;
  if (n < 3600) return `${Math.floor(n / 60)} min${n % 60 ? ` ${n % 60} s` : ""}`;
  return `${Math.floor(n / 3600)} h${Math.floor(n / 60) % 60 ? ` ${Math.floor(n / 60) % 60} min` : ""}`;
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


// Values yt-dlp prints as JSON before the download starts: the file it is writing
// (TINYCAST_FILE) and the video title (TINYCAST_TITLE), used when the lookup hasn't finished.
function printed(log: string, marker: string): string | undefined {
  const line = log.split(/\r?\n/).reverse().find(l => l.startsWith(marker));
  try { const value = line && JSON.parse(line.slice(marker.length)); return typeof value === "string" ? value : undefined; } catch { return undefined; }
}
export const plannedFile = (log: string) => printed(log, "TINYCAST_FILE:");
export const printedTitle = (log: string) => printed(log, "TINYCAST_TITLE:");
