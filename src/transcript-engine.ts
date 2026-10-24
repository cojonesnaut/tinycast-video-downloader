import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { execa } from "./tinycast-execa.js";

export type TranscriptPreferences = { ytdlPath?: string; ffmpegPath?: string; downloadPath?: string; cookiesFromBrowser?: string; forceIpv4?: boolean };
export type Track = { id: string; code: string; name: string; automatic: boolean };
export type CaptionVideo = { title: string; url: string; tracks: Track[]; publicCaptions?: boolean };
export type Cue = { time: string; text: string };
export const expand = (value: string) => value.replace(/^~(?=\/|$)/, homedir());
function binary(name: string, preference?: string) {
  const found = [preference && expand(preference.trim()), `/opt/homebrew/bin/${name}`, `/usr/local/bin/${name}`, ...String(process.env.PATH || "").split(":").filter(Boolean).map(p => path.join(p, name))].find(p => p && existsSync(p));
  if (!found) throw new Error(`${name} not found. Set its full path in extension preferences.`);
  return found;
}
function common(prefs: TranscriptPreferences) {
  const args = ["--ignore-config", "--no-playlist", "--socket-timeout", "20", "--retries", "1", "--extractor-retries", "1"];
  if (prefs.forceIpv4) args.push("--force-ipv4");
  if (prefs.cookiesFromBrowser && prefs.cookiesFromBrowser !== "none") args.push("--cookies-from-browser", prefs.cookiesFromBrowser);
  return args;
}
function env() { return { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH || "/usr/bin:/bin"}` }; }
export function validUrl(value: string) { try { return ["http:", "https:"].includes(new URL(value.trim()).protocol); } catch { return false; } }
export function errorText(error: unknown) { const e = error as { stderr?: string; message?: string }; return e.stderr?.trim() || e.message || String(error); }
export function captionTracks(info: { subtitles?: Record<string, { name?: string; ext?: string }[]>; automatic_captions?: Record<string, { name?: string; ext?: string }[]> }): Track[] {
  const result: Track[] = [];
  for (const [automatic, tracks] of [[false, info.subtitles], [true, info.automatic_captions]] as const) {
    for (const [code, entries] of Object.entries(tracks || {})) {
      if (code === "live_chat" || !entries?.some(entry => entry.ext !== "mhtml")) continue;
      result.push({ id: `${automatic ? "auto" : "manual"}:${code}`, code, name: entries.find(e => e.name)?.name || code, automatic });
    }
  }
  return result.sort((a, b) => Number(a.automatic) - Number(b.automatic) || a.code.localeCompare(b.code));
}
export async function loadCaptionVideo(url: string, prefs: TranscriptPreferences): Promise<CaptionVideo> {
  if (!validUrl(url)) throw new Error("Enter a complete http:// or https:// video URL.");
  const lookup = async (settings: TranscriptPreferences, publicCaptions = false): Promise<CaptionVideo> => {
    const result = await execa(binary("yt-dlp", settings.ytdlPath), [...common(settings), "--skip-download", "--dump-single-json", "--", url.trim()], { env: env(), timeout: 90000 });
    const info = JSON.parse(result.stdout);
    if (info.live_status === "is_live") throw new Error("This video is currently live. Try again after the stream ends.");
    const tracks = captionTracks(info);
    if (!tracks.length) throw new Error("This video has no published or automatic captions. This command extracts captions; it does not transcribe audio.");
    return { title: info.title || "Transcript", url: url.trim(), tracks, publicCaptions };
  };
  try { return await lookup(prefs); }
  catch (original) {
    if (!prefs.cookiesFromBrowser || prefs.cookiesFromBrowser === "none") throw original;
    try { return await lookup({ ...prefs, cookiesFromBrowser: "none" }, true); }
    catch { throw original; }
  }
}
const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
function clean(text: string) {
  return text.replace(/<[^>]*>/g, "").replace(/\{\\[^}]*\}/g, "").replace(/&#(x[\da-f]+|\d+);/gi, (full, value) => {
    const n = value[0].toLowerCase() === "x" ? parseInt(value.slice(1), 16) : Number(value);
    return n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : full;
  }).replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, entity: string) => entities[entity] || "").replace(/\s+/g, " ").trim();
}
export function parseSrt(source: string): Cue[] {
  const cues: Cue[] = []; let previous: string[] = [];
  for (const block of source.replace(/^\uFEFF/, "").split(/\r?\n\s*\r?\n/)) {
    const lines = block.split(/\r?\n/);
    const index = lines.findIndex(line => /\d{2}:\d{2}:\d{2}[,.]\d{3}\s+-->/.test(line));
    if (index < 0) continue;
    const text = clean(lines.slice(index + 1).join(" "));
    if (!text) continue;
    const words = text.split(" "); let overlap = 0;
    for (let n = Math.min(previous.length, words.length); n > 0; n--) {
      if (previous.slice(-n).join(" ") === words.slice(0, n).join(" ")) { overlap = n; break; }
    }
    const addition = words.slice(overlap).join(" ");
    if (addition) cues.push({ time: lines[index].trim().slice(0, 8), text: addition });
    previous = words;
  }
  return cues;
}
export async function extractCaptions(video: CaptionVideo, trackId: string, prefs: TranscriptPreferences): Promise<Cue[]> {
  const track = video.tracks.find(t => t.id === trackId);
  if (!track) throw new Error("Choose an available caption language first.");
  const ytdlp = binary("yt-dlp", prefs.ytdlPath), ffmpeg = binary("ffmpeg", prefs.ffmpegPath);
  const folder = mkdtempSync(path.join(tmpdir(), "tinycast-transcript-"));
  try {
    const settings = video.publicCaptions ? { ...prefs, cookiesFromBrowser: "none" } : prefs;
    const escaped = track.code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    await execa(ytdlp, [...common(settings), "--skip-download", track.automatic ? "--write-auto-subs" : "--write-subs", "--sub-langs", `^${escaped}$`, "--sub-format", "srt/vtt/best", "--convert-subs", "srt", "--ffmpeg-location", path.dirname(ffmpeg), "-o", path.join(folder, "captions.%(ext)s"), "--", video.url], { env: env(), timeout: 120000 });
    const file = readdirSync(folder).find(name => name.endsWith(".srt"));
    if (!file) throw new Error(`No ${track.code} captions were downloaded. The site may be rate-limiting subtitles; retry later or select another track.`);
    const cues = parseSrt(readFileSync(path.join(folder, file), "utf8"));
    if (!cues.length) throw new Error("The downloaded caption file contains no readable transcript text.");
    return cues;
  } finally { try { rmSync(folder, { recursive: true, force: true }); } catch {} }
}
export function transcriptText(cues: Cue[], timestamps: boolean) {
  return timestamps ? cues.map(c => `[${c.time}] ${c.text}`).join("\n\n") : cues.map(c => c.text).join(" ");
}
export const markdownEscape = (s: string) => s.replace(/[\\`*_{}\[\]()#+.!<>|]/g, "\\$&");
