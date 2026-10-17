"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extract-transcript.tsx
var extract_transcript_exports = {};
__export(extract_transcript_exports, {
  default: () => ExtractTranscript
});
module.exports = __toCommonJS(extract_transcript_exports);
var import_api = require("@raycast/api");
var import_react = require("react");
var import_node_fs2 = require("node:fs");
var import_node_path2 = __toESM(require("node:path"), 1);

// src/transcript-engine.ts
var import_node_fs = require("node:fs");
var import_node_os = require("node:os");
var import_node_path = __toESM(require("node:path"), 1);

// src/tinycast-execa.ts
var import_node_child_process = require("node:child_process");
var ExecaError = class extends Error {
  stdout = "";
  stderr = "";
  exitCode;
  code;
  shortMessage = "";
};
function execa(file, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    (0, import_node_child_process.execFile)(file, args, { ...options, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => {
      const output = String(stdout ?? "").replace(/\r?\n$/, "");
      const errors = String(stderr ?? "").replace(/\r?\n$/, "");
      if (error) {
        const failure = new ExecaError(error.message);
        failure.name = "ExecaError";
        failure.stdout = output;
        failure.stderr = errors;
        failure.code = error.code;
        failure.exitCode = typeof error.code === "number" ? error.code : void 0;
        failure.shortMessage = error.message;
        reject(failure);
      } else {
        resolve({ stdout: output, stderr: errors, exitCode: 0 });
      }
    });
  });
}

// src/transcript-engine.ts
var expand = (value) => value.replace(/^~(?=\/|$)/, (0, import_node_os.homedir)());
function binary(name, preference) {
  const found = [preference && expand(preference.trim()), `/opt/homebrew/bin/${name}`, `/usr/local/bin/${name}`, ...String(process.env.PATH || "").split(":").filter(Boolean).map((p) => import_node_path.default.join(p, name))].find((p) => p && (0, import_node_fs.existsSync)(p));
  if (!found) throw new Error(`${name} not found. Set its full path in extension preferences.`);
  return found;
}
function common(prefs) {
  const args = ["--ignore-config", "--no-playlist", "--socket-timeout", "20", "--retries", "1", "--extractor-retries", "1"];
  if (prefs.forceIpv4) args.push("--force-ipv4");
  if (prefs.cookiesFromBrowser && prefs.cookiesFromBrowser !== "none") args.push("--cookies-from-browser", prefs.cookiesFromBrowser);
  return args;
}
function env() {
  return { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH || "/usr/bin:/bin"}` };
}
function validUrl(value) {
  try {
    return ["http:", "https:"].includes(new URL(value.trim()).protocol);
  } catch {
    return false;
  }
}
function errorText(error) {
  const e = error;
  return e.stderr?.trim() || e.message || String(error);
}
function captionTracks(info) {
  const result = [];
  for (const [automatic, tracks] of [[false, info.subtitles], [true, info.automatic_captions]]) {
    for (const [code, entries] of Object.entries(tracks || {})) {
      if (code === "live_chat" || !entries?.some((entry) => entry.ext !== "mhtml")) continue;
      result.push({ id: `${automatic ? "auto" : "manual"}:${code}`, code, name: entries.find((e) => e.name)?.name || code, automatic });
    }
  }
  return result.sort((a, b) => Number(a.automatic) - Number(b.automatic) || a.code.localeCompare(b.code));
}
async function loadCaptionVideo(url, prefs) {
  if (!validUrl(url)) throw new Error("Enter a complete http:// or https:// video URL.");
  const lookup = async (settings, publicCaptions = false) => {
    const result = await execa(binary("yt-dlp", settings.ytdlPath), [...common(settings), "--skip-download", "--dump-single-json", "--", url.trim()], { env: env(), timeout: 9e4 });
    const info = JSON.parse(result.stdout);
    if (info.live_status === "is_live") throw new Error("This video is currently live. Try again after the stream ends.");
    const tracks = captionTracks(info);
    if (!tracks.length) throw new Error("This video has no published or automatic captions. This command extracts captions; it does not transcribe audio.");
    return { title: info.title || "Transcript", url: url.trim(), tracks, publicCaptions };
  };
  try {
    return await lookup(prefs);
  } catch (original) {
    if (!prefs.cookiesFromBrowser || prefs.cookiesFromBrowser === "none") throw original;
    try {
      return await lookup({ ...prefs, cookiesFromBrowser: "none" }, true);
    } catch {
      throw original;
    }
  }
}
function clean(text) {
  return text.replace(/<[^>]*>/g, "").replace(/\{\\[^}]*\}/g, "").replace(/&#(x[\da-f]+|\d+);/gi, (full, value) => {
    const n = value[0].toLowerCase() === "x" ? parseInt(value.slice(1), 16) : Number(value);
    return n >= 0 && n <= 1114111 ? String.fromCodePoint(n) : full;
  }).replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, entity) => ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " })[entity] || "").replace(/\s+/g, " ").trim();
}
function parseSrt(source) {
  const cues = [];
  let previous = [];
  for (const block of source.replace(/^\uFEFF/, "").split(/\r?\n\s*\r?\n/)) {
    const lines = block.split(/\r?\n/);
    const index = lines.findIndex((line) => /\d{2}:\d{2}:\d{2}[,.]\d{3}\s+-->/.test(line));
    if (index < 0) continue;
    const text = clean(lines.slice(index + 1).join(" "));
    if (!text) continue;
    const words = text.split(" ");
    let overlap = 0;
    for (let n = Math.min(previous.length, words.length); n > 0; n--) {
      if (previous.slice(-n).join(" ") === words.slice(0, n).join(" ")) {
        overlap = n;
        break;
      }
    }
    const addition = words.slice(overlap).join(" ");
    if (addition) cues.push({ time: lines[index].trim().slice(0, 8), text: addition });
    previous = words;
  }
  return cues;
}
async function extractCaptions(video, trackId, prefs) {
  const track = video.tracks.find((t) => t.id === trackId);
  if (!track) throw new Error("Choose an available caption language first.");
  const ytdlp = binary("yt-dlp", prefs.ytdlPath), ffmpeg = binary("ffmpeg", prefs.ffmpegPath);
  const folder = (0, import_node_fs.mkdtempSync)(import_node_path.default.join((0, import_node_os.tmpdir)(), "tinycast-transcript-"));
  try {
    const settings = video.publicCaptions ? { ...prefs, cookiesFromBrowser: "none" } : prefs;
    const escaped = track.code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    await execa(ytdlp, [...common(settings), "--skip-download", track.automatic ? "--write-auto-subs" : "--write-subs", "--sub-langs", `^${escaped}$`, "--sub-format", "srt/vtt/best", "--convert-subs", "srt", "--ffmpeg-location", import_node_path.default.dirname(ffmpeg), "-o", import_node_path.default.join(folder, "captions.%(ext)s"), "--", video.url], { env: env(), timeout: 12e4 });
    const file = (0, import_node_fs.readdirSync)(folder).find((name) => name.endsWith(".srt"));
    if (!file) throw new Error(`No ${track.code} captions were downloaded. The site may be rate-limiting subtitles; retry later or select another track.`);
    const cues = parseSrt((0, import_node_fs.readFileSync)(import_node_path.default.join(folder, file), "utf8"));
    if (!cues.length) throw new Error("The downloaded caption file contains no readable transcript text.");
    return cues;
  } finally {
    try {
      (0, import_node_fs.rmSync)(folder, { recursive: true, force: true });
    } catch {
    }
  }
}
function transcriptText(cues, timestamps) {
  return timestamps ? cues.map((c) => `[${c.time}] ${c.text}`).join("\n\n") : cues.map((c) => c.text).join(" ");
}
var markdownEscape = (s) => s.replace(/[\\`*_{}\[\]()#+.!<>|]/g, "\\$&");

// src/extract-transcript.tsx
var import_jsx_runtime = require("react/jsx-runtime");
function ExtractTranscript() {
  const prefs = (0, import_api.getPreferenceValues)();
  const [url, setUrl] = (0, import_react.useState)("");
  const [video, setVideo] = (0, import_react.useState)(null);
  const [track, setTrack] = (0, import_react.useState)("");
  const [timestamps, setTimestamps] = (0, import_react.useState)(false);
  const [cues, setCues] = (0, import_react.useState)(null);
  const [busy, setBusy] = (0, import_react.useState)(false);
  const [status, setStatus] = (0, import_react.useState)("Paste a video URL, then choose Load Caption Languages.");
  const [error, setError] = (0, import_react.useState)("");
  const [saved, setSaved] = (0, import_react.useState)("");
  const working = (0, import_react.useRef)(false), edited = (0, import_react.useRef)(false);
  (0, import_react.useEffect)(() => {
    if (prefs.autoLoadUrlFromClipboard) void import_api.Clipboard.readText().then((text2) => {
      if (!edited.current && text2 && validUrl(text2)) setUrl(text2.trim());
    }).catch(() => {
    });
  }, []);
  async function submit(values) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError("");
    try {
      const link = String(values.url ?? url).trim();
      if (!video || link !== video.url) {
        setStatus("Loading available caption languages\u2026");
        const next = await loadCaptionVideo(link, prefs);
        setVideo(next);
        setUrl(link);
        const preferred = next.tracks.find((t) => !t.automatic && /^en(?:-|$)/.test(t.code)) || next.tracks.find((t) => t.code === "en-orig") || next.tracks.find((t) => /^en(?:-|$)/.test(t.code)) || next.tracks[0];
        setTrack(preferred.id);
        setStatus(next.publicCaptions ? "Public captions loaded (browser session had none). Choose a language, then run Extract Transcript." : "Choose a caption language, then run Extract Transcript.");
      } else {
        setStatus("Downloading and extracting captions\u2026 Keep this command open.");
        const selected = String(values.language ?? track);
        setTrack(selected);
        setTimestamps(Boolean(values.timestamps ?? timestamps));
        setCues(await extractCaptions(video, selected, prefs));
        setStatus("");
      }
    } catch (e) {
      setError(errorText(e));
      setStatus("Could not extract the transcript. See the error below.");
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  const text = cues ? transcriptText(cues, timestamps) : "";
  const language = video?.tracks.find((t) => t.id === track);
  const markdown = video && cues ? `# ${markdownEscape(video.title)}

${markdownEscape(video.url)}

${markdownEscape(language?.name || track)}${language?.automatic ? " \xB7 Automatic captions" : " \xB7 Published captions"}

${markdownEscape(text)}` : "";
  function save(extension) {
    try {
      const folder = expand(prefs.downloadPath || "~/Downloads");
      (0, import_node_fs2.mkdirSync)(folder, { recursive: true });
      const name = (video?.title || "Transcript").replace(/[\/\\:*?"<>|\x00-\x1f]/g, "_").slice(0, 100);
      const file = import_node_path2.default.join(folder, `${name} - transcript-${Date.now()}.${extension}`);
      (0, import_node_fs2.writeFileSync)(file, extension === "md" ? markdown : text, { encoding: "utf8", flag: "wx" });
      setSaved(file);
      setError("");
    } catch (e) {
      setError(errorText(e));
    }
  }
  if (cues) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api.Detail, { markdown: `${markdown}${saved ? `

---

Saved: ${markdownEscape(saved)}` : ""}${error ? `

Export error: ${markdownEscape(error)}` : ""}`, actions: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_api.ActionPanel, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api.Action.CopyToClipboard, { title: "Copy Transcript", content: text }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api.Action, { title: "Save as Markdown", onAction: () => save("md") }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api.Action, { title: "Save as Text", onAction: () => save("txt") }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api.Action, { title: timestamps ? "Hide Timestamps" : "Show Timestamps", onAction: () => setTimestamps((v) => !v) }),
    saved && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api.Action, { title: "Show Saved Transcript in Finder", onAction: () => (0, import_api.showInFinder)(saved) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api.Action, { title: "Choose Another Language", onAction: () => {
      setCues(null);
      setSaved("");
      setError("");
      setStatus("Choose a language, then run Extract Transcript.");
    } })
  ] }) });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_api.Form, { isLoading: busy, actions: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_api.ActionPanel, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api.Action.SubmitForm, { title: busy ? "Working\u2026" : video ? "Extract Transcript" : "Load Caption Languages", onSubmit: submit }),
    error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api.Action.CopyToClipboard, { title: "Copy Error", content: error }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api.Action, { title: "Extension Preferences", onAction: import_api.openExtensionPreferences })
  ] }), children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api.Form.TextField, { id: "url", title: "Video URL", value: url, onChange: (value) => {
      if (!working.current) {
        edited.current = true;
        setUrl(value);
        setVideo(null);
        setTrack("");
        setError("");
        setStatus("Choose Load Caption Languages.");
      }
    }, placeholder: "https://www.youtube.com/watch?v=\u2026" }),
    video && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api.Form.Description, { title: "Video", text: video.title }),
    video && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api.Form.Dropdown, { id: "language", title: "Caption Language", value: track, onChange: setTrack, children: video.tracks.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api.Form.Dropdown.Item, { value: t.id, title: `${t.name} (${t.code}) \xB7 ${t.automatic ? "Automatic" : "Published"}` }, t.id)) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api.Form.Checkbox, { id: "timestamps", title: "Timestamps", label: "Include timestamps", value: timestamps, onChange: setTimestamps }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api.Form.Description, { title: "Status", text: status }),
    error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_api.Form.Description, { title: "Error", text: error.slice(-3e3) })
  ] });
}
