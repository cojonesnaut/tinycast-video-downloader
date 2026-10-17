export const formats = [
  { value: "mp4", title: "MP4 video" },
  { value: "best", title: "Original format · highest resolution (may be WebM)" },
  { value: "mp3", title: "MP3 audio only" },
];
// MP4 resolution limits. "highest" keeps the uncapped behaviour (4K/8K when offered).
export const resolutions = [
  { value: "highest", title: "Highest (4K)" },
  { value: "1440", title: "1440p" },
  { value: "1080", title: "1080p" },
  { value: "720", title: "720p" },
];
// Labels for the card's "source – format – resolution" line.
export function formatLabel(choice: string) { return choice === "mp4" ? "MP4" : choice === "mp3" ? "MP3" : "Original"; }
export function qualityLabel(choice: string, resolution: string) {
  return choice === "mp4" ? resolutions.find(item => item.value === resolution)?.title ?? resolutions[0].title : choice === "mp3" ? "Audio" : "Highest";
}
// Audio tracks offered by the source. YouTube lists original, dubbed and auto-dubbed
// audio as separate formats with a language code; yt-dlp gives the original track
// language_preference 10 and names each track in format_note ("Spanish, medium").
type SourceFormat = { vcodec?: string; acodec?: string; language?: string | null; language_preference?: number; format_note?: string };
export type AudioTrack = { value: string; title: string };
export const validLanguage = (code: string) => /^[A-Za-z0-9-]{1,20}$/.test(code);
export function audioTracks(formats: SourceFormat[] = []): { original?: string; tracks: AudioTrack[] } {
  // Per language: the track name and the highest preference (10 original, 5 default).
  const languages = new Map<string, { name: string; preference: number }>();
  for (const f of formats) {
    if (f.vcodec !== "none" || !f.acodec || f.acodec === "none" || !f.language || !validLanguage(f.language)) continue;
    const name = (f.format_note || "").split(",")[0].replace(/\s*original|\s*\(default\)/gi, "").trim();
    const known = languages.get(f.language);
    languages.set(f.language, { name: known?.name || name || f.language, preference: Math.max(known?.preference ?? -1, f.language_preference ?? -1) });
  }
  // Single-language sources have no track names ("medium, DRC") and nothing to choose.
  if (languages.size < 2) return { tracks: [] };
  const best = Math.max(...[...languages.values()].map(l => l.preference));
  const originalCode = best >= 5 ? [...languages].find(([, l]) => l.preference === best)?.[0] : undefined;
  const tracks = [...languages].filter(([code]) => code !== originalCode).map(([value, l]) => ({ value, title: l.name })).sort((a, b) => a.title.localeCompare(b.title));
  return { original: originalCode ? languages.get(originalCode)?.name : undefined, tracks };
}

// audio is a language code from audioTracks, or "original" for the source's own track.
// A dubbed track falls back to the original audio if that language is not available.
export function formatArgs(choice: string, resolution = "highest", audio = "original"): string[] {
  const lang = audio !== "original" && validLanguage(audio) ? `[language=${audio}]` : "";
  if (choice === "mp3") return ["-f", lang ? `ba${lang}/bestaudio/best` : "bestaudio/best", "-x", "--audio-format", "mp3", "--audio-quality", "0"];
  const select = lang ? `bv*+ba${lang}/bv*+ba/b` : "bv*+ba/b";
  if (choice === "mp4") {
    // Prefer maximum resolution first (including 4K/8K), then MP4/M4A
    // sources at that resolution. Remux fallback sources without downscaling.
    // A cap ("res:1080") prefers the largest stream at or below it; yt-dlp's res
    // uses the shorter side, so portrait videos are capped the same way.
    const res = /^\d+$/.test(resolution) ? `res:${resolution}` : "res";
    return [
      "-f", select, "-S", `${res},fps,ext:mp4:m4a`,
      "--merge-output-format", "mp4", "--remux-video", "mp4",
    ];
  }
  return ["-f", select, "-S", "res,fps"];
}
